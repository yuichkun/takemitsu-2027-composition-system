// Preview UI: the score (src/preview/score-view.ts) and playback through a mixer
// (src/preview/player.ts).
//
// There is no render step to start: the server renders every open score in the background and
// again after each save, nearest the playhead first. The page follows its progress, plays what
// is ready, and tells the server where the playhead is.

import { compressorParams } from "../audio/dynamics.ts";
import { Player, type Manifest, type MixerSettings } from "./player.ts";
import { ScoreView, type MeasureTime, type WindowInfo } from "./score-view.ts";

interface ScoreEntry {
  path: string;
  name: string;
  dir: string;
}
interface ScoreData {
  title: string;
  windows: WindowInfo[];
  warnings: string[];
  measures: (MeasureTime & { quarters: number })[];
  parts: { id: string; name: string }[];
}
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
const view = new ScoreView($("score"), async (hash) => {
  const res = await fetch(`/api/window?hash=${hash}`);
  return res.text();
});

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

let current: { path: string; data: ScoreData; manifest?: Manifest } | undefined;
let manifestWarnings: string[] = [];
let progress: Progress = { done: 0, total: 0, failed: 0 };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function showMessages(): void {
  const lines = [...(current?.data.warnings ?? []), ...manifestWarnings];
  messages.hidden = lines.length === 0;
  messages.innerHTML = lines.length
    ? `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    : "";
}

const pieceEnd = () => current?.data.measures.at(-1)?.endSeconds ?? 0;

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

async function loadManifest(path: string): Promise<void> {
  const res = await fetch(`/api/manifest?path=${encodeURIComponent(path)}`);
  const data = (await res.json()) as Manifest & {
    progress: Progress;
    warnings: string[];
    error?: string;
  };
  if (!res.ok || data.error || current?.path !== path) return;
  current.manifest = data;
  manifestWarnings = data.warnings;
  progress = data.progress;
  player.setManifest(data);
  showMessages();
  showProgress();
  drawReadiness();
  updateStripAvailability();
}

async function open(path: string): Promise<void> {
  statusEl.textContent = "読み込み中";
  const res = await fetch(`/api/score?path=${encodeURIComponent(path)}`);
  const data = (await res.json()) as ScoreData & { error?: string };
  if (!res.ok || data.error) {
    messages.hidden = false;
    messages.textContent = `読み込めなかった: ${data.error ?? res.statusText}`;
    return;
  }
  const changed = current?.path !== path;
  current = { path, data };
  for (const b of scoresNav.querySelectorAll("button"))
    b.setAttribute("aria-current", String(b.dataset.path === path));
  titleEl.textContent = data.title;
  if (changed) {
    manifestWarnings = [];
    player.pause();
    player.seek(0);
    const settings = (await (
      await fetch(`/api/mixer?path=${encodeURIComponent(path)}`)
    ).json()) as MixerSettings;
    player.setParts(
      data.parts.map((p) => p.id),
      settings,
    );
  } else {
    player.setParts(
      data.parts.map((p) => p.id),
      player.settings(),
    );
  }
  buildStrips();
  showMessages();
  view.draw(data.windows, data.measures);
  view.setCursor(player.position);
  await loadManifest(path);
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
  view.setCursor(t, follow);
  sendPlayhead(true);
}

function togglePlay(): void {
  if (!current) return;
  if (player.isPlaying) player.pause();
  else void player.play();
}

function stepMeasure(delta: number): void {
  if (!current) return;
  const measures = current.data.measures;
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
  if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
  const actions: Record<string, () => void> = {
    Space: togglePlay,
    Enter: () => {
      seekTo(0);
      view.scrollToTop();
    },
    Home: () => {
      seekTo(0);
      view.scrollToTop();
    },
    ArrowLeft: () => stepMeasure(-1),
    ArrowRight: () => stepMeasure(1),
    KeyM: () => $("mixer-toggle").click(),
  };
  const action = e.key === "?" ? () => keysDialog.showModal() : actions[e.code];
  if (!action) return;
  e.preventDefault();
  action();
});
$("help").addEventListener("click", () => keysDialog.showModal());

//==============================================================================
// Render progress: a status line and a strip over the whole piece

function showProgress(): void {
  const { done, total, failed } = progress;
  if (!current || total === 0) statusEl.textContent = "";
  else if (done + failed >= total)
    statusEl.textContent = failed ? `レンダ失敗 ${failed} か所` : "全体を鳴らせる";
  else statusEl.textContent = `裏でレンダ中 ${Math.floor((100 * done) / total)}%`;
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
      g.fillStyle = style.getPropertyValue("--accent");
      g.globalAlpha = 0.15 + 0.7 * ready[i]!;
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
events.addEventListener("chunks", (e) => {
  const data = JSON.parse((e as MessageEvent<string>).data) as {
    path: string;
    version: number;
    ready: [string, number][];
  };
  if (data.path !== current?.path) return;
  player.ready(data.ready);
  drawReadiness();
});
events.addEventListener("progress", (e) => {
  const data = JSON.parse((e as MessageEvent<string>).data) as Progress & { path: string };
  if (data.path !== current?.path) return;
  progress = data;
  showProgress();
});
events.addEventListener("changed", (e) => {
  const { path } = JSON.parse((e as MessageEvent<string>).data) as { path: string };
  void loadList();
  if (path === current?.path) void open(path);
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
        for (const p of current?.data.parts ?? []) player.set(p.id, { solo: p.id === id });
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
  for (const p of current?.data.parts ?? []) strips.append(strip(p.id, p.name));
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
  for (const p of current?.data.parts ?? [])
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
// Display loop: time, playhead, sounding notes, meters. A timer rather than animation frames,
// which stop while the window is hidden.

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
player.onChange = () => {
  playButton.textContent = player.isPlaying ? "❚❚" : "▶";
  playButton.setAttribute("aria-label", player.isPlaying ? "一時停止" : "再生");
};

let ticks = 0;
setInterval(() => {
  player.tick();
  const cursor = player.position;
  if (player.isPlaying) {
    view.setCursor(cursor, true);
    view.highlight(cursor);
    sendPlayhead();
  } else {
    view.highlight(undefined);
  }
  timeEl.textContent = `${clock(cursor)} / ${clock(pieceEnd())}`;
  if (++ticks % 10 === 0) drawReadiness();

  for (const s of strips.querySelectorAll<HTMLElement>(".strip")) {
    const id = s.dataset.id || undefined;
    const level = player.meter(id);
    const db = level > 0 ? 20 * Math.log10(level) : -90;
    const fill = s.querySelector<HTMLElement>(".meter-fill")!;
    fill.style.height = `${Math.max(0, Math.min(100, ((db + 60) / 66) * 100))}%`;
    fill.classList.toggle("clip", level >= 1);
    const gr = player.reduction(id);
    s.querySelector<HTMLElement>(".gr")!.textContent = gr < -0.5 ? gr.toFixed(1) : "";
  }
}, 50);

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!current) return;
    view.redraw();
    drawReadiness();
  }, 200);
});

$("score").innerHTML = '<p class="empty">左から楽譜を選ぶ</p>';
// For measuring from the browser's console (tools and docs/worklog).
if (import.meta.env.DEV) Object.assign(window, { preview: { player, view } });
await loadList();
