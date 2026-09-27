// Preview UI: the score (src/preview/score-view.ts), renders of a measure range, and playback
// through a mixer (src/preview/player.ts).
//
// The playhead lives in piece time (seconds from the start of the score). A render covers a
// range of it; playing outside the rendered range renders from the playhead first.

import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

import { compressorParams } from "../audio/dynamics.ts";
import { Player, type MixerSettings } from "./player.ts";
import { ScoreView, type MeasureTime } from "./score-view.ts";

interface ScoreEntry {
  path: string;
  name: string;
  dir: string;
}
interface ScoreData {
  title: string;
  musicxml: string;
  warnings: string[];
  measures: (MeasureTime & { quarters: number })[];
  parts: { id: string; name: string }[];
}
interface RenderResult {
  url: string;
  stemUrls: Record<string, string>;
  renderDir: string;
  startSeconds: number;
  seconds: number;
  warnings: string[];
}
interface Job {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  message: string;
  fraction: number;
  result?: RenderResult;
  error?: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scoresNav = $("scores");
const titleEl = $("title");
const fromInput = $<HTMLInputElement>("from");
const toInput = $<HTMLInputElement>("to");
const renderButton = $<HTMLButtonElement>("render");
const playButton = $<HTMLButtonElement>("play");
const timeEl = $("time");
const statusEl = $("status");
const messages = $("messages");
const strips = $("strips");
const mixerMode = $("mixer-mode");
const keysDialog = $<HTMLDialogElement>("keys");

const toolkit = new VerovioToolkit(await createVerovioModule());
const player = new Player();
const view = new ScoreView($("score"), toolkit);

let current: { path: string; data: ScoreData } | undefined;
let job: Job | undefined;
/** The loaded render: where it starts in piece time. */
let rendered: RenderResult | undefined;
/** Playhead in piece time. */
let cursor = 0;
/** Seconds to start at once the running render is loaded. */
let playAfterRender: number | undefined;
let renderWarnings: string[] = [];

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function showMessages(): void {
  const lines = [...(current?.data.warnings ?? []), ...renderWarnings];
  messages.hidden = lines.length === 0;
  messages.innerHTML = lines.length
    ? `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    : "";
}

const pieceEnd = () => current?.data.measures.at(-1)?.endSeconds ?? 0;
const renderedCovers = (t: number) =>
  rendered !== undefined &&
  t >= rendered.startSeconds - 1e-3 &&
  t < rendered.startSeconds + rendered.seconds - 0.05;

//==============================================================================
// Score list and drawing

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

async function open(path: string, keepRange = false): Promise<void> {
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
  const last = data.measures.length;
  fromInput.max = toInput.max = String(last);
  if (changed || !keepRange) {
    fromInput.value = "1";
    toInput.value = String(last);
  }
  if (changed) {
    renderWarnings = [];
    rendered = undefined;
    player.pause();
    cursor = 0;
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
  view.draw(data.musicxml, data.measures);
  view.setRange(Number(fromInput.value), Number(toInput.value));
  view.setCursor(cursor);
}

function setRange(from: number, to: number): void {
  fromInput.value = String(from);
  toInput.value = String(to);
  view.setRange(from, to);
}
fromInput.addEventListener("change", () =>
  view.setRange(Number(fromInput.value), Number(toInput.value)),
);
toInput.addEventListener("change", () =>
  view.setRange(Number(fromInput.value), Number(toInput.value)),
);
$("all").addEventListener("click", () => setRange(1, current?.data.measures.length ?? 1));

view.onRange = (from, to) => setRange(from, to);
view.onSeek = (seconds) => seekTo(seconds);

//==============================================================================
// Transport

function seekTo(seconds: number): void {
  cursor = Math.max(0, Math.min(seconds, pieceEnd()));
  view.setCursor(cursor);
  if (renderedCovers(cursor)) player.seek(cursor - rendered!.startSeconds);
  else if (player.isPlaying) player.pause();
}

async function play(): Promise<void> {
  if (!current) return;
  if (renderedCovers(cursor)) {
    await player.play(cursor - rendered!.startSeconds);
    return;
  }
  // Not rendered here yet: render from the playhead's measure to the end of the range.
  const from = view.measureAt(cursor);
  const to = Math.max(from, Number(toInput.value));
  playAfterRender = cursor;
  startRender(from, to);
}

function togglePlay(): void {
  if (player.isPlaying) player.pause();
  else void play();
}

function stepMeasure(delta: number): void {
  if (!current) return;
  const measures = current.data.measures;
  const here = view.measureAt(cursor);
  const m = measures.find((x) => x.number === here)!;
  // ← at a point inside a measure goes to its start first.
  const target =
    delta < 0 && cursor - m.seconds > 0.25 ? m : measures.find((x) => x.number === here + delta);
  if (target) seekTo(target.seconds);
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
    KeyR: () => renderButton.click(),
    KeyM: () => $("mixer-toggle").click(),
    Escape: () => setRange(1, current?.data.measures.length ?? 1),
  };
  const action = e.key === "?" ? () => keysDialog.showModal() : actions[e.code];
  if (!action) return;
  e.preventDefault();
  action();
});
$("help").addEventListener("click", () => keysDialog.showModal());

//==============================================================================
// Rendering

function showJob(j: Job): void {
  if (j.status === "failed") {
    statusEl.textContent = `失敗: ${j.error}`;
    renderButton.disabled = false;
  } else if (j.status === "done") {
    statusEl.textContent = "レンダ済み";
    renderButton.disabled = false;
  } else {
    statusEl.innerHTML = `${escapeHtml(j.message)}<progress max="1" value="${j.fraction}"></progress>`;
  }
}

function startRender(from: number, to: number): void {
  if (!current) return;
  renderButton.disabled = true;
  statusEl.textContent = "開始中";
  void fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: current.path, from, to }),
  })
    .then((res) => res.json())
    .then((j: Job) => {
      job = j;
      showJob(j);
    });
}

renderButton.addEventListener("click", () => {
  const from = Number(fromInput.value);
  const m = current?.data.measures.find((x) => x.number === from);
  // Play from the playhead if it is inside the range, otherwise from the range start.
  const inRange = m && cursor >= m.seconds && view.measureAt(cursor) <= Number(toInput.value);
  playAfterRender = inRange ? cursor : m?.seconds;
  startRender(from, Number(toInput.value));
});

async function loadRender(result: RenderResult): Promise<void> {
  rendered = result;
  renderWarnings = result.warnings;
  showMessages();
  await player.load(
    result.stemUrls,
    result.seconds,
    async (parts) => {
      const res = await fetch("/api/remix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ renderDir: result.renderDir, parts }),
      });
      return ((await res.json()) as { url: string }).url;
    },
    (text) => (statusEl.textContent = text),
  );
  statusEl.textContent = "レンダ済み";
  updateStripAvailability();
  const start = playAfterRender ?? result.startSeconds;
  playAfterRender = undefined;
  cursor = start;
  await player.play(start - result.startSeconds);
}

const events = new EventSource("/api/events");
events.addEventListener("job", (e) => {
  const j = JSON.parse((e as MessageEvent<string>).data) as Job;
  if (j.id !== job?.id) return;
  job = j;
  showJob(j);
  if (j.status === "done" && j.result) void loadRender(j.result);
});
events.addEventListener("changed", (e) => {
  const { path } = JSON.parse((e as MessageEvent<string>).data) as { path: string };
  void loadList();
  if (path === current?.path) void open(path, true);
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
  for (const s of strips.querySelectorAll<HTMLElement>(".strip:not(.master)")) {
    s.classList.toggle("silent", rendered !== undefined && !player.hasSound(s.dataset.id!));
  }
  mixerMode.textContent =
    player.mode === "mix"
      ? "長いレンダなので、つまみを動かすとサーバでミックスし直す（少し遅れて反映）"
      : "";
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

setInterval(() => {
  player.tick();
  if (player.isPlaying && rendered) {
    cursor = rendered.startSeconds + player.position;
    view.setCursor(cursor, true);
    view.highlight(cursor);
  } else {
    view.highlight(undefined);
  }
  timeEl.textContent = `${clock(cursor)} / ${clock(pieceEnd())}`;

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
    view.draw(current.data.musicxml, current.data.measures);
    view.setRange(Number(fromInput.value), Number(toInput.value));
  }, 200);
});

$("score").innerHTML = '<p class="empty">左から楽譜を選ぶ</p>';
await loadList();
