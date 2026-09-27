// The reusable controls of the knob panel, one per knob kind (src/sketch/knobs.ts). Each draws
// itself into a host element and calls `commit` with a new value when a change is finished (a drag
// let go, Enter, a click). Values shown while dragging are not sent.

import { spell } from "../../score/pitch.ts";
import {
  intervalVector,
  primeForm,
  type ChoiceKnob,
  type CurveKnob,
  type EnvelopeKnob,
  type HeatmapKnob,
  type Knob,
  type LanesKnob,
  type LatticeKnob,
  type MarkersKnob,
  type VectorSetKnob,
  type Knobs,
  type NumberKnob,
  type PartialsKnob,
  type PitchKnob,
  type PitchRangeKnob,
  type PitchSetKnob,
  type ProportionsKnob,
  type RangeKnob,
  type SeedKnob,
  type StepsKnob,
  type TextKnob,
  type ToggleKnob,
  type Value,
  type WeightsKnob,
  type XYKnob,
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

/** Interval-class vector of pitch classes, when they are all semitones (none in 24ths). */
const vectorOf = (set: number[]) => (set.every(Number.isInteger) ? intervalVector(set) : undefined);

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
    const iv = vectorOf(on);
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

//==============================================================================
// Time and form: markers, lanes

/** Units → x on a band (percent). */
const pct = (units: number, length: number) => `${(units / length) * 100}%`;

/** Ticks under a timeline: every unit, heavier every 4. */
function ticks(length: number): HTMLElement {
  const row = h("div", "ticks");
  for (let i = 0; i <= length; i++) {
    const t = h("span", i % 4 === 0 ? "tick major" : "tick");
    t.style.left = pct(i, length);
    row.append(t);
  }
  return row;
}

const markersControl: Control<MarkersKnob> = {
  wide: true,
  how: "Click the band to add a mark; drag a mark to move it; double-click a mark to remove it. Marks snap to whole units.",
  mount(host, k, value, ctx) {
    let marks = [...value].sort((a, b) => a - b);
    const band = h("div", "timeline");
    const draw = () => {
      band.innerHTML = "";
      band.append(ticks(k.length));
      marks.forEach((m, i) => {
        const el = h("div", "mark");
        el.style.left = pct(m, k.length);
        el.dataset.i = String(i);
        el.append(h("span", "mark-label", String.fromCharCode(66 + i)));
        el.title = `${m}${k.unit ? ` ${k.unit}` : ""}`;
        band.append(el);
      });
    };
    draw();
    const unitAt = (e: MouseEvent) => {
      const r = band.getBoundingClientRect();
      return clamp(Math.round(((e.clientX - r.left) / r.width) * k.length), 1, k.length - 1);
    };
    const commit = () => ctx.commit([...new Set(marks)].sort((a, b) => a - b));
    band.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const onMark = (e.target as HTMLElement).closest<HTMLElement>(".mark");
      let i: number;
      if (onMark) i = Number(onMark.dataset.i);
      else {
        marks.push(unitAt(e));
        i = marks.length - 1;
        draw();
      }
      drag(
        band,
        e,
        (m) => {
          marks[i] = unitAt(m);
          draw();
        },
        commit,
      );
    });
    band.addEventListener("dblclick", (e) => {
      const onMark = (e.target as HTMLElement).closest<HTMLElement>(".mark");
      if (!onMark) return;
      marks = marks.filter((_, j) => j !== Number(onMark.dataset.i));
      draw();
      commit();
    });
    host.append(band);
    const starts = [0, ...marks.sort((a, b) => a - b)];
    host.append(
      h(
        "div",
        "ends",
        starts
          .map((s, i) => `${String.fromCharCode(65 + i)} ${s}`)
          .join(" · ")
          .concat(`  (of ${k.length}${k.unit ? ` ${k.unit}` : ""})`),
      ),
    );
  },
};

const lanesControl: Control<LanesKnob> = {
  wide: true,
  how: "Click a segment to change it to the next option (Shift: the previous). Double-click to cut a segment in two. Drag a boundary to move it; drag it onto the next one to remove a segment.",
  mount(host, k, value, ctx) {
    let segs = [...value].map((s) => [...s] as [number, string]).sort((a, b) => a[0] - b[0]);
    const band = h("div", "lanes");
    const endOf = (i: number) => (i + 1 < segs.length ? segs[i + 1]![0] : k.length);
    const draw = () => {
      band.innerHTML = "";
      segs.forEach(([start, option], i) => {
        const seg = h("div", `lane o${k.options.indexOf(option) % 6}`, option);
        seg.style.left = pct(start, k.length);
        seg.style.width = pct(endOf(i) - start, k.length);
        seg.dataset.i = String(i);
        seg.title = `${option}: ${start}–${endOf(i)}${k.unit ? ` ${k.unit}` : ""}`;
        band.append(seg);
        if (i > 0) {
          const edge = h("div", "lane-edge");
          edge.style.left = pct(start, k.length);
          edge.dataset.i = String(i);
          band.append(edge);
        }
      });
      band.append(ticks(k.length));
    };
    draw();
    const unitAt = (e: MouseEvent) => {
      const r = band.getBoundingClientRect();
      return clamp(Math.round(((e.clientX - r.left) / r.width) * k.length), 0, k.length);
    };
    /** Drops empty segments and joins neighbours with the same option. */
    const tidy = () => {
      const out: [number, string][] = [];
      segs.forEach((s, i) => {
        if (endOf(i) <= s[0]) return;
        if (out.at(-1)?.[1] === s[1]) return;
        out.push(s);
      });
      if (out[0]) out[0][0] = 0;
      segs = out.length ? out : [[0, k.options[0]!]];
    };
    band.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const edge = (e.target as HTMLElement).closest<HTMLElement>(".lane-edge");
      if (edge) {
        const i = Number(edge.dataset.i);
        drag(
          band,
          e,
          (m) => {
            segs[i]![0] = clamp(unitAt(m), segs[i - 1]![0], endOf(i));
            draw();
          },
          () => {
            tidy();
            ctx.commit(segs.map((s) => [...s] as [number, string]));
          },
        );
        return;
      }
      const seg = (e.target as HTMLElement).closest<HTMLElement>(".lane");
      if (!seg) return;
      const i = Number(seg.dataset.i);
      drag(
        band,
        e,
        () => {},
        (moved) => {
          if (moved || e.detail > 1) return;
          const at = k.options.indexOf(segs[i]![1]);
          const n = k.options.length;
          segs[i]![1] = k.options[(at + (e.shiftKey ? n - 1 : 1)) % n]!;
          tidy();
          ctx.commit(segs.map((s) => [...s] as [number, string]));
        },
      );
    });
    band.addEventListener("dblclick", (e) => {
      const seg = (e.target as HTMLElement).closest<HTMLElement>(".lane");
      if (!seg) return;
      const i = Number(seg.dataset.i);
      const at = unitAt(e);
      if (at <= segs[i]![0] || at >= endOf(i)) return;
      // The new half takes the next option, so the cut shows at once.
      const next = k.options[(k.options.indexOf(segs[i]![1]) + 1) % k.options.length]!;
      segs.splice(i + 1, 0, [at, next]);
      tidy();
      ctx.commit(segs.map((s) => [...s] as [number, string]));
    });
    host.append(band);
    host.append(h("div", "ends", `0 → ${k.length}${k.unit ? ` ${k.unit}` : ""}`));
  },
};

//==============================================================================
// Pitch structures: vector → set, lattice

/** Every prime form of 12-note equal temperament, with its interval vector (made once). */
let primes: { set: number[]; vector: number[] }[] | undefined;
function allPrimes(): { set: number[]; vector: number[] }[] {
  if (primes) return primes;
  const seen = new Map<string, number[]>();
  for (let mask = 1; mask < 4096; mask++) {
    const set: number[] = [];
    for (let p = 0; p < 12; p++) if (mask & (1 << p)) set.push(p);
    const prime = primeForm(set);
    seen.set(prime.join(","), prime);
  }
  primes = [...seen.values()]
    .map((set) => ({ set, vector: intervalVector(set) }))
    .sort((a, b) => a.set.length - b.set.length || a.set.join(",").localeCompare(b.set.join(",")));
  return primes;
}

const vectorSetControl: Control<VectorSetKnob> = {
  wide: true,
  how: "Set any of the six interval-class counts (leave one empty for any), then pick a set from those that match. The set is shown in prime form, starting on 0.",
  mount(host, _k, value, ctx) {
    const current = primeForm(value);
    const want: (number | undefined)[] = intervalVector(current);
    const box = h("div", "vector");
    const head = h("div", "vector-head");
    head.append(
      h("span", "set", `{${value.join(" ")}}`),
      h("span", "muted", `<${intervalVector(value).join("")}>`),
    );
    const inputs = h("div", "vector-inputs");
    const results = h("div", "vector-results");
    const list = () => {
      results.innerHTML = "";
      const found = allPrimes().filter((p) =>
        p.vector.every((c, i) => want[i] === undefined || want[i] === c),
      );
      const shown = found.slice(0, 60);
      for (const p of shown) {
        const b = h("button", "chip-set", `{${p.set.join(" ")}}`);
        b.type = "button";
        b.title = `${p.set.length} notes, vector <${p.vector.join("")}>`;
        if (p.set.join(",") === current.join(",")) b.classList.add("on");
        b.addEventListener("click", () => ctx.commit(p.set));
        results.append(b);
      }
      if (found.length === 0) results.append(h("span", "muted", "No set has this vector"));
      else if (found.length > shown.length)
        results.append(
          h("span", "muted", `… ${found.length - shown.length} more; set more counts`),
        );
    };
    for (let i = 0; i < 6; i++) {
      const cell = h("label", "ic");
      const input = h("input");
      input.value = want[i] === undefined ? "" : String(want[i]);
      input.placeholder = "any";
      input.inputMode = "numeric";
      input.setAttribute("aria-label", `interval class ${i + 1}`);
      input.addEventListener("input", () => {
        const n = input.value.trim() === "" ? undefined : Number(input.value);
        want[i] = n !== undefined && Number.isInteger(n) && n >= 0 ? n : undefined;
        list();
      });
      input.addEventListener("keydown", (e) => e.stopPropagation());
      cell.append(h("span", "", `ic${i + 1}`), input);
      inputs.append(cell);
    }
    list();
    box.append(head, inputs, results);
    host.append(box);
  },
};

const latticeControl: Control<LatticeKnob> = {
  wide: true,
  how: "Click nodes to add or remove them. Across is one interval, up another; the centre is ringed.",
  mount(host, k, value, ctx) {
    const on = new Set(value.map(([x, y]) => `${x},${y}`));
    const centre = k.centre ? ctx.values[k.centre] : undefined;
    const [cols, rows] = k.size;
    const x0 = -Math.floor(cols / 2);
    const y0 = -Math.floor(rows / 2);
    const cell = 34;
    const w = cols * cell;
    const hgt = rows * cell;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${hgt}`);
    svg.setAttribute("class", "lattice");
    const at = (x: number, y: number): [number, number] => [
      (x - x0 + 0.5) * cell,
      hgt - (y - y0 + 0.5) * cell,
    ];
    // Lines between neighbouring chosen nodes show the shape.
    for (let x = x0; x < x0 + cols; x++)
      for (let y = y0; y < y0 + rows; y++) {
        if (!on.has(`${x},${y}`)) continue;
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [1, -1],
        ] as const) {
          if (!on.has(`${x + dx},${y + dy}`)) continue;
          const line = document.createElementNS(ns, "line");
          const [ax, ay] = at(x, y);
          const [bx, by] = at(x + dx, y + dy);
          line.setAttribute("x1", String(ax));
          line.setAttribute("y1", String(ay));
          line.setAttribute("x2", String(bx));
          line.setAttribute("y2", String(by));
          line.setAttribute("class", "edge");
          svg.append(line);
        }
      }
    for (let x = x0; x < x0 + cols; x++)
      for (let y = y0; y < y0 + rows; y++) {
        const key = `${x},${y}`;
        const [cx, cy] = at(x, y);
        const g = document.createElementNS(ns, "g");
        g.setAttribute("class", on.has(key) ? "node on" : "node");
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "checkbox");
        g.setAttribute("aria-checked", String(on.has(key)));
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", String(cx));
        circle.setAttribute("cy", String(cy));
        circle.setAttribute("r", "13");
        if (x === 0 && y === 0) circle.setAttribute("class", "centre");
        const label = document.createElementNS(ns, "text");
        label.setAttribute("x", String(cx));
        label.setAttribute("y", String(cy + 3.5));
        const semis = x * k.axes[0] + y * k.axes[1];
        label.textContent =
          typeof centre === "number"
            ? nameOf(centre + semis).replace(/-?\d+$/, "")
            : `${semis >= 0 ? "+" : ""}${semis}`;
        g.append(circle, label);
        const toggle = () => {
          const next = new Set(on);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          ctx.commit([...next].map((s) => s.split(",").map(Number) as [number, number]));
        };
        g.addEventListener("click", toggle);
        g.addEventListener("keydown", (e) => {
          if ((e as KeyboardEvent).key === "Enter") toggle();
        });
        svg.append(g);
      }
    host.append(svg);
    host.append(h("div", "ends", `→ +${k.axes[0]} st   ↑ +${k.axes[1]} st   ${on.size} nodes`));
  },
};

//==============================================================================
// A painted field

const heatmapControl: Control<HeatmapKnob> = {
  wide: true,
  how: "Pick a strength on the right, then click or drag across the cells to paint it. Time runs left to right.",
  mount(host, k, value, ctx) {
    const field = value.map((r) => [...r]);
    let brush = 1;
    const box = h("div", "heat");
    const grid = h("div", "heat-grid");
    grid.style.setProperty("--cols", String(k.columns));
    const cells: HTMLElement[][] = [];
    k.rows.forEach((label, r) => {
      grid.append(h("span", "hl", label));
      cells.push([]);
      for (let c = 0; c < k.columns; c++) {
        const cell = h("span", "hc");
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.style.setProperty("--v", String(field[r]![c]));
        cells[r]!.push(cell);
        grid.append(cell);
      }
    });
    const brushes = h("div", "brushes");
    for (const b of [0, 0.25, 0.5, 0.75, 1]) {
      const sw = h("button", b === brush ? "swatch on" : "swatch");
      sw.type = "button";
      sw.title = b === 0 ? "Erase" : `Paint ${b}`;
      sw.style.setProperty("--v", String(b));
      sw.addEventListener("click", () => {
        brush = b;
        for (const other of brushes.children) other.classList.toggle("on", other === sw);
      });
      brushes.append(sw);
    }
    const paint = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el?.classList.contains("hc")) return;
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      field[r]![c] = brush;
      el.style.setProperty("--v", String(brush));
    };
    grid.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      paint(e);
      drag(grid, e, paint, () => ctx.commit(field.map((r) => [...r])));
    });
    box.append(grid, brushes);
    host.append(box, h("div", "ends", "time →"));
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
  markers: markersControl,
  lanes: lanesControl,
  "vector-set": vectorSetControl,
  lattice: latticeControl,
  heatmap: heatmapControl,
};
