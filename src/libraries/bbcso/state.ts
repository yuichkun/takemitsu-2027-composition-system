// Builds BBC Symphony Orchestra plugin states without the plugin's GUI.
//
// The plugin state (what a host saves in a project) is JUCE's VST3 wrapper around the
// plugin's own XML (<SPITFIREAUDIO_AUNTIE>). That XML names each loaded articulation patch
// ("b - Violins 1 - Long") with its trigger (keyswitch number). The plugin loads the patches
// named there, so a state can be written from the patch list alone.
// Findings and the byte layout are recorded in docs/research/bbcso.md.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const templateXml = readFileSync(join(import.meta.dirname, "template.xml"), "utf8");

export interface ArticulationSlot {
  /** Patch name as the plugin knows it, e.g. "b - Violins 1 - Long". */
  patch: string;
  /** MIDI note that selects this articulation. */
  keyswitch: number;
}

export interface StateSpec {
  family: string;
  name: string;
  articulations: ArticulationSlot[];
  /** Global tune in semitones (the plugin's "Global Tune"). */
  tune?: number;
  /**
   * Microphone levels by mic id: "flmxrl" (Full Mix Real, the default), "pmix1" (the piano's Mix 1),
   * "close", "tree", "amb", … Mics not listed are switched off.
   */
  mics?: Record<string, number>;
  /** The plugin's product mode: 0 for the Professional patches, 10 for Discover Piano. */
  productMode?: number;
  /** Reverb send, 0–1. Default 0 (dry; room sound comes from the mic positions). */
  reverb?: number;
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function setSetting(block: string, id: string, value: string): string {
  const pattern = new RegExp(`(<SETTING id="${id}" value=")[^"]*(")`);
  if (!pattern.test(block)) throw new Error(`Template has no setting ${id}`);
  return block.replace(pattern, `$1${escapeAttr(value)}$2`);
}

function setParam(xml: string, id: string, value: number): string {
  const pattern = new RegExp(`(<PARAM id="${id.replace(/[[\]]/g, "\\$&")}" value=")[^"]*(")`);
  if (!pattern.test(xml)) throw new Error(`Template has no parameter ${id}`);
  return xml.replace(pattern, `$1${value}$2`);
}

export function stateXml(spec: StateSpec): string {
  if (spec.articulations.length === 0) throw new Error("A state needs at least one articulation");
  const artic = templateXml.match(/<ARTIC>[\s\S]*?<\/ARTIC>/)?.[0];
  if (!artic) throw new Error("Template has no ARTIC block");

  const mics = spec.mics ?? { flmxrl: 1 };
  // Each articulation carries its own mic mix: level (m_) and enabled flag (e_).
  const withMics = artic.replace(
    /<SETTING id="([me])_(\w+)" value="[^"]*" micId="(\d+)" \/>/g,
    (_all, kind: string, mic: string, micId: string) => {
      const level = mics[mic] ?? 0;
      const value = kind === "m" ? level.toFixed(1) : level > 0 ? "1" : "0";
      return `<SETTING id="${kind}_${mic}" value="${value}" micId="${micId}" />`;
    },
  );
  const blocks = spec.articulations.map((slot, i) => {
    let block = setSetting(withMics, "a_name", slot.patch);
    block = setSetting(block, "t_keyswitch", String(slot.keyswitch));
    return setSetting(block, "a_active", i === 0 ? "2" : "0");
  });

  let xml = templateXml.replace(artic, blocks.join("\n    "));
  xml = xml.replace(
    /<META [^>]*\/>/,
    `<META family="${escapeAttr(spec.family)}" name="${escapeAttr(spec.name)}" productMode="${spec.productMode ?? 0}" version="1.5.0" tags="" modified="0" />`,
  );
  xml = setParam(xml, "g_tune", spec.tune ?? 0);
  xml = setParam(xml, "i_reverb", spec.reverb ?? 0);
  for (const id of xml.match(/<PARAM id="m_(\w+)"/g)?.map((m) => m.slice(13, -1)) ?? []) {
    if (id !== "virt_actual") xml = setParam(xml, `m_${id}`, mics[id] ?? 0);
  }
  return `<?xml version="1.0" encoding="UTF-8"?> ${xml.trim()}`;
}

//==============================================================================
// JUCE VST3 state wrapper

// JUCE's MemoryBlock::toBase64Encoding alphabet and bit order (little-endian 6-bit groups).
const alphabet = ".ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+";

function juceBase64(bytes: Uint8Array): string {
  const chars = Math.floor((bytes.length * 8 + 5) / 6);
  let out = `${bytes.length}.`;
  for (let i = 0; i < chars; i++) {
    let v = 0;
    for (let k = 0; k < 6; k++) {
      const bit = i * 6 + k;
      if (bit < bytes.length * 8 && (bytes[bit >> 3]! >> (bit & 7)) & 1) v |= 1 << k;
    }
    out += alphabet[v];
  }
  return out;
}

function juceBase64Decode(text: string): Uint8Array {
  const dot = text.indexOf(".");
  const size = Number(text.slice(0, dot));
  const out = new Uint8Array(size);
  const data = text.slice(dot + 1);
  for (let i = 0; i < data.length; i++) {
    const v = alphabet.indexOf(data[i]!);
    for (let k = 0; k < 6; k++) {
      const bit = i * 6 + k;
      if (bit >= size * 8) break;
      if ((v >> k) & 1) out[bit >> 3]! |= 1 << (bit & 7);
    }
  }
  return out;
}

// JUCE's copyXmlToBinary: "VC2!" + little-endian length + UTF-8 text (+ a NUL not counted).
function xmlToBinary(xml: string): Uint8Array {
  const text = new TextEncoder().encode(xml);
  const out = new Uint8Array(8 + text.length + 1);
  out.set([0x56, 0x43, 0x32, 0x21]);
  new DataView(out.buffer).setUint32(4, text.length, true);
  out.set(text, 8);
  return out;
}

function binaryToXml(bytes: Uint8Array): string {
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);
  return new TextDecoder().decode(bytes.subarray(8, 8 + length));
}

const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((b) => parseInt(b, 16)));

// Trailer JUCE writes after the plugin chunk: the host-side bypass parameter.
const juceprivateTrailer = hex(
  "4a554345507269766174654461746100010142797061737300010103001d000000000000004a5543455072697661746544617461",
);

/** Encodes the plugin XML as the state blob a JUCE host passes to setStateInformation. */
export function encodeState(xml: string): Uint8Array {
  const inner = xmlToBinary(xml);
  // The plugin chunk: VC2! block, 8 zero bytes, JUCEPrivateData trailer.
  const chunk = new Uint8Array(inner.length + 8 + juceprivateTrailer.length);
  chunk.set(inner);
  chunk.set(juceprivateTrailer, inner.length + 8);

  // VST2-style "fxb" bank header used by JUCE's VST3 wrapper.
  const header = new Uint8Array(0xb0);
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode("VstW"), 0);
  view.setUint32(4, 8);
  view.setUint32(8, 1);
  view.setUint32(12, 0);
  header.set(new TextEncoder().encode("CcnK"), 0x10);
  view.setUint32(0x14, header.length + chunk.length - 0x18);
  header.set(new TextEncoder().encode("FBCh"), 0x18);
  view.setUint32(0x1c, 2);
  header.set(new TextEncoder().encode("Sant"), 0x20);
  view.setUint32(0x24, 0x00010c0e);
  view.setUint32(0x28, 1);
  view.setUint32(0xac, chunk.length);

  const component = new Uint8Array(header.length + chunk.length);
  component.set(header);
  component.set(chunk, header.length);

  const outer = `<?xml version="1.0" encoding="UTF-8"?> <VST3PluginState><IComponent>${juceBase64(component)}</IComponent></VST3PluginState>`;
  return xmlToBinary(outer);
}

/** The plugin XML inside a saved state blob. */
export function decodeState(bytes: Uint8Array): string {
  const outer = binaryToXml(bytes);
  const encoded = outer.match(/<IComponent>([\s\S]*?)<\/IComponent>/)?.[1];
  if (!encoded) throw new Error("Not a JUCE VST3 state");
  const component = juceBase64Decode(encoded.trim());
  const at = new TextDecoder("latin1").decode(component).indexOf("VC2!");
  return binaryToXml(component.subarray(at));
}
