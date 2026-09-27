// The reusable controls of the knob panel, one per knob kind (src/sketch/knobs.ts). Each draws
// itself into a host element and calls `commit` with a new value when a change is finished (a drag
// let go, Enter, a click). Values shown while dragging are not sent.

import { spell } from "../../score/pitch.ts";
import type {
  ChoiceKnob,
  CurveKnob,
  EnvelopeKnob,
  Knob,
  Knobs,
  NumberKnob,
  PartialsKnob,
  PitchKnob,
  PitchRangeKnob,
  PitchSetKnob,
  ProportionsKnob,
  RangeKnob,
  SeedKnob,
  StepsKnob,
  TextKnob,
  ToggleKnob,
  Value,
  WeightsKnob,
  XYKnob,
} from "../../sketch/knobs.ts";

export interface Context {
  commit: (value: Value) => void;
  /** Every knob of the sketch and its value (a control may show one knob through another). */
  knobs: Knobs;
  values: Record<string, Value>;
}

export interface Control<K extends Knob = Knob> {
  /** Takes the whole row under its name. */
  wide?: boolean;
  /** How to use it, shown in the tooltip. */
  how: string;
  mount(host: HTMLElement, knob: K, value: K["value"], ctx: Context): void;
}

const h = <T extends keyof HTMLElementTagNameMap>(
  tag: T,
  className = "",
  text = "",
): HTMLElementTagNameMap[T] => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const decimals = (step: number) => (String(step).split(".")[1] ?? "").length;
const snap = (v: number, min: number, max: number, step: number) =>
  clamp(Number((Math.round(v / step) * step).toFixed(decimals(step))), min, max);
/** A pitch for reading: E♭4, F♯5, and arrows for quarter tones (G↓1 is G a quarter tone flat). */
export function nameOf(midi: number): string {
  const p = spell(midi);
  const marks: Record<string, string> = {
    "-2": "♭♭",
    "-1.5": "♭↓",
    "-1": "♭",
    "-0.5": "↓",
    "0": "",
    "0.5": "↑",
    "1": "♯",
    "1.5": "♯↑",
    "2": "♯♯",
  };
  return `${p.step}${marks[String(p.alter)] ?? ""}${p.octave}`;
}

/** Follows a pointer from pointerdown to release on `el`. */
function drag(
  el: HTMLElement,
  e: PointerEvent,
  move: (m: PointerEvent) => void,
  up: (moved: boolean) => void,
): void {
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  const x0 = e.clientX;
  const y0 = e.clientY;
  let moved = false;
  const onMove = (m: PointerEvent) => {
    if (!moved && Math.hypot(m.clientX - x0, m.clientY - y0) < 3) return;
    moved = true;
    move(m);
  };
  const onUp = () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    up(moved);
  };
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
}

//==============================================================================
// A value dragged sideways (numbers, pitches, seeds)

interface ScrubSpec {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  show: (v: number) => string;
  read: (text: string) => number | undefined;
  unit?: string;
}

/** A value you drag sideways, step with ↑↓ (Shift ×10), or click (or Enter) to type. */
function scrub(spec: ScrubSpec, commit: (v: number) => void): HTMLElement {
  const el = h("div", "scrub");
  el.tabIndex = 0;
  el.setAttribute("role", "spinbutton");
  el.setAttribute("aria-label", spec.label);
  el.dataset.knobFocus = spec.label;
  const v = h("span", "v");
  el.append(v);
  if (spec.unit) el.append(h("span", "u", spec.unit));
  let value = spec.value;
  const show = (x: number) => {
    value = x;
    v.textContent = spec.show(x);
    el.setAttribute("aria-valuenow", String(x));
  };
  show(value);
  const moveBy = (n: number) => show(snap(value + n * spec.step, spec.min, spec.max, spec.step));
  const type = () => {
    const input = h("input", "scrub-input");
    input.value = spec.show(value);
    input.setAttribute("aria-label", spec.label);
    el.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (keep: boolean) => {
      if (done) return;
      done = true;
      const x = keep ? spec.read(input.value) : undefined;
      input.replaceWith(el);
      if (x !== undefined && x !== spec.value) commit(snap(x, spec.min, spec.max, spec.step));
      else show(spec.value);
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") finish(true);
      else if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    el.focus();
    const start = value;
    el.classList.add("dragging");
    drag(
      el,
      e,
      (m) => {
        const steps = Math.round((m.clientX - e.clientX) / 6) * (m.shiftKey ? 10 : 1);
        show(snap(start + steps * spec.step, spec.min, spec.max, spec.step));
      },
      (moved) => {
        el.classList.remove("dragging");
        if (!moved) type();
        else if (value !== spec.value) commit(value);
      },
    );
  });
  let timer = 0;
  el.addEventListener("keydown", (e) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (e.key === "Enter") {
      e.preventDefault();
      type();
      return;
    }
    if (!dir) return;
    e.preventDefault();
    moveBy(dir * (e.shiftKey ? 10 : 1));
    clearTimeout(timer);
    timer = window.setTimeout(() => value !== spec.value && commit(value), 450);
  });
  return el;
}

const numberSpec = (
  k: { min: number; max: number; step: number; label: string; unit?: string },
  value: number,
): ScrubSpec => ({
  value,
  min: k.min,
  max: k.max,
  step: k.step,
  label: k.label,
  unit: k.unit,
  show: (x) => x.toFixed(decimals(k.step)),
  read: (t) => (Number.isFinite(Number(t)) && t.trim() !== "" ? Number(t) : undefined),
});

const pitchSpec = (
  k: { min: number; max: number; step: number; label: string },
  value: number,
): ScrubSpec => ({
  value,
  min: k.min,
  max: k.max,
  step: k.step,
  label: k.label,
  show: nameOf,
  read: (t) => {
    const plain = t
      .trim()
      .replace(/♯/g, "#")
      .replace(/♭/g, "b")
      .replace(/↑/g, "+")
      .replace(/↓/g, "-");
    const m = plain.match(/^([A-Ga-g])(#\+|b-|##|#|x|bb|b|\+|-)?(-?\d+)$/);
    if (!m) return undefined;
    const semis: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const alter: Record<string, number> = {
      "": 0,
      "#": 1,
      x: 2,
      "##": 2,
      b: -1,
      bb: -2,
      "+": 0.5,
      "-": -0.5,
      "#+": 1.5,
      "b-": -1.5,
    };
    return (Number(m[3]) + 1) * 12 + semis[m[1]!.toUpperCase()]! + alter[m[2] ?? ""]!;
  },
});

//==============================================================================
// Canvases: sized to their box, redrawn in the theme's colours

function canvas(
  host: HTMLElement,
  height: number,
  className: string,
): {
  el: HTMLCanvasElement;
  paint: (
    draw: (g: CanvasRenderingContext2D, w: number, h: number, css: CSSStyleDeclaration) => void,
  ) => void;
} {
  const el = h("canvas", className);
  el.style.height = `${height}px`;
  host.append(el);
  let last:
    | ((g: CanvasRenderingContext2D, w: number, h: number, css: CSSStyleDeclaration) => void)
    | undefined;
  const paint = (draw: typeof last & {}) => {
    last = draw;
    const w = el.clientWidth || 240;
    el.width = w * devicePixelRatio;
    el.height = height * devicePixelRatio;
    const g = el.getContext("2d")!;
    g.scale(devicePixelRatio, devicePixelRatio);
    draw(g, w, height, getComputedStyle(document.documentElement));
  };
  new ResizeObserver(() => last && paint(last)).observe(el);
  return { el, paint };
}

const color = (css: CSSStyleDeclaration, name: string) => css.getPropertyValue(name).trim();

function grid(g: CanvasRenderingContext2D, w: number, hgt: number, css: CSSStyleDeclaration): void {
  g.fillStyle = color(css, "--bg");
  g.fillRect(0, 0, w, hgt);
  g.strokeStyle = color(css, "--rule");
  g.lineWidth = 1;
  for (const f of [0.25, 0.5, 0.75]) {
    g.beginPath();
    g.moveTo(0, Math.round(hgt * f) + 0.5);
    g.lineTo(w, Math.round(hgt * f) + 0.5);
    g.moveTo(Math.round(w * f) + 0.5, 0);
    g.lineTo(Math.round(w * f) + 0.5, hgt);
    g.stroke();
  }
}

function ends(host: HTMLElement, labels: [string, string] | undefined): void {
  if (!labels) return;
  const row = h("div", "ends");
  row.append(h("span", "", `0 ${labels[0]}`), h("span", "", `1 ${labels[1]}`));
  host.append(row);
}

//==============================================================================
// The controls

const numberControl: Control<NumberKnob> = {
  how: "Drag sideways or ↑↓ (Shift ×10). Click to type.",
  mount(host, k, value, ctx) {
    host.append(scrub(numberSpec(k, value), ctx.commit));
  },
};

const pitchControl: Control<PitchKnob> = {
  how: "Drag sideways or ↑↓ key by step (Shift ×10). Click to type a name: C4, F#3, E+4 or E↑4 (quarter sharp), Bb-3.",
  mount(host, k, value, ctx) {
    host.append(scrub(pitchSpec(k, value), ctx.commit));
  },
};

const rangeControl: Control<RangeKnob> = {
  how: "Two values, low and high: drag each sideways, or click to type.",
  mount(host, k, value, ctx) {
    const [lo, hi] = value;
    const row = h("div", "pair");
    row.append(
      scrub({ ...numberSpec(k, lo), max: hi, unit: undefined }, (v) => ctx.commit([v, hi])),
      h("span", "dash", "–"),
      scrub({ ...numberSpec(k, hi), min: lo }, (v) => ctx.commit([lo, v])),
    );
    host.append(row);
  },
};

const pitchRangeControl: Control<PitchRangeKnob> = {
  how: "Lowest and highest pitch: drag each sideways, or click to type a name.",
  mount(host, k, value, ctx) {
    const [lo, hi] = value;
    const row = h("div", "pair");
    row.append(
      scrub({ ...pitchSpec(k, lo), max: hi }, (v) => ctx.commit([v, hi])),
      h("span", "dash", "–"),
      scrub({ ...pitchSpec(k, hi), min: lo }, (v) => ctx.commit([lo, v])),
    );
    host.append(row);
  },
};

const choiceControl: Control<ChoiceKnob> = {
  how: "Pick one.",
  mount(host, k, value, ctx) {
    if (k.options.length <= 4 && k.options.every((o) => o.length <= 10)) {
      const seg = h("div", "seg");
      seg.setAttribute("role", "radiogroup");
      for (const o of k.options) {
        const b = h("button", "", o);
        b.type = "button";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(o === value));
        b.addEventListener("click", () => o !== value && ctx.commit(o));
        seg.append(b);
      }
      host.append(seg);
      return;
    }
    const select = h("select", "select");
    for (const o of k.options) {
      const opt = h("option", "", o);
      opt.selected = o === value;
      select.append(opt);
    }
    select.addEventListener("change", () => {
      ctx.commit(select.value);
      select.blur();
    });
    host.append(select);
  },
};

const textControl: Control<TextKnob> = {
  wide: true,
  how: "Type, then Enter (or leave the field).",
  mount(host, k, value, ctx) {
    const input = h("input", "text");
    input.value = value;
    input.spellcheck = false;
    if (k.hint) input.placeholder = k.hint;
    input.addEventListener("keydown", (e) => e.key === "Enter" && input.blur());
    input.addEventListener("change", () => input.value !== value && ctx.commit(input.value));
    host.append(input);
  },
};

const toggleControl: Control<ToggleKnob> = {
  how: "Click to switch.",
  mount(host, _k, value, ctx) {
    const b = h("button", "switch");
    b.type = "button";
    b.setAttribute("role", "switch");
    b.setAttribute("aria-checked", String(value));
    b.append(h("span"));
    b.addEventListener("click", () => ctx.commit(!value));
    host.append(b);
  },
};

const seedControl: Control<SeedKnob> = {
  how: "‹ › step through seeds, ⚄ picks a new one. The same seed always gives the same result.",
  mount(host, k, value, ctx) {
    const row = h("div", "pair");
    const button = (label: string, title: string, next: () => number) => {
      const b = h("button", "icon", label);
      b.type = "button";
      b.title = title;
      b.addEventListener("click", () => ctx.commit(next()));
      return b;
    };
    row.append(
      button("‹", "Previous seed", () => Math.max(0, value - 1)),
      scrub({ ...numberSpec({ min: 0, max: 99999, step: 1, label: k.label }, value) }, ctx.commit),
      button("›", "Next seed", () => value + 1),
      button("⚄", "A new random seed", () => Math.floor(Math.random() * 100000)),
    );
    host.append(row);
  },
};

const curveControl: Control<CurveKnob> = {
  wide: true,
  how: "Draw the shape freehand, left to right is time. Double-click to flatten at that height.",
  mount(host, k, value, ctx) {
    const c = canvas(host, 76, "pad");
    let points = [...value];
    const draw = () =>
      c.paint((g, w, hgt, css) => {
        grid(g, w, hgt, css);
        const x = (i: number) => (i / (points.length - 1)) * w;
        const y = (v: number) => (1 - v) * (hgt - 4) + 2;
        g.beginPath();
        g.moveTo(0, hgt);
        points.forEach((v, i) => g.lineTo(x(i), y(v)));
        g.lineTo(w, hgt);
        g.fillStyle = color(css, "--accent-soft");
        g.fill();
        g.beginPath();
        points.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))));
        g.strokeStyle = color(css, "--ink");
        g.lineWidth = 1.5;
        g.stroke();
      });
    draw();
    const at = (e: PointerEvent): [number, number] => {
      const r = c.el.getBoundingClientRect();
      const i = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * (points.length - 1));
      return [i, clamp(1 - (e.clientY - r.top - 2) / (r.height - 4), 0, 1)];
    };
    c.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      let [pi, pv] = at(e);
      points[pi] = pv;
      draw();
      drag(
        c.el,
        e,
        (m) => {
          const [i, v] = at(m);
          // Fill every sample between the last point and this one, so a fast stroke leaves no gaps.
          const step = i > pi ? 1 : -1;
          for (let j = pi; j !== i + step; j += step)
            points[j] = i === pi ? v : pv + ((v - pv) * (j - pi)) / (i - pi);
          [pi, pv] = [i, v];
          draw();
        },
        () => ctx.commit(points.map((v) => Math.round(v * 1000) / 1000)),
      );
    });
    c.el.addEventListener("dblclick", (e) => {
      const [, v] = at(e as PointerEvent);
      points = points.map(() => Math.round(v * 1000) / 1000);
      draw();
      ctx.commit(points);
    });
    ends(host, k.ends);
  },
};

const envelopeControl: Control<EnvelopeKnob> = {
  wide: true,
  how: "Drag the points. Click an empty place to add one; double-click a point to remove it. The first and last stay at the edges.",
  mount(host, k, value, ctx) {
    const c = canvas(host, 76, "pad");
    let points = [...value].map((p) => [...p] as [number, number]).sort((a, b) => a[0] - b[0]);
    const pad = 5;
    const draw = () =>
      c.paint((g, w, hgt, css) => {
        grid(g, w, hgt, css);
        const x = (t: number) => pad + t * (w - 2 * pad);
        const y = (v: number) => pad + (1 - v) * (hgt - 2 * pad);
        g.beginPath();
        points.forEach(([t, v], i) => (i ? g.lineTo(x(t), y(v)) : g.moveTo(x(t), y(v))));
        g.strokeStyle = color(css, "--ink");
        g.lineWidth = 1.5;
        g.stroke();
        for (const [t, v] of points) {
          g.beginPath();
          g.arc(x(t), y(v), 3.5, 0, Math.PI * 2);
          g.fillStyle = color(css, "--paper");
          g.fill();
          g.stroke();
        }
      });
    draw();
    const at = (e: MouseEvent): [number, number] => {
      const r = c.el.getBoundingClientRect();
      return [
        clamp((e.clientX - r.left - pad) / (r.width - 2 * pad), 0, 1),
        clamp(1 - (e.clientY - r.top - pad) / (r.height - 2 * pad), 0, 1),
      ];
    };
    const near = (e: MouseEvent) => {
      const r = c.el.getBoundingClientRect();
      return points.findIndex(
        ([t, v]) =>
          Math.hypot(
            pad + t * (r.width - 2 * pad) - (e.clientX - r.left),
            pad + (1 - v) * (r.height - 2 * pad) - (e.clientY - r.top),
          ) < 8,
      );
    };
    const round = (p: [number, number]): [number, number] => [
      Math.round(p[0] * 1000) / 1000,
      Math.round(p[1] * 1000) / 1000,
    ];
    c.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      let i = near(e);
      if (i < 0) {
        const p = at(e);
        points.push(p);
        points.sort((a, b) => a[0] - b[0]);
        i = points.indexOf(p);
        draw();
      }
      const first = i === 0;
      const last = i === points.length - 1;
      drag(
        c.el,
        e,
        (m) => {
          const [t, v] = at(m);
          const lo = first ? 0 : points[i - 1]![0];
          const hi = last ? 1 : points[i + 1]![0];
          points[i] = [first ? 0 : last ? 1 : clamp(t, lo, hi), v];
          draw();
        },
        () => ctx.commit(points.map(round)),
      );
    });
    c.el.addEventListener("dblclick", (e) => {
      const i = near(e);
      if (i <= 0 || i >= points.length - 1) return;
      points.splice(i, 1);
      draw();
      ctx.commit(points.map(round));
    });
    ends(host, k.ends);
  },
};

/** Interval-class vector of a set of pitch classes (semitones, integers only). */
function intervalVector(set: number[]): number[] | undefined {
  if (!set.every(Number.isInteger)) return undefined;
  const v = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < set.length; i++)
    for (let j = i + 1; j < set.length; j++) {
      const d = (((set[j]! - set[i]!) % 12) + 12) % 12;
      const ic = Math.min(d, 12 - d);
      if (ic) v[ic - 1]!++;
    }
  return v;
}

const pitchSetControl: Control<PitchSetKnob> = {
  wide: true,
  how: "Click the points of the clock to add or remove pitch classes (0 at the top, semitones clockwise).",
  mount(host, k, value, ctx) {
    const n = k.divisions;
    const set = new Set(value.map((v) => Math.round(v * 2) / 2));
    const size = 132;
    const ns = "http://www.w3.org/2000/svg";
    const wrap = h("div", "clock");
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    const r = size / 2 - 14;
    const c = size / 2;
    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", String(c));
    ring.setAttribute("cy", String(c));
    ring.setAttribute("r", String(r));
    ring.setAttribute("class", "ring");
    svg.append(ring);
    const on = [...set].sort((a, b) => a - b);
    // The polygon joining the members shows the set's shape.
    if (on.length > 1) {
      const poly = document.createElementNS(ns, "polygon");
      poly.setAttribute(
        "points",
        on
          .map((pc) => {
            const a = (pc / 12) * Math.PI * 2 - Math.PI / 2;
            return `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
          })
          .join(" "),
      );
      poly.setAttribute("class", "shape");
      svg.append(poly);
    }
    for (let i = 0; i < n; i++) {
      const pc = (i * 12) / n;
      const a = (pc / 12) * Math.PI * 2 - Math.PI / 2;
      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", String(c + r * Math.cos(a)));
      dot.setAttribute("cy", String(c + r * Math.sin(a)));
      dot.setAttribute("r", Number.isInteger(pc) ? "6" : "4");
      dot.setAttribute("class", set.has(pc) ? "pc on" : "pc");
      dot.setAttribute("tabindex", "0");
      dot.setAttribute("role", "checkbox");
      dot.setAttribute("aria-checked", String(set.has(pc)));
      dot.setAttribute("aria-label", String(pc));
      const toggle = () => {
        const next = new Set(set);
        if (next.has(pc)) next.delete(pc);
        else next.add(pc);
        ctx.commit([...next].sort((x, y) => x - y));
      };
      dot.addEventListener("click", toggle);
      dot.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") toggle();
      });
      svg.append(dot);
      if (Number.isInteger(pc)) {
        const label = document.createElementNS(ns, "text");
        const lr = r + 10;
        label.setAttribute("x", String(c + lr * Math.cos(a)));
        label.setAttribute("y", String(c + lr * Math.sin(a) + 3));
        label.setAttribute("class", "pc-label");
        label.textContent = String(pc);
        svg.append(label);
      }
    }
    const info = h("div", "clock-info");
    info.append(
      h("div", "set", on.length ? `{${on.join(" ")}}` : "{ }"),
      h("div", "muted", `${on.length} pitch classes`),
    );
    const iv = intervalVector(on);
    if (iv) info.append(h("div", "muted", `interval vector <${iv.join("")}>`));
    wrap.append(svg, info);
    host.append(wrap);
  },
};

const partialsControl: Control<PartialsKnob> = {
  wide: true,
  how: "Click partials to use them (1 is the fundamental). Each shows the pitch it rounds to on the quarter-tone grid, and how far off it is in cents.",
  mount(host, k, value, ctx) {
    const on = new Set(value);
    const f = k.fundamental ? ctx.values[k.fundamental] : undefined;
    const box = h("div", "partials");
    for (let n = 1; n <= k.count; n++) {
      const b = h("button", on.has(n) ? "partial on" : "partial");
      b.type = "button";
      b.setAttribute("aria-pressed", String(on.has(n)));
      b.append(h("span", "n", String(n)));
      if (typeof f === "number") {
        const exact = f + 12 * Math.log2(n);
        const q = Math.round(exact * 2) / 2;
        const cents = Math.round((exact - q) * 100);
        b.append(h("span", "p", nameOf(q)));
        b.title = `${nameOf(q)} ${cents >= 0 ? "+" : ""}${cents}¢`;
      }
      b.addEventListener("click", () => {
        const next = new Set(on);
        if (next.has(n)) next.delete(n);
        else next.add(n);
        ctx.commit([...next].sort((x, y) => x - y));
      });
      box.append(b);
    }
    host.append(box);
  },
};

const weightsControl: Control<WeightsKnob> = {
  wide: true,
  how: "Drag across the bars to set each height (how likely, or how much).",
  mount(host, k, value, ctx) {
    const box = h("div", "weights");
    const bars: HTMLElement[] = [];
    const w = [...value];
    k.labels.forEach((label, i) => {
      const col = h("div", "weight");
      const track = h("div", "track");
      const fill = h("div", "fill");
      track.append(fill);
      col.append(track, h("div", "wl", label));
      col.title = label;
      bars.push(fill);
      box.append(col);
      fill.style.height = `${w[i]! * 100}%`;
    });
    const set = (e: PointerEvent) => {
      const tracks = [...box.querySelectorAll<HTMLElement>(".track")];
      const i = tracks.findIndex((t) => {
        const r = t.parentElement!.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX < r.right;
      });
      if (i < 0) return;
      const r = tracks[i]!.getBoundingClientRect();
      w[i] = Math.round(clamp((r.bottom - e.clientY) / r.height, 0, 1) * 100) / 100;
      bars[i]!.style.height = `${w[i]! * 100}%`;
    };
    box.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      set(e);
      drag(box, e, set, () => ctx.commit([...w]));
    });
    host.append(box);
  },
};

const stepsControl: Control<StepsKnob> = {
  wide: true,
  how: "Click a step to switch it; drag to paint several.",
  mount(host, k, value, ctx) {
    const rows = value.map((r) => [...r]);
    const box = h("div", "steps");
    box.style.setProperty("--steps", String(k.steps));
    const cells: HTMLElement[][] = [];
    k.rows.forEach((label, ri) => {
      box.append(h("span", "sl", label));
      const row = h("div", "srow");
      cells.push([]);
      for (let si = 0; si < k.steps; si++) {
        const cell = h("span", `cell${rows[ri]![si] ? " on" : ""}${si % 4 === 0 ? " beat" : ""}`);
        cell.dataset.r = String(ri);
        cell.dataset.s = String(si);
        cells[ri]!.push(cell);
        row.append(cell);
      }
      box.append(row);
    });
    let paint: boolean | undefined;
    const hit = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el?.classList.contains("cell")) return;
      const ri = Number(el.dataset.r);
      const si = Number(el.dataset.s);
      paint ??= !rows[ri]![si];
      rows[ri]![si] = paint;
      el.classList.toggle("on", paint);
    };
    box.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      paint = undefined;
      hit(e);
      drag(box, e, hit, () => ctx.commit(rows.map((r) => [...r])));
    });
    host.append(box);
  },
};

const proportionsControl: Control<ProportionsKnob> = {
  wide: true,
  how: "Drag a boundary between two parts; the total stays the same. A part can shrink to nothing.",
  mount(host, k, value, ctx) {
    const parts = [...value];
    const total = parts.reduce((a, b) => a + b, 0);
    const bar = h("div", "props");
    const draw = () => {
      bar.innerHTML = "";
      parts.forEach((p, i) => {
        const seg = h("div", "prop");
        seg.style.flexGrow = String(p);
        seg.append(h("span", "pl", k.labels[i]!), h("span", "pv", String(p)));
        seg.title = `${k.labels[i]}: ${p}${k.unit ? ` ${k.unit}` : ""}`;
        bar.append(seg);
        if (i < parts.length - 1) {
          const handle = h("div", "divider");
          handle.dataset.i = String(i);
          bar.append(handle);
        }
      });
    };
    draw();
    bar.addEventListener("pointerdown", (e) => {
      const handle = (e.target as HTMLElement).closest<HTMLElement>(".divider");
      if (!handle || e.button !== 0) return;
      const i = Number(handle.dataset.i);
      const start = [...parts];
      const width = bar.getBoundingClientRect().width;
      drag(
        bar,
        e,
        (m) => {
          const units = Math.round(((m.clientX - e.clientX) / width) * total);
          const d = clamp(units, -start[i]!, start[i + 1]!);
          parts[i] = start[i]! + d;
          parts[i + 1] = start[i + 1]! - d;
          draw();
        },
        () => ctx.commit([...parts]),
      );
    });
    host.append(bar);
    host.append(h("div", "ends", `${total}${k.unit ? ` ${k.unit}` : ""} in all`));
  },
};

const xyControl: Control<XYKnob> = {
  wide: true,
  how: "Drag the point: across is the first axis, up is the second.",
  mount(host, k, value, ctx) {
    const c = canvas(host, 120, "pad xy");
    let [x, y] = value;
    const draw = () =>
      c.paint((g, w, hgt, css) => {
        grid(g, w, hgt, css);
        g.strokeStyle = color(css, "--faint");
        g.setLineDash([2, 3]);
        g.beginPath();
        g.moveTo(x * w, 0);
        g.lineTo(x * w, hgt);
        g.moveTo(0, (1 - y) * hgt);
        g.lineTo(w, (1 - y) * hgt);
        g.stroke();
        g.setLineDash([]);
        g.beginPath();
        g.arc(x * w, (1 - y) * hgt, 5, 0, Math.PI * 2);
        g.fillStyle = color(css, "--ink");
        g.fill();
      });
    draw();
    const at = (e: PointerEvent) => {
      const r = c.el.getBoundingClientRect();
      x = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * 100) / 100;
      y = Math.round(clamp(1 - (e.clientY - r.top) / r.height, 0, 1) * 100) / 100;
      draw();
    };
    c.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      at(e);
      drag(c.el, e, at, () => ctx.commit([x, y]));
    });
    const row = h("div", "ends");
    row.append(h("span", "", `→ ${k.axes[0]} ${x}`), h("span", "", `↑ ${k.axes[1]} ${y}`));
    host.append(row);
  },
};

export const controls: { [K in Knob["kind"]]: Control<Extract<Knob, { kind: K }>> } = {
  number: numberControl,
  pitch: pitchControl,
  range: rangeControl,
  "pitch-range": pitchRangeControl,
  choice: choiceControl,
  text: textControl,
  toggle: toggleControl,
  seed: seedControl,
  curve: curveControl,
  envelope: envelopeControl,
  "pitch-set": pitchSetControl,
  partials: partialsControl,
  weights: weightsControl,
  steps: stepsControl,
  proportions: proportionsControl,
  xy: xyControl,
};
