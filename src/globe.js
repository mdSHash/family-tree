// "الكورة": the family as a rotating ball of dots. The eldest ancestor sits in the centre,
// each generation on a wider shell; branches keep together; farther generations fade.
const GOLD = Math.PI * (3 - Math.sqrt(5));

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function basis(u) { const t = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const a = norm(cross(u, t)); const b = cross(u, a); return [a, b]; }
function rotTowards(u, beta, az) { const [a, b] = basis(u); const cb = Math.cos(beta), sb = Math.sin(beta), ca = Math.cos(az), sa = Math.sin(az);
  return norm([u[0] * cb + (a[0] * ca + b[0] * sa) * sb, u[1] * cb + (a[1] * ca + b[1] * sa) * sb, u[2] * cb + (a[2] * ca + b[2] * sa) * sb]); }
function fib(k) { if (k === 1) return [[0, -1, 0]]; if (k === 2) return [[-1, 0, 0], [1, 0, 0]];
  return Array.from({ length: k }, (_, i) => { const y = 1 - (i + 0.5) * 2 / k, r = Math.sqrt(1 - y * y), t = i * GOLD; return [Math.cos(t) * r, y, Math.sin(t) * r]; }); }

export class Globe {
  constructor(canvas, { onPick }) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.onPick = onPick;
    this.yaw = 0.6; this.pitch = -0.35; this.zoom = 1; this.sel = null; this.pts = []; this.links = [];
    this.auto = !matchMedia('(prefers-reduced-motion: reduce)').matches; this.idleAt = 0; this.running = false;
    this.ptrs = new Map(); this.bind();
  }
  setData({ forest, P, colors, theme }) {
    this.P = P; this.theme = theme; const pts = [], links = [], byId = new Map();
    const SH = 130;
    // a single-child line of ancestors forms a short "spine" through the centre;
    // the family opens up into the ball from the first ancestor with several children.
    let k0 = 0; { let n = forest[0]; while (n && !n.ref) { const k = (n.children || []).filter(c => !c.ref); if (k.length !== 1) break; n = k[0]; k0++; } }
    this.k0 = k0;
    const add = (n, dir, cone, full) => {
      const p = P(n.id); if (!p) return null;
      const eff = n.depth - k0, r = Math.max(0, eff) * SH;
      const pos = eff <= 0 ? [0, eff * 46, 0] : [dir[0] * r, dir[1] * r, dir[2] * r];
      const pt = { id: n.id, pos, depth: n.depth, eff, color: colors.get(n.id) || '#5C6B63', kind: n.ref ? 'ref' : 'p', parent: null, kids: [] };
      pts.push(pt); if (!byId.has(n.id)) byId.set(n.id, pt);
      if (n.ref) return pt;
      (n.spouses || []).forEach((s, i) => {
        const sp = eff <= 0 ? [22 + i * 16, pos[1], 0] : (() => { const o = rotTowards(dir, 0.07 + i * 0.05, 1.2 + i); return [o[0] * r, o[1] * r, o[2] * r]; })();
        const q = { id: s.id, pos: sp, depth: n.depth, eff, color: colors.get(s.id) || pt.color, kind: 'sp', parent: pt, kids: [] };
        pts.push(q); if (!byId.has(s.id)) byId.set(s.id, q); links.push({ a: pt, b: q, m: true }); });
      const kids = n.children || [], m = kids.length;
      const opening = eff >= 0 && full; // this node fans out over the whole ball
      const dirs = opening ? fib(m) : kids.map((_, i) => m === 1 ? dir : rotTowards(dir, cone * 0.75 * Math.sqrt((i + 0.5) / m), i * GOLD));
      const childCone = opening ? Math.min(1.1, Math.PI / Math.max(1.6, Math.sqrt(m) * 1.4)) : Math.max(0.07, cone * 0.62 / Math.sqrt(Math.max(1, m)));
      kids.forEach((c, i) => { const cp = add(c, dirs[i], childCone, opening ? false : full && eff < 0); if (cp) { cp.parent = pt; pt.kids.push(cp); links.push({ a: pt, b: cp }); } });
      return pt;
    };
    forest.forEach((t, i) => add(t, [0, -1, 0], 1.2, i === 0));
    // extra roots (unconnected families) sit on the first shell
    this.pts = pts; this.links = links; this.byId = byId;
    this.maxD = Math.max(1, ...pts.map(p => p.eff));
    this.draw();
  }
  setSelected(id) { this.sel = id; this.selSet = new Set(); const p = id && this.byId?.get(id);
    if (p) { const walk = q => { this.selSet.add(q.id); q.kids.forEach(walk); }; walk(p); let up = p.parent; while (up) { this.selSet.add(up.id); up = up.parent; } }
    this.draw(); }
  start() { if (this.running) return; this.running = true; const tick = () => { if (!this.running) return;
      if (this.auto && Date.now() - this.idleAt > 3500 && !this.ptrs.size) { this.yaw += 0.0025; this.draw(); }
      this.raf = requestAnimationFrame(tick); }; tick(); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  resize() { const r = this.cv.parentElement.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d); this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px'; this.dpr = d; this.draw(); }
  fit() { this.zoom = 1; this.draw(); }
  project() {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const W = this.cv.width, H = this.cv.height, R = (this.maxD + 0.6) * 130;
    const base = Math.min(W, H) * 0.46 / R * this.zoom, cam = R * 3.2;
    for (const p of this.pts) {
      let [x, y, z] = p.pos; const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const f = cam / (cam + z2); p.sx = W / 2 + x1 * base * f; p.sy = H / 2 + y2 * base * f; p.sz = z2; p.f = f; p.scale = base * f;
    }
    return R;
  }
  draw() {
    if (!this.cv.width || !this.pts.length) return;
    const g = this.g, T = this.theme, W = this.cv.width, H = this.cv.height, d = this.dpr || 1;
    g.clearRect(0, 0, W, H);
    const R = this.project();
    // faint shells
    const base = Math.min(W, H) * 0.46 / R * this.zoom;
    g.strokeStyle = T.ring; g.lineWidth = d;
    for (let k = 1; k <= this.maxD; k++) { g.beginPath(); g.arc(W / 2, H / 2, k * 130 * base, 0, Math.PI * 2); g.globalAlpha = 0.35; g.stroke(); }
    g.globalAlpha = 1;
    const hasSel = this.sel && this.selSet?.size;
    const zr = R * 1.0;
    const fade = p => { const front = 0.35 + 0.65 * (1 - (p.sz + zr) / (2 * zr)); const gen = 1 - (Math.max(0, p.eff) / (this.maxD + 1)) * 0.55; return Math.max(0.08, Math.min(1, front * gen)); };
    // links
    for (const l of this.links) {
      const on = hasSel && this.selSet.has(l.a.id) && this.selSet.has(l.b.id);
      g.globalAlpha = (hasSel ? (on ? 0.9 : 0.06) : 0.28) * Math.min(fade(l.a), fade(l.b)) * (on ? 1.4 : 1);
      g.strokeStyle = on ? l.b.color : T.line; g.lineWidth = (on ? 2.2 : 1) * d;
      g.beginPath(); g.moveTo(l.a.sx, l.a.sy); g.lineTo(l.b.sx, l.b.sy); g.stroke();
    }
    // dots, far to near
    const order = this.pts.slice().sort((a, b) => b.sz - a.sz);
    for (const p of order) {
      const isRoot = p.depth === 0 && p.kind === 'p';
      const on = !hasSel || this.selSet.has(p.id), a = fade(p) * (on ? 1 : 0.15);
      const rad = (isRoot ? 11 : p.kind === 'sp' ? 3.6 : p.eff <= 0 ? 7 : Math.max(3, 8 - p.eff * 0.8)) * d * Math.max(0.6, Math.min(1.8, p.f * this.zoom * 0.9));
      g.globalAlpha = a; g.fillStyle = isRoot ? T.accent : p.color;
      g.beginPath(); g.arc(p.sx, p.sy, rad, 0, Math.PI * 2); g.fill();
      if (p.id === this.sel) { g.globalAlpha = 1; g.strokeStyle = T.accent; g.lineWidth = 3 * d; g.beginPath(); g.arc(p.sx, p.sy, rad + 5 * d, 0, Math.PI * 2); g.stroke(); }
      p.rad = rad; p.alpha = a;
    }
    // labels: root, selection + its family, and big near dots when zoomed
    g.globalAlpha = 1; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'bottom';
    const labelled = new Set(); const want = [];
    for (const p of order.slice().reverse()) {
      const sel = p.id === this.sel, fam = hasSel && this.selSet.has(p.id) && (p.parent?.id === this.sel || p.id === this.sel || this.byId.get(this.sel)?.parent === p);
      const big = this.zoom > 1.5 && p.alpha > 0.55 && p.kind !== 'sp';
      if ((p.depth === 0 && p.kind === 'p') || sel || fam || big || (p.eff === 0 && p.kind === 'p') || (this.zoom > 1 && p.eff <= 1 && p.kind === 'p' && p.alpha > .5)) want.push(p);
    }
    const boxes = [];
    for (const p of want) {
      if (labelled.has(p.id)) continue; const name = this.P(p.id)?.name || ''; const fs = (p.id === this.sel ? 15 : 12.5) * d;
      g.font = `${p.id === this.sel ? 700 : 600} ${fs}px "Readex Pro", "Segoe UI", Tahoma, sans-serif`;
      const w = g.measureText(name).width, x = p.sx, y = p.sy - p.rad - 4 * d;
      const box = [x - w / 2 - 4 * d, y - fs - 2 * d, x + w / 2 + 4 * d, y + 2 * d];
      if (boxes.some(b => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3]) && p.id !== this.sel) continue;
      boxes.push(box); labelled.add(p.id);
      g.fillStyle = T.labelBg; g.globalAlpha = 0.88; g.beginPath(); g.roundRect ? g.roundRect(box[0], box[1], box[2] - box[0], box[3] - box[1], 6 * d) : g.rect(box[0], box[1], box[2] - box[0], box[3] - box[1]); g.fill();
      g.globalAlpha = 1; g.fillStyle = T.ink; g.fillText(name, x, y);
    }
  }
  pick(cx, cy) { const r = this.cv.getBoundingClientRect(), d = this.dpr || 1, x = (cx - r.left) * d, y = (cy - r.top) * d; let best = null, bd = 22 * d;
    for (const p of this.pts) { if (p.alpha < 0.12) continue; const dd = Math.hypot(p.sx - x, p.sy - y) - p.rad; if (dd < bd) { bd = dd; best = p; } } return best; }
  bind() {
    const cv = this.cv; let last = null, moved = false, pinch = null;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.idleAt = Date.now();
      if (this.ptrs.size === 1) { last = { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY }; moved = false; }
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.zoom }; moved = true; } });
    cv.addEventListener('pointermove', e => { if (!this.ptrs.has(e.pointerId)) return; this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.idleAt = Date.now();
      if (this.ptrs.size === 2 && pinch) { const [a, b] = [...this.ptrs.values()]; this.zoom = Math.min(5, Math.max(0.5, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); this.draw(); return; }
      if (last) { if (!moved && Math.hypot(e.clientX - last.ox, e.clientY - last.oy) > 6) moved = true;
        if (moved) { this.yaw += (e.clientX - last.x) * 0.008; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + (e.clientY - last.y) * 0.008)); this.draw(); }
        last.x = e.clientX; last.y = e.clientY; } });
    const end = e => { if (!this.ptrs.has(e.pointerId)) return; this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) pinch = null;
      if (!this.ptrs.size) { if (!moved && e.type === 'pointerup') { const p = this.pick(e.clientX, e.clientY); this.onPick(p ? p.id : null); } last = null; } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => { e.preventDefault(); this.idleAt = Date.now(); this.zoom = Math.min(5, Math.max(0.5, this.zoom * Math.exp(-e.deltaY * 0.0015))); this.draw(); }, { passive: false });
  }
  zoomBy(f) { this.idleAt = Date.now(); this.zoom = Math.min(5, Math.max(0.5, this.zoom * f)); this.draw(); }
}
