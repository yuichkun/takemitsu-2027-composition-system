// Preview UI: draws the score's MusicXML with Verovio, renders a measure range, and plays it
// through a mixer (src/preview/player.ts).

import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

import { Player, type MixerSettings } from "./player.ts";

interface ScoreEntry {
  path: string;
  name: string;
  dir: string;
}
interface ScoreData {
  title: string;
  musicxml: string;
  warnings: string[];
  measures: { number: number; quarters: number; seconds: number }[];
  parts: { id: string; name: string }[];
}
interface Job {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  message: string;
  fraction: number;
  result?: {
    url: string;
    stemUrls: Record<string, string>;
    renderDir: string;
    startSeconds: number;
    seconds: number;
    warnings: string[];
  };
  error?: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scoresNav = $("scores");
const titleEl = $("title");
const fromInput = $<HTMLInputElement>("from");
const toInput = $<HTMLInputElement>("to");
const renderButton = $<HTMLButtonElement>("render");
const playButton = $<HTMLButtonElement>("play");
const seek = $<HTMLInputElement>("seek");
const timeEl = $("time");
const statusEl = $("status");
const messages = $("messages");
const scoreEl = $("score");
const strips = $("strips");
const mixerMode = $("mixer-mode");

const toolkit = new VerovioToolkit(await createVerovioModule());
const player = new Player();

let current: { path: string; data: ScoreData } | undefined;
let job: Job | undefined;
/** Seconds from the start of the piece where the loaded render begins. */
let renderOffset = 0;
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
    const settings = (await (
      await fetch(`/api/mixer?path=${encodeURIComponent(path)}`)
    ).json()) as MixerSettings;
    player.setParts(
      data.parts.map((p) => p.id),
      settings,
    );
    playButton.disabled = true;
    seek.disabled = true;
  } else {
    player.setParts(
      data.parts.map((p) => p.id),
      player.settings(),
    );
  }
  buildStrips();
  showMessages();
  drawScore();
}

function drawScore(): void {
  if (!current) return;
  const width = Math.max(800, scoreEl.clientWidth - 40);
  toolkit.setOptions({
    pageWidth: Math.round((width * 100) / 35),
    pageHeight: 60000,
    adjustPageHeight: true,
    scale: 35,
    breaks: "auto",
    font: "Bravura",
    svgAdditionalAttribute: ["measure@n"],
    svgHtml5: true,
  });
  toolkit.loadData(current.data.musicxml);
  // Builds the timing table that getElementsAtTime reads.
  toolkit.renderToMIDI();
  scoreEl.innerHTML = "";
  for (let p = 1; p <= toolkit.getPageCount(); p++) {
    const page = document.createElement("div");
    page.className = "page";
    page.innerHTML = toolkit.renderToSVG(p);
    scoreEl.append(page);
  }
  for (const m of scoreEl.querySelectorAll<SVGGElement>("g.measure")) {
    m.addEventListener("click", (e) => {
      const n = Number(m.dataset.n);
      if (!n) return;
      if (e.shiftKey) toInput.value = String(Math.max(n, Number(fromInput.value)));
      else {
        fromInput.value = String(n);
        if (Number(toInput.value) < n) toInput.value = String(n);
      }
      markRange();
    });
  }
  markRange();
}

function markRange(): void {
  const from = Number(fromInput.value);
  const to = Number(toInput.value);
  const all = from === 1 && to === current?.data.measures.length;
  for (const m of scoreEl.querySelectorAll<SVGGElement>("g.measure")) {
    const n = Number(m.dataset.n);
    m.classList.toggle("selected", !all && n >= from && n <= to);
  }
}

fromInput.addEventListener("change", markRange);
toInput.addEventListener("change", markRange);
$("all").addEventListener("click", () => {
  fromInput.value = "1";
  toInput.value = String(current?.data.measures.length ?? 1);
  markRange();
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

function strip(id: string | undefined, name: string): HTMLElement {
  const el = document.createElement("div");
  el.className = id ? "strip" : "strip master";
  const state = id ? player.channel(id)! : { db: player.masterDb, mute: false, solo: false };
  const inputId = `fader-${id ?? "master"}`;
  el.innerHTML = `
    <div class="strip-buttons">${id ? '<button type="button" class="mute" title="ミュート">M</button><button type="button" class="solo" title="ソロ（Alt+クリックでこれだけ）">S</button>' : ""}</div>
    <div class="strip-body">
      <div class="meter"><div class="meter-fill"></div></div>
      <input id="${inputId}" class="fader" type="range" min="-60" max="12" step="0.5" value="${state.db}" aria-label="${escapeHtml(name)} の音量" />
    </div>
    <output class="db" for="${inputId}">${formatDb(state.db)}</output>
    <label class="name" for="${inputId}" title="${escapeHtml(name)}">${escapeHtml(name)}</label>`;
  const fader = el.querySelector<HTMLInputElement>(".fader")!;
  const db = el.querySelector("output")!;
  fader.addEventListener("input", () => {
    const v = Number(fader.value);
    db.textContent = formatDb(v);
    if (id) player.set(id, { db: v });
    else player.setMaster(v);
    saveMixer();
  });
  // Double-click returns the fader to 0 dB.
  fader.addEventListener("dblclick", () => {
    fader.value = "0";
    fader.dispatchEvent(new Event("input"));
  });
  if (id) {
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
      // Alt-click: solo this channel alone.
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
    s.classList.toggle("silent", !player.hasSound(s.dataset.id!));
  }
  mixerMode.textContent =
    player.mode === "mix"
      ? "長いレンダなので、フェーダーを動かすとサーバでミックスし直す（少し遅れて反映）"
      : "";
}

$("mixer-reset").addEventListener("click", () => {
  for (const p of current?.data.parts ?? []) player.set(p.id, { db: 0, mute: false, solo: false });
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
// Rendering and transport

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

renderButton.addEventListener("click", async () => {
  if (!current) return;
  renderButton.disabled = true;
  statusEl.textContent = "開始中";
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      path: current.path,
      from: Number(fromInput.value),
      to: Number(toInput.value),
    }),
  });
  job = (await res.json()) as Job;
  showJob(job);
});

async function loadRender(result: NonNullable<Job["result"]>): Promise<void> {
  renderOffset = result.startSeconds;
  renderWarnings = result.warnings;
  showMessages();
  await player.load(
    result.stemUrls,
    result.seconds,
    async (gains) => {
      const res = await fetch("/api/remix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ renderDir: result.renderDir, gains, master: 1 }),
      });
      return ((await res.json()) as { url: string }).url;
    },
    (text) => (statusEl.textContent = text),
  );
  statusEl.textContent = "レンダ済み";
  seek.max = String(player.duration);
  seek.disabled = false;
  playButton.disabled = false;
  updateStripAvailability();
  await player.play(0);
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

const togglePlay = () => (player.isPlaying ? player.pause() : void player.play());
playButton.addEventListener("click", togglePlay);
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && !playButton.disabled) {
    e.preventDefault();
    togglePlay();
  }
});
seek.addEventListener("input", () => player.seek(Number(seek.value)));

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
player.onChange = () => {
  playButton.textContent = player.isPlaying ? "❚❚" : "▶";
  playButton.setAttribute("aria-label", player.isPlaying ? "一時停止" : "再生");
};

// Transport display, meters, and the notes sounding now. A timer rather than animation
// frames, which stop while the window is hidden.
let playing: Element[] = [];
setInterval(() => {
  player.tick();
  const pos = player.position;
  timeEl.textContent = `${clock(pos)} / ${clock(player.duration)}`;
  if (document.activeElement !== seek) seek.value = String(pos);

  for (const s of strips.querySelectorAll<HTMLElement>(".strip")) {
    const level = player.meter(s.dataset.id || undefined);
    const db = level > 0 ? 20 * Math.log10(level) : -90;
    const fill = s.querySelector<HTMLElement>(".meter-fill")!;
    fill.style.height = `${Math.max(0, Math.min(100, ((db + 60) / 66) * 100))}%`;
    fill.classList.toggle("clip", level >= 1);
  }

  for (const el of playing) el.classList.remove("playing");
  playing = [];
  if (player.isPlaying && current) {
    const at = toolkit.getElementsAtTime((pos + renderOffset) * 1000);
    for (const id of at.notes ?? []) {
      const el = scoreEl.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.classList.add("playing");
        playing.push(el);
      }
    }
  }
}, 50);

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(drawScore, 200);
});

scoreEl.innerHTML = '<p class="empty">左から楽譜を選ぶ</p>';
await loadList();
