// Preview UI: draws the score's MusicXML with Verovio and plays renders of a measure range.

import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

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
  result?: { url: string; startSeconds: number; warnings: string[] };
  error?: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scoresNav = $("scores");
const titleEl = $("title");
const fromInput = $<HTMLInputElement>("from");
const toInput = $<HTMLInputElement>("to");
const playButton = $<HTMLButtonElement>("play");
const statusEl = $("status");
const audio = $<HTMLAudioElement>("audio");
const messages = $("messages");
const scoreEl = $("score");

const toolkit = new VerovioToolkit(await createVerovioModule());

let current: { path: string; data: ScoreData } | undefined;
let job: Job | undefined;
/** Seconds from the start of the piece where the loaded audio begins. */
let audioOffset = 0;

function showMessages(lines: string[]): void {
  messages.hidden = lines.length === 0;
  messages.innerHTML = lines.length
    ? `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    : "";
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

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
    showMessages([`読み込めなかった: ${data.error ?? res.statusText}`]);
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
  showMessages(data.warnings);
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
  const pages = toolkit.getPageCount();
  scoreEl.innerHTML = "";
  for (let p = 1; p <= pages; p++) {
    const page = document.createElement("div");
    page.className = "page";
    page.innerHTML = toolkit.renderToSVG(p);
    scoreEl.append(page);
  }
  for (const m of scoreEl.querySelectorAll<SVGGElement>("g.measure")) {
    m.addEventListener("click", (e) => {
      const n = Number(m.dataset.n);
      if (!n) return;
      if ((e as MouseEvent).shiftKey) toInput.value = String(Math.max(n, Number(fromInput.value)));
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
// Rendering and playback

function showJob(j: Job): void {
  if (j.status === "failed") {
    statusEl.textContent = `失敗: ${j.error}`;
    playButton.disabled = false;
    return;
  }
  if (j.status === "done") {
    statusEl.textContent = "レンダ済み";
    playButton.disabled = false;
    return;
  }
  statusEl.innerHTML = `${escapeHtml(j.message)}<progress max="1" value="${j.fraction}"></progress>`;
}

playButton.addEventListener("click", async () => {
  if (!current) return;
  playButton.disabled = true;
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

const events = new EventSource("/api/events");
events.addEventListener("job", (e) => {
  const j = JSON.parse((e as MessageEvent<string>).data) as Job;
  if (j.id !== job?.id) return;
  job = j;
  showJob(j);
  if (j.status === "done" && j.result) {
    audioOffset = j.result.startSeconds;
    audio.src = j.result.url;
    void audio.play();
    showMessages([...(current?.data.warnings ?? []), ...j.result.warnings]);
  }
});
events.addEventListener("changed", (e) => {
  const { path } = JSON.parse((e as MessageEvent<string>).data) as { path: string };
  void loadList();
  if (path === current?.path) void open(path, true);
});

// Colour the notes sounding now.
let playing: Element[] = [];
function follow(): void {
  for (const el of playing) el.classList.remove("playing");
  playing = [];
  if (!audio.paused && current) {
    const ms = (audio.currentTime + audioOffset) * 1000;
    const at = toolkit.getElementsAtTime(ms) as { notes?: string[] };
    for (const id of at.notes ?? []) {
      const el = scoreEl.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.classList.add("playing");
        playing.push(el);
      }
    }
  }
}
// A timer rather than animation frames: frames stop while the window is hidden.
setInterval(follow, 50);

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(drawScore, 200);
});

scoreEl.innerHTML = '<p class="empty">左から楽譜を選ぶ</p>';
await loadList();
