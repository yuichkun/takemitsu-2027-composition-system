// Preview UI: the score (src/preview/strip-view.ts) and playback through a mixer
// (src/preview/player.ts).
//
// There is no render step to start: the server renders every open score in the background and
// again after each save, nearest the playhead first, and draws its measures (engraver.ts). The page
// is told when something is newer and fetches the whole of it (docs/decisions/0019, 0020): a
// version's chunk list and which chunks are rendered, the measures and times, and where each
// drawing is. It plays what is complete and tells the server where the playhead and the view are.

import { compressorParams } from "../audio/dynamics.ts";
import type { NotationSnapshot } from "./engraver.ts";
import type { NotationView } from "./notation-thread.ts";
import { Player, type Manifest, type MixerSettings, type Status } from "./player.ts";
import { maxScale, minScale, StripView, type Mode, type Zoom } from "./strip-view.ts";

interface ScoreEntry {
  path: string;
  name: string;
  dir: string;
}
type ScoreData = NotationView;
interface Progress {
  done: number;
  total: number;
  failed: number;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scoresNav = $("scores");
const titleEl = $("title");
const playButton = $<HTMLButtonElement>("play");
const timeEl = $("time");
const statusEl = $("status");
const messages = $("messages");
const strips = $("strips");
const mixerMode = $("mixer-mode");
const keysDialog = $<HTMLDialogElement>("keys");
const readinessEl = $<HTMLCanvasElement>("readiness");

const player = new Player();
const view = new StripView($("score"));
view.position = () => player.position;

player.fetchSegments = async (segments) => {
  const res = await fetch("/api/segments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ segments }),
  });
  // For each segment: id length (uint16), id, payload length (uint32), payload.
  const bytes = new Uint8Array(await res.arrayBuffer());
  const data = new DataView(bytes.buffer);
  const text = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let at = 0; at + 2 <= bytes.length;) {
    const idLength = data.getUint16(at, true);
    const id = text.decode(bytes.subarray(at + 2, at + 2 + idLength));
    const length = data.getUint32(at + 2 + idLength, true);
    const start = at + 6 + idLength;
    out.set(id, bytes.subarray(start, start + length));
    at = start + length;
  }
  return out;
};

let current: { path: string; data?: ScoreData; manifest?: Manifest } | undefined;
let manifestWarnings: string[] = [];
/** Problems beyond single chunks (states not loaded, the store over its limit). */
let notices: string[] = [];
/** The last save could not be read or planned (the version before plays on). */
let audioError: string | undefined;
let progress: Progress = { done: 0, total: 0, failed: 0 };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function showMessages(): void {
  const lines = [
    ...(audioError ? [`保存した楽譜を読めなかった（前の版のまま）: ${audioError}`] : []),
    ...notices,
    ...(current?.data?.warnings ?? []),
    ...manifestWarnings,
  ];
  messages.hidden = lines.length === 0;
  messages.innerHTML = lines.length
    ? `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    : "";
}

const pieceEnd = () => current?.data?.measures.at(-1)?.endSeconds ?? 0;

//==============================================================================
// Score list, drawing and the chunk list

async function loadList(): Promise<void> {
  const list = (await (await fetch("/api/scores")).json()) as ScoreEntry[];
  scoresNav.innerHTML = "";
  let dir = "";
  for (const s of list) {
    if (s.dir !== dir) {
      dir = s.dir;
      const label = document.createElement("div");
      label.className = "dir";
      label.textContent = dir;
      scoresNav.append(label);
    }
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s.name;
    b.dataset.path = s.path;
    b.setAttribute("aria-current", String(s.path === current?.path));
    b.addEventListener("click", () => void open(s.path));
    scoresNav.append(b);
  }
  if (list.length === 0) scoresNav.textContent = "楽譜がない";
}

let audioFetch: Promise<void> | undefined;
let audioAgain = false;

/**
 * Fetches the newest status and, when it is for a newer version, that version's chunk list: both
 * whole, never as changes. One fetch at a time; news meanwhile makes it fetch once more.
 */
function refreshAudio(): void {
  if (audioFetch) {
    audioAgain = true;
    return;
  }
  audioFetch = (async () => {
    do {
      audioAgain = false;
      const path = current?.path;
      if (!path) return;
      const res = await fetch(`/api/status?path=${encodeURIComponent(path)}`);
      const status = (await res.json()) as Status &
        Progress & { notices: string[]; error?: string };
      if (current?.path !== path) continue;
      audioError = status.error;
      if (!res.ok) {
        showMessages();
        continue;
      }
      if (status.version !== player.version) {
        const r = await fetch(`/api/manifest?path=${encodeURIComponent(path)}`);
        const manifest = (await r.json()) as Manifest & { warnings: string[] };
        if (current?.path !== path || !r.ok) continue;
        if (manifest.version !== status.version) {
          // Another version came meanwhile: fetch its status too.
          audioAgain = true;
          continue;
        }
        current.manifest = manifest;
        manifestWarnings = manifest.warnings;
        player.setManifest(manifest, status);
      } else player.setStatus(status);
      progress = status;
      notices = status.notices;
      showMessages();
      showProgress();
      drawReadiness();
      updateStripAvailability();
    } while (audioAgain);
  })().finally(() => {
    audioFetch = undefined;
  });
}

let mixerOf: string | undefined;

/** Fetches the notation (and the parts and measures) and draws what changed. */
async function loadScore(path: string): Promise<void> {
  const res = await fetch(`/api/score?path=${encodeURIComponent(path)}`);
  const data = (await res.json()) as ScoreData & { error?: string };
  if (current?.path !== path) return;
  if (!res.ok || data.error) {
    messages.hidden = false;
    messages.textContent = `読み込めなかった: ${data.error ?? res.statusText}`;
    return;
  }
  const partsBefore = current.data?.parts.map((p) => p.id).join("|");
  current.data = data;
  titleEl.textContent = data.title;
  const ids = data.parts.map((p) => p.id);
  if (mixerOf !== path) {
    mixerOf = path;
    const settings = (await (
      await fetch(`/api/mixer?path=${encodeURIComponent(path)}`)
    ).json()) as MixerSettings;
    if (current?.path !== path) return;
    player.setParts(ids, settings);
    buildStrips();
  } else if (partsBefore !== ids.join("|")) {
    // Only when the parts changed: new channels stop what sounds.
    player.setParts(ids, player.settings());
    buildStrips();
  }
  showMessages();
  view.setScore(data.measures, data.tempo);
  view.setCursor(player.position);
  refreshNotation();
}

let notationFetch: Promise<void> | undefined;
let notationAgain = false;

/** Fetches where each measure's drawing is: whole, one fetch at a time (like refreshAudio). */
function refreshNotation(): void {
  if (notationFetch) {
    notationAgain = true;
    return;
  }
  notationFetch = (async () => {
    do {
      notationAgain = false;
      const path = current?.path;
      if (!path || !current?.data) return;
      const res = await fetch(`/api/notation?path=${encodeURIComponent(path)}`);
      if (current?.path !== path || !res.ok) continue;
      const snapshot = (await res.json()) as NotationSnapshot;
      if (snapshot.measures.length === current.data?.measures.length) view.setSnapshot(snapshot);
      notationPending = snapshot.pending;
      showProgress();
    } while (notationAgain);
  })().finally(() => {
    notationFetch = undefined;
  });
}
let notationPending = 0;

let focusTimer = 0;
view.onFocus = (from, to) => {
  clearTimeout(focusTimer);
  focusTimer = window.setTimeout(() => {
    if (!current) return;
    void fetch("/api/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: current.path, from, to }),
    });
  }, 150);
};

async function open(path: string): Promise<void> {
  $("empty").hidden = true;
  if (current?.path !== path) {
    current = { path };
    manifestWarnings = [];
    notices = [];
    audioError = undefined;
    progress = { done: 0, total: 0, failed: 0 };
    player.pause();
    player.seek(0);
    for (const b of scoresNav.querySelectorAll("button"))
      b.setAttribute("aria-current", String(b.dataset.path === path));
  }
  statusEl.textContent = "読み込み中";
  refreshAudio();
  await loadScore(path);
  sendPlayhead(true);
}

view.onSeek = (seconds) => seekTo(seconds);

//==============================================================================
// Transport

let lastSent = -1;
/** Tells the server where the playhead is, so it renders there first. */
function sendPlayhead(force = false): void {
  if (!current) return;
  const seconds = player.position;
  if (!force && Math.abs(seconds - lastSent) < 2) return;
  lastSent = seconds;
  void fetch("/api/playhead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: current.path, seconds }),
  });
}

/** Moves the playhead; with `follow`, the score scrolls to it. */
function seekTo(seconds: number, follow = false): void {
  const t = Math.max(0, Math.min(seconds, pieceEnd()));
  player.seek(t);
  view.setCursor(t, player.isPlaying);
  if (follow) view.reveal();
  sendPlayhead(true);
}

function togglePlay(): void {
  if (!current) return;
  if (player.isPlaying) player.pause();
  else void player.play();
}

function stepMeasure(delta: number): void {
  if (!current) return;
  const measures = current.data?.measures ?? [];
  const cursor = player.position;
  const here = view.measureAt(cursor);
  const m = measures.find((x) => x.number === here)!;
  // ← at a point inside a measure goes to its start first.
  const target =
    delta < 0 && cursor - m.seconds > 0.25 ? m : measures.find((x) => x.number === here + delta);
  if (target) seekTo(target.seconds, true);
}

playButton.addEventListener("click", togglePlay);

document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  // With ⌘ (Ctrl elsewhere): the page's own zoom and sidebar, instead of the browser's.
  if (e.metaKey || e.ctrlKey) {
    const withKey: Record<string, () => void> = {
      KeyB: toggleSidebar,
      Equal: () => zoomBy(1.25),
      Semicolon: () => zoomBy(1.25),
      Minus: () => zoomBy(1 / 1.25),
      Digit0: () => setZoom("fit"),
    };
    const action = withKey[e.code];
    if (!action || e.altKey) return;
    e.preventDefault();
    action();
    return;
  }
  const actions: Record<string, () => void> = {
    Space: togglePlay,
    Enter: () => seekTo(0, true),
    Home: () => seekTo(0, true),
    ArrowLeft: () => stepMeasure(-1),
    ArrowRight: () => stepMeasure(1),
    KeyM: () => $("mixer-toggle").click(),
    KeyP: () => setMode(view.currentMode === "page" ? "panorama" : "page"),
    KeyF: toggleFocus,
  };
  const action = e.key === "?" ? () => keysDialog.showModal() : actions[e.code];
  if (!action) return;
  e.preventDefault();
  action();
});

//==============================================================================
// How the score is shown: page or panorama, zoom, full screen, sidebar

interface ViewPrefs {
  mode: Mode;
  zoom: Record<Mode, Zoom>;
}
const prefsKey = "takemitsu.strip-view";
const prefs: ViewPrefs = { mode: "page", zoom: { page: "fit", panorama: "fit" } };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(prefsKey) ?? "{}") as Partial<ViewPrefs>);
} catch {
  // Storage may be unavailable (a private window): start from the defaults.
}
const savePrefs = () => {
  try {
    localStorage.setItem(prefsKey, JSON.stringify(prefs));
  } catch {
    // Not kept; the view still works.
  }
};

const modeButton = $<HTMLButtonElement>("mode");
const zoomLabel = $("zoom-level");
function showViewControls(): void {
  modeButton.textContent = prefs.mode === "page" ? "ページ" : "パノラマ";
  modeButton.title = `表示の切り替え（P）: いまは${prefs.mode === "page" ? "ページ" : "パノラマ"}`;
  const zoom = prefs.zoom[prefs.mode];
  zoomLabel.textContent = zoom === "fit" ? "高さに合わせる" : `${Math.round(view.scale * 720)} px`;
  zoomLabel.title = "五線 1 段の高さ（⌘0 で高さに合わせる）";
}

function setMode(mode: Mode): void {
  prefs.mode = mode;
  view.setMode(mode, prefs.zoom[mode]);
  view.reveal();
  savePrefs();
  showViewControls();
}

function setZoom(zoom: Zoom, anchor?: { x: number; y: number }): void {
  prefs.zoom[prefs.mode] = zoom;
  view.setZoom(zoom, anchor);
  savePrefs();
  showViewControls();
}

function zoomBy(factor: number, anchor?: { x: number; y: number }): void {
  setZoom(Math.max(minScale, Math.min(maxScale * 2, view.scale * factor)), anchor);
}

modeButton.addEventListener("click", () => setMode(prefs.mode === "page" ? "panorama" : "page"));
$("zoom-in").addEventListener("click", () => zoomBy(1.25));
$("zoom-out").addEventListener("click", () => zoomBy(1 / 1.25));
$("zoom-fit").addEventListener("click", () => setZoom("fit"));
// Pinch on a trackpad (a wheel event with Ctrl; Safari sends gesture events) and ⌘/Ctrl + wheel
// zoom around the pointer.
$("score").addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    view.pinch(Math.exp(-e.deltaY / 150), { x: e.clientX, y: e.clientY });
  },
  { passive: false },
);
let gestureScale = 1;
$("score").addEventListener("gesturestart", (e) => {
  e.preventDefault();
  gestureScale = 1;
});
$("score").addEventListener("gesturechange", (e) => {
  e.preventDefault();
  const g = e as Event & { scale: number; clientX: number; clientY: number };
  view.pinch(g.scale / gestureScale, { x: g.clientX, y: g.clientY });
  gestureScale = g.scale;
});
view.onZoom = (scale) => {
  prefs.zoom[prefs.mode] = scale;
  savePrefs();
  showViewControls();
};

function toggleSidebar(): void {
  document.body.classList.toggle("sidebar-hidden");
  view.resize();
}

/** Focus: only the score and the transport, and the browser in full screen. */
function toggleFocus(): void {
  const on = !document.body.classList.contains("focus");
  document.body.classList.toggle("focus", on);
  if (on) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  else if (document.fullscreenElement) void document.exitFullscreen();
  view.resize();
}
document.addEventListener("fullscreenchange", () => {
  // Leaving full screen (Esc) leaves focus too; the sidebar and mixer are as they were.
  if (!document.fullscreenElement && document.body.classList.contains("focus")) {
    document.body.classList.remove("focus");
    view.resize();
  }
});
$("focus").addEventListener("click", toggleFocus);
$("sidebar-toggle").addEventListener("click", toggleSidebar);
view.setMode(prefs.mode, prefs.zoom[prefs.mode]);
showViewControls();
$("help").addEventListener("click", () => keysDialog.showModal());

//==============================================================================
// Render progress: a status line and a strip over the whole piece

function showProgress(): void {
  const { done, total, failed } = progress;
  const drawing = notationPending ? `（譜面をそろえ中 残り ${notationPending} 小節）` : "";
  if (player.isWaiting) statusEl.textContent = "この先がそろうのを待っている";
  else if (!current || total === 0) statusEl.textContent = drawing;
  else if (done + failed >= total)
    statusEl.textContent = (failed ? `レンダ失敗 ${failed} か所` : "全体を鳴らせる") + drawing;
  else statusEl.textContent = `裏でレンダ中 ${Math.floor((100 * done) / total)}%${drawing}`;
}

let readinessQueued = false;
function drawReadiness(): void {
  if (readinessQueued) return;
  readinessQueued = true;
  setTimeout(() => {
    readinessQueued = false;
    const manifest = current?.manifest;
    const canvas = readinessEl;
    const width = canvas.clientWidth;
    canvas.width = width * devicePixelRatio;
    canvas.height = 10 * devicePixelRatio;
    const g = canvas.getContext("2d")!;
    g.scale(devicePixelRatio, devicePixelRatio);
    g.clearRect(0, 0, width, 10);
    if (!manifest || manifest.duration <= 0) return;
    const style = getComputedStyle(document.documentElement);
    const ready = player.readiness(manifest.measures);
    const x = (s: number) => (s / manifest.duration) * width;
    manifest.measures.forEach((m, i) => {
      const r = ready[i]!;
      // A measure with a chunk that failed to render shows in the warning colour.
      g.fillStyle = style.getPropertyValue(r.failed ? "--warn" : "--accent");
      g.globalAlpha = r.failed ? 0.9 : 0.15 + 0.7 * r.share;
      g.fillRect(x(m.start), 2, Math.max(1, x(m.end) - x(m.start)), 6);
    });
    g.globalAlpha = 1;
    g.fillStyle = style.getPropertyValue("--play");
    g.fillRect(x(player.position) - 1, 0, 2, 10);
  }, 100);
}

readinessEl.addEventListener("click", (e) => {
  const manifest = current?.manifest;
  if (!manifest) return;
  const box = readinessEl.getBoundingClientRect();
  seekTo(((e.clientX - box.left) / box.width) * manifest.duration, true);
});

const events = new EventSource("/api/events");
events.addEventListener("status", (e) => {
  const { path } = JSON.parse((e as MessageEvent<string>).data) as { path: string };
  if (path === current?.path) refreshAudio();
});
events.addEventListener("score", (e) => {
  const { path } = JSON.parse((e as MessageEvent<string>).data) as { path: string };
  if (path === current?.path) void loadScore(path);
});
events.addEventListener("notation", (e) => {
  const { path } = JSON.parse((e as MessageEvent<string>).data) as { path: string };
  if (path === current?.path) refreshNotation();
});
events.addEventListener("list", () => void loadList());
// After a lost connection, anything may have changed: fetch it all again.
events.addEventListener("open", () => {
  if (!current) return;
  refreshAudio();
  void loadScore(current.path);
});

//==============================================================================
// Mixer

let saveTimer = 0;
function saveMixer(): void {
  if (!current) return;
  const path = current.path;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void fetch(`/api/mixer?path=${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(player.settings()),
    });
  }, 300);
}

const formatDb = (db: number) => (db <= -60 ? "−∞" : `${db > 0 ? "+" : ""}${db.toFixed(1)}`);
const compTitle = (amount: number) => {
  const p = compressorParams(amount);
  return amount === 0
    ? "圧縮なし"
    : `しきい値 ${p.threshold.toFixed(0)} dB、比率 ${p.ratio.toFixed(1)}:1、嵩上げ +${p.makeup.toFixed(1)} dB`;
};

function strip(id: string | undefined, name: string): HTMLElement {
  const el = document.createElement("div");
  el.className = id ? "strip" : "strip master";
  const state = id ? player.channel(id)! : { db: player.masterDb, comp: 0 };
  const faderId = `fader-${id ?? "master"}`;
  const compId = `comp-${id ?? "master"}`;
  el.innerHTML = `
    <div class="strip-buttons">${
      id
        ? '<button type="button" class="mute" title="ミュート">M</button><button type="button" class="solo" title="ソロ（Alt+クリックでこれだけ）">S</button>'
        : '<span class="limit-label" title="マスターの最後に常に入っているリミッター（−1 dBFS）">LIMIT</span>'
    }</div>
    <div class="comp">${
      id
        ? `<label for="${compId}">圧縮</label><input id="${compId}" type="range" min="0" max="100" step="1" value="${Math.round(state.comp * 100)}" title="${compTitle(state.comp)}" />`
        : ""
    }<span class="gr" title="いま圧縮で下げている量"></span></div>
    <div class="strip-body">
      <div class="meter"><div class="meter-fill"></div></div>
      <input id="${faderId}" class="fader" type="range" min="-60" max="12" step="0.5" value="${state.db}" aria-label="${escapeHtml(name)} の音量" title="ダブルクリックで 0 dB" />
    </div>
    <output class="db" for="${faderId}">${formatDb(state.db)}</output>
    <label class="name" for="${faderId}" title="${escapeHtml(name)}">${escapeHtml(name)}</label>`;
  const fader = el.querySelector<HTMLInputElement>(".fader")!;
  const db = el.querySelector("output")!;
  fader.addEventListener("input", () => {
    const v = Number(fader.value);
    db.textContent = formatDb(v);
    if (id) player.set(id, { db: v });
    else player.setMaster(v);
    saveMixer();
  });
  fader.addEventListener("dblclick", () => {
    fader.value = "0";
    fader.dispatchEvent(new Event("input"));
  });
  if (id) {
    const comp = el.querySelector<HTMLInputElement>(`#${CSS.escape(compId)}`)!;
    comp.addEventListener("input", () => {
      const amount = Number(comp.value) / 100;
      comp.title = compTitle(amount);
      player.set(id, { comp: amount });
      saveMixer();
    });
    comp.addEventListener("dblclick", () => {
      comp.value = "0";
      comp.dispatchEvent(new Event("input"));
    });
    const mute = el.querySelector<HTMLButtonElement>(".mute")!;
    const solo = el.querySelector<HTMLButtonElement>(".solo")!;
    const sync = () => {
      const s = player.channel(id)!;
      mute.setAttribute("aria-pressed", String(s.mute));
      solo.setAttribute("aria-pressed", String(s.solo));
    };
    mute.addEventListener("click", () => {
      player.set(id, { mute: !player.channel(id)!.mute });
      sync();
      saveMixer();
    });
    solo.addEventListener("click", (e) => {
      if (e.altKey)
        for (const p of current?.data?.parts ?? []) player.set(p.id, { solo: p.id === id });
      else player.set(id, { solo: !player.channel(id)!.solo });
      for (const s of strips.querySelectorAll<HTMLElement>(".strip"))
        s.dispatchEvent(new Event("sync"));
      saveMixer();
    });
    el.addEventListener("sync", sync);
    sync();
  }
  el.dataset.id = id ?? "";
  return el;
}

function buildStrips(): void {
  strips.innerHTML = "";
  for (const p of current?.data?.parts ?? []) strips.append(strip(p.id, p.name));
  strips.append(strip(undefined, "Master"));
  updateStripAvailability();
}

function updateStripAvailability(): void {
  for (const s of strips.querySelectorAll<HTMLElement>(".strip:not(.master)"))
    s.classList.toggle(
      "silent",
      current?.manifest !== undefined && !player.hasSound(s.dataset.id!),
    );
  mixerMode.textContent = "";
}

$("mixer-reset").addEventListener("click", () => {
  for (const p of current?.data?.parts ?? [])
    player.set(p.id, { db: 0, mute: false, solo: false, comp: 0 });
  player.setMaster(0);
  buildStrips();
  saveMixer();
});
$("mixer-toggle").addEventListener("click", (e) => {
  const button = e.currentTarget as HTMLButtonElement;
  const collapsed = document.body.classList.toggle("mixer-collapsed");
  button.textContent = collapsed ? "ひらく" : "たたむ";
  button.setAttribute("aria-expanded", String(!collapsed));
});

//==============================================================================
// Display loop: time, playhead, meters. A timer rather than animation frames, which stop while the
// window is hidden (the score glides on animation frames while it is shown: strip-view.ts).

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
player.onChange = () => {
  playButton.textContent = player.isPlaying ? "❚❚" : "▶";
  playButton.setAttribute("aria-label", player.isPlaying ? "一時停止" : "再生");
};

let ticks = 0;
setInterval(() => {
  player.tick();
  const cursor = player.position;
  view.setCursor(cursor, player.isPlaying);
  if (player.isPlaying) sendPlayhead();
  const time = `${clock(cursor)} / ${clock(pieceEnd())}`;
  if (timeEl.textContent !== time) timeEl.textContent = time;
  if (++ticks % 10 === 0) {
    drawReadiness();
    showProgress();
  }
  showMeters();
}, 50);

/** The meters' elements and what they show, so a tick touches only what changed. */
let meters: { id?: string; fill: HTMLElement; gr: HTMLElement; shown: string }[] = [];
function showMeters(): void {
  const hidden =
    document.body.classList.contains("mixer-collapsed") ||
    document.body.classList.contains("focus");
  if (hidden) return;
  if (meters.length !== strips.children.length)
    meters = [...strips.querySelectorAll<HTMLElement>(".strip")].map((s) => ({
      id: s.dataset.id || undefined,
      fill: s.querySelector<HTMLElement>(".meter-fill")!,
      gr: s.querySelector<HTMLElement>(".gr")!,
      shown: "",
    }));
  for (const m of meters) {
    if (!m.fill.isConnected) {
      meters = [];
      return;
    }
    const level = player.meter(m.id);
    const db = level > 0 ? 20 * Math.log10(level) : -90;
    const top = Math.round(100 - Math.max(0, Math.min(100, ((db + 60) / 66) * 100)));
    const gr = player.reduction(m.id);
    const grText = gr < -0.5 ? gr.toFixed(1) : "";
    const shown = `${top}:${level >= 1}:${grText}`;
    if (shown === m.shown) continue;
    m.shown = shown;
    m.fill.style.clipPath = `inset(${top}% 0 0 0)`;
    m.fill.classList.toggle("clip", level >= 1);
    m.gr.textContent = grText;
  }
}

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    view.resize();
    drawReadiness();
  }, 200);
});

// For measuring from the browser's console (tools and docs/worklog).
if (import.meta.env.DEV) Object.assign(window, { preview: { player, view } });
await loadList();
// A link can open a score: #score=<path of the score file>.
const linked = new URLSearchParams(location.hash.slice(1)).get("score");
if (linked) void open(linked);
