// Shared helpers for the poster pages.
export const W = 1080;
export const H = 1350;
export const PRODUCT = '../assets/product-cutout.png';

// Deterministic PRNG (mulberry32) so every render is identical.
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function fonts(specs = []) {
  await Promise.all(specs.map((s) => document.fonts.load(s, 'אבג Abc')));
  await document.fonts.ready;
}

export function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 4x4 Bayer matrix, normalised to [0, 1).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16;

// Canvas sized for the page's device pixel ratio, drawn in CSS pixels.
export function hiDpiCanvas(el, w, h) {
  const dpr = window.devicePixelRatio || 1;
  el.width = Math.round(w * dpr);
  el.height = Math.round(h * dpr);
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  const ctx = el.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, dpr };
}

// Scale an element's font-size so its text exactly fills `width`.
export function fitWidth(el, width) {
  const size = parseFloat(getComputedStyle(el).fontSize);
  const w = el.getBoundingClientRect().width;
  el.style.fontSize = `${(size * width) / w}px`;
}

export function done() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}
