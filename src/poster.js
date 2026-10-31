// Poster export: a designed background + title around the tree, rendered in tiles and streamed into a PNG,
// so a big family exports sharp on phones too (no single giant canvas).
import { Zlib } from 'fflate';
import { drawScene } from './scene.js';

export const THEMES = {
  paper: { label: 'ورق قديم', bg: '#F4EEDF', bg2: '#E9DFC6', ink: '#2B241A', muted: '#6B5E48', line: '#9C8B6C', accent: '#A86E22', card: '#FFFDF7', border: '#DCCFB2', halo: '#FFFDF7', dec: '#7A746A', ring: 'rgba(120,100,70,.35)', trunk: '#7A5A3A', ground: 'rgba(110,90,60,.25)', leaf: 'rgba(94,128,60,.55)', shadow: 'rgba(60,40,10,.18)', frame: '#A88B57', title: '#4A3418', branch: c => mix(c, '#7A5A3A', .45), tint: c => mix(c, '#F4EEDF', .25) },
  forest: { label: 'أخضر ليلي', bg: '#14221D', bg2: '#0C1612', ink: '#EEF2EA', muted: '#A9B8AD', line: '#5C7468', accent: '#E0A653', card: '#1C2D27', border: '#2E443B', halo: '#1C2D27', dec: '#9C978E', ring: 'rgba(207,227,214,.18)', trunk: '#6B5236', ground: 'rgba(0,0,0,.35)', leaf: 'rgba(140,190,120,.45)', shadow: 'rgba(0,0,0,.45)', frame: '#C79A4A', title: '#F1D9A8', branch: c => mix(c, '#8A6A44', .35), tint: c => mix(c, '#14221D', .15) },
  clean: { label: 'أبيض', bg: '#FFFFFF', bg2: '#F2F5F1', ink: '#1C2A24', muted: '#5C6B63', line: '#94A79C', accent: '#A86E22', card: '#FFFFFF', border: '#D2DBD3', halo: '#FFFFFF', dec: '#6B6760', ring: 'rgba(92,107,99,.25)', trunk: '#8A6A4A', ground: 'rgba(92,107,99,.18)', leaf: 'rgba(80,140,90,.45)', shadow: 'rgba(28,42,36,.12)', frame: '#1F3A31', title: '#1F3A31', branch: c => mix(c, '#8A6A4A', .4), tint: c => c },
};
function mix(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join(''); }

export const QUALITY = [
  { id: 'hd', label: 'واضحة', scale: 1.4, max: 8000, hint: 'مناسبة لواتساب' },
  { id: 'xhd', label: 'عالية جداً', scale: 2.4, max: 14000, hint: 'تقرب وتشوف كل اسم' },
  { id: 'print', label: 'للطباعة', scale: 3.5, max: 20000, hint: 'لوحة كبيرة' },
];
// scale so names stay a readable size, capped so the file stays openable
export function posterDims(L, q, cap) { const s = Math.min(q.scale, (cap || q.max) / Math.max(L.W, L.H)); return { s, W: Math.round(L.W * s), H: Math.round(L.H * s) }; }

// layout of the poster around the scene, in scene units
export function posterLayout(sc, { title, subtitle, legend }) {
  const side = Math.max(sc.W, sc.H * 0.75);
  const pad = Math.min(280, Math.max(120, side * 0.045)), head = Math.min(600, Math.max(300, side * 0.08)), foot = 110;
  const legendH = legend?.length ? 100 : 0;
  return { W: sc.W + pad * 2, H: sc.H + pad * 2 + head + legendH + foot, pad, head, foot, legendH, ox: pad, oy: pad + head + legendH, title, subtitle, legend };
}

function drawBackdrop(g, L, T) {
  const { W, H } = L;
  const grad = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, T.bg); grad.addColorStop(1, T.bg2); g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // soft dotted texture
  const step = Math.max(26, Math.min(W, H) / 90); g.fillStyle = T.ring; g.globalAlpha = 0.35;
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) { g.beginPath(); g.arc(x, y, step * 0.04, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  // double frame with corner ornaments
  const m = L.pad * 0.38, m2 = m + L.pad * 0.08, lw = Math.max(3, L.pad * 0.025);
  g.strokeStyle = T.frame; g.lineWidth = lw; g.strokeRect(m, m, W - 2 * m, H - 2 * m);
  g.lineWidth = lw * 0.45; g.strokeRect(m2, m2, W - 2 * m2, H - 2 * m2);
  const cs = L.pad * 0.32;
  for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    g.save(); g.translate(cx, cy); g.scale(sx, sy); g.fillStyle = T.frame;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(cs, 0); g.quadraticCurveTo(cs * 0.35, cs * 0.35, 0, cs); g.closePath(); g.fill();
    g.beginPath(); g.arc(cs * 0.55, cs * 0.55, cs * 0.09, 0, Math.PI * 2); g.fill(); g.restore();
  }
}
function drawHeader(g, L, T, meta) {
  const cx = L.W / 2, top = L.pad + L.head * 0.12, size = L.head * 0.42;
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = T.title; g.font = `700 ${size}px "Aref Ruqaa", "Amiri", serif`; g.fillText(L.title, cx, top + size);
  // divider ornament
  const dy = top + size + L.head * 0.12, dw = Math.min(L.W * 0.32, size * 4.2);
  g.strokeStyle = T.frame; g.lineWidth = Math.max(2, size * 0.025);
  g.beginPath(); g.moveTo(cx - dw / 2, dy); g.lineTo(cx - size * 0.25, dy); g.moveTo(cx + size * 0.25, dy); g.lineTo(cx + dw / 2, dy); g.stroke();
  g.fillStyle = T.accent; g.save(); g.translate(cx, dy); g.rotate(Math.PI / 4); const ds = size * 0.11; g.fillRect(-ds, -ds, ds * 2, ds * 2); g.restore();
  const sub = L.subtitle || meta;
  if (sub) { g.fillStyle = T.muted; const fs = L.head * 0.12; g.font = `400 ${fs}px "Readex Pro", "Segoe UI", Tahoma, sans-serif`; g.fillText(sub, cx, dy + L.head * 0.24); }
  if (L.legend?.length) {
    const fs = L.legendH * 0.36; g.font = `500 ${fs}px "Readex Pro", "Segoe UI", Tahoma, sans-serif`;
    const items = L.legend.map(it => ({ ...it, w: g.measureText(it.label).width + fs * 1.6 }));
    const gap = fs * 1.4, total = items.reduce((s, i) => s + i.w, 0) + gap * (items.length - 1);
    let x = cx + total / 2; const y = L.pad + L.head + L.legendH * 0.55;
    g.textAlign = 'right';
    for (const it of items) { g.fillStyle = it.color; g.beginPath(); g.arc(x - fs * 0.45, y - fs * 0.32, fs * 0.42, 0, Math.PI * 2); g.fill(); g.fillStyle = T.ink; g.fillText(it.label, x - fs * 1.2, y); x -= it.w + gap; }
    g.textAlign = 'center';
  }
}
function drawFooter(g, L, T, foot) { g.fillStyle = T.muted; const fs = L.foot * 0.28; g.font = `400 ${fs}px "Readex Pro", "Segoe UI", Tahoma, sans-serif`; g.direction = 'rtl'; g.textAlign = 'center'; g.fillText(foot, L.W / 2, L.H - L.pad * 0.55); }

export function drawPoster(g, sc, L, T, ctx) {
  drawBackdrop(g, L, T); drawHeader(g, L, T, ctx.meta);
  g.save(); g.translate(L.ox, L.oy); drawScene(g, sc, { ...ctx, theme: T }); g.restore();
  drawFooter(g, L, T, ctx.foot);
}

/* ---------- tiled PNG encoder ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bufs) { let c = 0xFFFFFFFF; for (const b of bufs) for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) { const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, data.length); const t = new TextEncoder().encode(type); const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, crc32([t, data])); return [len, t, data, crc]; }

export async function renderPNG({ W, H, draw, onProgress }) {
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer); dv.setUint32(0, W); dv.setUint32(4, H); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  parts.push(...chunk('IHDR', ihdr));
  const idat = []; let pending = [], pendingLen = 0;
  const flushIdat = force => { if (!pendingLen || (!force && pendingLen < 1 << 20)) return; const buf = new Uint8Array(pendingLen); let o = 0; for (const p of pending) { buf.set(p, o); o += p.length; } idat.push(...chunk('IDAT', buf)); pending = []; pendingLen = 0; };
  const z = new Zlib({ level: 6 }); z.ondata = (d) => { pending.push(d); pendingLen += d.length; flushIdat(false); };
  const TW = Math.min(W, 4096), TH = Math.max(64, Math.min(512, Math.floor(8e6 / TW)));
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH; const g = cv.getContext('2d', { willReadFrequently: true });
  const rowLen = W * 3 + 1;
  for (let y0 = 0; y0 < H; y0 += TH) {
    const th = Math.min(TH, H - y0); const strip = new Uint8Array(rowLen * th);
    for (let r = 0; r < th; r++) strip[r * rowLen] = 0;
    for (let x0 = 0; x0 < W; x0 += TW) {
      const tw = Math.min(TW, W - x0);
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, TW, TH); g.translate(-x0, -y0); draw(g);
      const img = g.getImageData(0, 0, tw, th).data;
      for (let r = 0; r < th; r++) { let si = r * tw * 4, di = r * rowLen + 1 + x0 * 3; for (let c = 0; c < tw; c++) { strip[di++] = img[si++]; strip[di++] = img[si++]; strip[di++] = img[si++]; si++; } }
    }
    z.push(strip, false);
    onProgress?.(Math.min(1, (y0 + th) / H));
    await new Promise(r => setTimeout(r, 0)); // keep the UI alive
  }
  z.push(new Uint8Array(0), true); flushIdat(true);
  parts.push(...idat, ...chunk('IEND', new Uint8Array(0)));
  return new Blob(parts, { type: 'image/png' });
}
