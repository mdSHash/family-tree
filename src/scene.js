// Tree "scenes": layout engines (organic tree, radial) and renderers (SVG for the app, canvas for export).
export const PALETTE = ['#2E7D6B', '#B5762A', '#8E4C8A', '#3D6FA8', '#B0473D', '#5B7F2E', '#C0577C', '#4E6A75', '#9A7B1E', '#2F8E9E'];
export const GENDER_COL = { m: '#2E6C8C', f: '#A04E6C' };

/* ---------- colours ---------- */
// first ancestor down the line who has more than one child: his children start the "branches"
export function branchPoint(t) { let n = t; while (n && !n.ref) { const k = (n.children || []).filter(c => !c.ref); if (k.length !== 1) break; n = k[0]; } return n; }
export function colorMap(forest, mode, P) {
  const map = new Map(); let bc = 0;
  const gcol = id => GENDER_COL[P(id)?.gender === 'f' ? 'f' : 'm'];
  const walk = (n, branch) => {
    if (!P(n.id)) return;
    const c = mode === 'gen' ? PALETTE[n.depth % PALETTE.length] : mode === 'branch' ? (branch < 0 ? '#6E6A5E' : PALETTE[branch % PALETTE.length]) : gcol(n.id);
    if (!map.has(n.id)) map.set(n.id, c);
    if (n.ref) return;
    for (const s of n.spouses) if (!map.has(s.id)) map.set(s.id, mode === 'gender' ? gcol(s.id) : c);
    const bp = n._bp;
    n.children.forEach(ch => walk(ch, bp && branch < 0 ? (ch.ref ? -1 : bc++) : branch));
  };
  for (const t of forest) { const bp = branchPoint(t); if (bp) bp._bp = true; walk(t, -1); if (bp) delete bp._bp; }
  return map;
}
export function legendFor(forest, mode, P) {
  if (mode === 'gen') { let max = 0; const w = n => { max = Math.max(max, n.depth); if (!n.ref) n.children.forEach(w); }; forest.forEach(w);
    return Array.from({ length: max + 1 }, (_, i) => ({ color: PALETTE[i % PALETTE.length], label: 'الجيل ' + (i + 1).toLocaleString('ar-EG') })); }
  if (mode === 'branch') { const out = []; let k = 0; for (const t of forest) { const bp = branchPoint(t); for (const c of (bp?.children || [])) { if (c.ref) continue; out.push({ color: PALETTE[k++ % PALETTE.length], label: 'فرع ' + firstName(P(c.id)?.name) }); } } return out; }
  return [{ color: GENDER_COL.m, label: 'ذكر' }, { color: GENDER_COL.f, label: 'أنثى' }];
}
const firstName = n => String(n || '').replace(/^(الحاج|الحاجة|الشيخ|الأستاذ|الاستاذ|د\.|أ\.)\s+/, '').split(' ')[0];

/* ---------- text measuring (shared by SVG + canvas) ---------- */
const mctx = document.createElement('canvas').getContext('2d');
export function wrapLines(text, max, font) {
  mctx.font = font; const ws = String(text || '').split(/\s+/); const lines = []; let cur = '';
  for (const w of ws) { const t = cur ? cur + ' ' + w : w; if (mctx.measureText(t).width <= max || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  if (lines.length > 2) { lines.length = 2; lines[1] += '…'; }
  return lines;
}
export const FONT = { name: '600 15px "Readex Pro", "Segoe UI", Tahoma, sans-serif', sname: '500 13px "Readex Pro", "Segoe UI", Tahoma, sans-serif', yr: '400 12px "Readex Pro", "Segoe UI", Tahoma, sans-serif' };

/* ---------- shared tidy placement ---------- */
function tidy(forest, slotW, spW, HG, TG) {
  const unitW = n => n.ref ? slotW : slotW + n.spouses.length * spW;
  const measure = n => { const uw = unitW(n); if (n.ref || !n.children.length) return (n.w = uw);
    n.cw = n.children.reduce((s, c) => s + measure(c), 0) + HG * (n.children.length - 1); return (n.w = Math.max(uw, n.cw)); };
  const place = (n, x) => { n.ux = x + (n.w - unitW(n)) / 2; if (!n.ref && n.children.length) { let cx = x + (n.w - n.cw) / 2; for (const c of n.children) { place(c, cx); cx += c.w + HG; } } };
  let x = 0; for (const t of forest) { measure(t); place(t, x); x += t.w + TG; }
  return Math.max(slotW, x - TG);
}

/* ---------- organic tree: root at the bottom, curved branches ---------- */
export function layoutTree(forest, P, colors) {
  const R = 40, RS = 30, SLOT = 150, SPW = 116, HG = 18, TG = 160, V = 210;
  const W = tidy(forest, SLOT, SPW, HG, TG);
  const nodes = [], links = [], leaves = [];
  let maxD = 0;
  const walk = (n) => { maxD = Math.max(maxD, n.depth); if (!n.ref) n.children.forEach(walk); }; forest.forEach(walk);
  const yOf = d => (maxD - d) * V + 60;
  const collect = n => {
    const cx = W - (n.ux + SLOT / 2), cy = yOf(n.depth), col = colors.get(n.id);
    nodes.push({ id: n.id, x: cx, y: cy, r: n.ref ? RS : R, kind: n.ref ? 'ref' : 'p', depth: n.depth, color: col });
    if (n.ref) return;
    n.spouses.forEach((s, i) => { const sx = W - (n.ux + SLOT + i * SPW + SPW / 2), sy = cy + 10;
      nodes.push({ id: s.id, x: sx, y: sy, r: RS, kind: s.dup ? 'dup' : 'sp', depth: n.depth, color: colors.get(s.id) || col });
      links.push({ t: 'm', d: [['M', cx - R + 4, cy + 4], ['Q', (cx + sx) / 2, cy + 26, sx + RS - 2, sy]], color: col, a: n.id, b: s.id }); });
    for (const c of n.children) {
      const kp = P(c.id); const o = kp.father === n.id ? kp.mother : kp.father; const si = n.spouses.findIndex(s => s.id === o);
      const ax = si < 0 ? cx : (cx + (W - (n.ux + SLOT + si * SPW + SPW / 2))) / 2, ay = cy - (si < 0 ? R - 6 : 6);
      const chx = W - (c.ux + SLOT / 2), chy = yOf(c.depth) + R + 34;
      const w = Math.max(3, 18 - n.depth * 2.8);
      links.push({ t: 'c', w, color: colors.get(c.id) || col, d: [['M', ax, ay], ['C', ax, ay - V * .5, chx, chy + V * .35, chx, chy]], a: n.id, b: c.id });
      const mx = (ax + chx) / 2, my = (ay + chy) / 2;
      leaves.push({ x: mx + 8, y: my, a: -0.7 }, { x: mx - 8, y: my + 10, a: 2.4 });
      collect(c);
    }
  };
  forest.forEach(collect);
  // trunk + ground under every root
  const deco = [];
  for (const t of forest) { const n = nodes.find(x => x.id === t.id && x.kind === 'p'); if (!n) continue;
    const by = n.y + R + 150;
    deco.push({ t: 'trunk', x: n.x, y: n.y + R - 4, by, w: 30, color: colors.get(t.id) }); }
  const H = (maxD) * V + 60 + R + 190;
  return finalize({ style: 'tree', nodes, links, leaves, deco, W, H });
}

/* ---------- radial: ancestor in the centre, generations in rings ---------- */
export function layoutRadial(forest, P, colors) {
  const NODE = 146, SPN = 108, R0 = 56, RS = 30, STEP0 = 250;
  const single = forest.length === 1;
  let maxD = 0; const md = n => { maxD = Math.max(maxD, n.depth); if (!n.ref) n.children.forEach(md); }; forest.forEach(md);
  // ring radius grows linearly; each node needs enough angle for its own width at its ring,
  // and at least the sum of its children. If it doesn't fit in 360°, push the rings out.
  let step = STEP0, need, total;
  const arcOf = n => NODE + ((n.ref ? 0 : n.spouses.length) * SPN);
  const calc = (n) => { const r = Math.max(1, n.depth) * step; const own = n.depth === 0 && single ? 0 : arcOf(n) / r;
    if (n.ref || !n.children.length) return (n.ang = own); return (n.ang = Math.max(own, n.children.reduce((a, c) => a + calc(c), 0))); };
  for (let it = 0; it < 4; it++) { total = forest.reduce((a, t) => a + calc(t), 0); if (total <= Math.PI * 2 * 0.97) break; step *= total / (Math.PI * 2 * 0.97); }
  const spread = (Math.PI * 2) / Math.max(total, 1e-6); // share the spare angle
  const nodes = [], links = []; let a0 = -Math.PI / 2;
  const place = (n, start) => {
    const span = n.ang * spread, mid = start + span / 2, r = n.depth * step;
    const rootCentre = n.depth === 0 && single;
    const x = rootCentre ? 0 : r * Math.cos(mid), y = rootCentre ? 0 : r * Math.sin(mid), col = colors.get(n.id);
    n._x = x; n._y = y; n._a = mid;
    nodes.push({ id: n.id, x, y, r: n.ref ? RS : n.depth === 0 ? R0 : 40, kind: n.ref ? 'ref' : 'p', depth: n.depth, color: col });
    if (n.ref) return;
    n.spouses.forEach((s, i) => {
      let sx, sy;
      if (rootCentre) { sx = -(i + 1) * (R0 + RS + 34); sy = 0; }
      else { const sa = mid + (SPN * (i + 1)) / Math.max(r, 1) * 0.95; sx = r * Math.cos(sa); sy = r * Math.sin(sa); }
      nodes.push({ id: s.id, x: sx, y: sy, r: RS, kind: s.dup ? 'dup' : 'sp', depth: n.depth, color: colors.get(s.id) || col });
      links.push({ t: 'm', d: [['M', x, y], ['L', sx, sy]], color: col, a: n.id, b: s.id });
    });
    // children share this node's span, centred
    const used = n.children.reduce((a, c) => a + c.ang * spread, 0); let s0 = mid - used / 2;
    for (const c of n.children) {
      place(c, s0); s0 += c.ang * spread;
      const rm = (n.depth + 0.55) * step;
      const d = rootCentre
        ? [['M', 0, 0], ['L', rm * Math.cos(c._a), rm * Math.sin(c._a)], ['L', c._x, c._y]]
        : [['M', x, y], ['L', rm * Math.cos(mid), rm * Math.sin(mid)], ['ARC', 0, 0, rm, mid, c._a], ['L', c._x, c._y]];
      links.push({ t: 'c', w: Math.max(2, 7 - n.depth * 1.1), color: colors.get(c.id) || col, d, a: n.id, b: c.id });
    }
  };
  for (const t of forest) { place(t, a0); a0 += t.ang * spread; }
  const rings = Array.from({ length: maxD }, (_, i) => (i + 1) * step);
  return finalize({ style: 'radial', nodes, links, rings, W: 0, H: 0 });
}

/* ---------- classic cards (from the app's existing layout) ---------- */
export function classicScene(L, colors) {
  const nodes = L.cards.map(c => ({ id: c.id, x: c.x + 74, y: c.y + 89, w: 148, h: 178, kind: c.kind, depth: c.depth, color: colors.get(c.id) }));
  const links = L.links.map(l => l.t === 'm' ? { t: 'm', d: [['M', l.x1, l.y], ['L', l.x2, l.y]] } : { t: 'c', w: 2, d: [['M', l.ax, l.ay], ['L', l.ax, l.by], ['L', l.cx, l.by], ['L', l.cx, l.cy]] });
  return finalize({ style: 'classic', nodes, links, W: L.W, H: L.H });
}

/* normalise to a bounding box starting at 0,0 (with room for labels) */
function finalize(sc) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of sc.nodes) {
    const hw = n.w ? n.w / 2 : Math.max(n.r, 74), top = n.h ? n.h / 2 : n.r, bot = n.h ? n.h / 2 : n.r + 64;
    minX = Math.min(minX, n.x - hw); maxX = Math.max(maxX, n.x + hw); minY = Math.min(minY, n.y - top); maxY = Math.max(maxY, n.y + bot);
  }
  for (const d of sc.deco || []) maxY = Math.max(maxY, d.by + 20);
  if (!isFinite(minX)) { minX = minY = 0; maxX = maxY = 100; }
  const pad = 20, ox = -minX + pad, oy = -minY + pad;
  const sh = p => { p.x += ox; p.y += oy; };
  sc.nodes.forEach(sh); (sc.leaves || []).forEach(sh);
  for (const d of sc.deco || []) { d.x += ox; d.y += oy; d.by += oy; }
  for (const l of sc.links) for (const seg of l.d) {
    if (seg[0] === 'ARC') { seg[1] += ox; seg[2] += oy; }
    else for (let i = 1; i < seg.length; i += 2) { seg[i] += ox; seg[i + 1] += oy; }
  }
  if (sc.rings) sc.center = { x: ox, y: oy };
  sc.W = maxX - minX + pad * 2; sc.H = maxY - minY + pad * 2;
  sc.pos = new Map(); for (const n of sc.nodes) if (n.kind === 'p' || (n.kind === 'sp' && !sc.pos.has(n.id))) sc.pos.set(n.id, n);
  return sc;
}

/* ---------- path helpers ---------- */
function svgPath(d) {
  let s = '', cx = 0, cy = 0;
  for (const seg of d) {
    const [k] = seg;
    if (k === 'ARC') { const [, ox, oy, r, a0, a1] = seg; const x = ox + r * Math.cos(a1), y = oy + r * Math.sin(a1); const sweep = a1 > a0 ? 1 : 0; const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0; s += `A${r} ${r} 0 ${large} ${sweep} ${x.toFixed(1)} ${y.toFixed(1)}`; cx = x; cy = y; }
    else { s += k + seg.slice(1).map(v => v.toFixed(1)).join(' '); cx = seg[seg.length - 2]; cy = seg[seg.length - 1]; }
  }
  return s;
}
export function tracePath(g, d) {
  g.beginPath();
  for (const seg of d) {
    const [k] = seg;
    if (k === 'M') g.moveTo(seg[1], seg[2]);
    else if (k === 'L') g.lineTo(seg[1], seg[2]);
    else if (k === 'Q') g.quadraticCurveTo(seg[1], seg[2], seg[3], seg[4]);
    else if (k === 'C') g.bezierCurveTo(seg[1], seg[2], seg[3], seg[4], seg[5], seg[6]);
    else if (k === 'ARC') g.arc(seg[1], seg[2], seg[3], seg[4], seg[5], seg[5] < seg[4]);
  }
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- SVG (in-app) for tree + radial ---------- */
export function renderSVG(sc, { P, img, yearsTxt, sel, hl, theme }) {
  const parts = [];
  if (sc.rings) for (const r of sc.rings) parts.push(`<circle cx="${sc.center.x}" cy="${sc.center.y}" r="${r}" class="ring"/>`);
  for (const d of sc.deco || []) parts.push(`<path class="trunk" style="--c:${d.color}" d="M${d.x - 7} ${d.y}C${d.x - 9} ${d.by - 60} ${d.x - 22} ${d.by - 14} ${d.x - 46} ${d.by}H${d.x + 46}C${d.x + 22} ${d.by - 14} ${d.x + 9} ${d.by - 60} ${d.x + 7} ${d.y}Z"/><ellipse class="ground" cx="${d.x}" cy="${d.by + 2}" rx="120" ry="10"/>`);
  for (const l of sc.links) {
    const on = hl.size && hl.has(l.a) && hl.has(l.b);
    parts.push(`<path class="lnk ${l.t}${on ? ' hl' : ''}" style="--c:${l.color || 'var(--line)'};--w:${l.w || 2}px" d="${svgPath(l.d)}"/>`);
  }
  for (const lf of sc.leaves || []) parts.push(`<ellipse class="leaf" cx="${lf.x.toFixed(1)}" cy="${lf.y.toFixed(1)}" rx="9" ry="4.2" transform="rotate(${(lf.a * 57.3).toFixed(0)} ${lf.x.toFixed(1)} ${lf.y.toFixed(1)})"/>`);
  for (const n of sc.nodes) {
    const p = P(n.id); if (!p) continue;
    const small = n.kind !== 'p', fN = small ? FONT.sname : FONT.name;
    const lines = wrapLines(p.name, small ? 112 : 136, fN);
    const yt = yearsTxt(p);
    const cls = ['nd', p.gender === 'f' ? 'f' : 'm', p.deceased ? 'dec' : '', sel === n.id ? 'sel' : '', hl.has(n.id) ? 'hl' : '', (n.kind === 'ref' || n.kind === 'dup') ? 'ghost' : ''].join(' ');
    const cid = 'c' + n.id + n.kind;
    parts.push(`<g class="${cls}" data-id="${esc(n.id)}" style="--c:${n.color}" transform="translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})">
      <circle r="${n.r + 7}" class="halo"/><clipPath id="${esc(cid)}"><circle r="${n.r}"/></clipPath>
      <image href="${esc(img(p))}" x="${-n.r}" y="${-n.r}" width="${n.r * 2}" height="${n.r * 2}" clip-path="url(#${esc(cid)})" preserveAspectRatio="xMidYMid slice"/>
      <circle r="${n.r}" class="ringc"/>
      ${lines.map((ln, i) => `<text y="${n.r + 22 + i * (small ? 17 : 19)}" class="${small ? 'sn' : 'nn'}">${esc(ln)}</text>`).join('')}
      ${yt ? `<text y="${n.r + 22 + lines.length * (small ? 17 : 19) + 1}" class="yy">${esc(yt)}</text>` : ''}
    </g>`);
  }
  return parts.join('');
}

/* ---------- canvas renderer (export/poster) ---------- */
export function drawScene(g, sc, { P, imgOf, yearsTxt, theme }) {
  const T = theme;
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (sc.rings) { g.save(); g.beginPath(); g.rect(0, 0, sc.W, sc.H); g.clip(); g.strokeStyle = T.ring; g.lineWidth = 1.5; g.setLineDash([3, 9]); for (const r of sc.rings) { g.beginPath(); g.arc(sc.center.x, sc.center.y, r, 0, Math.PI * 2); g.stroke(); } g.setLineDash([]); g.restore(); }
  for (const d of sc.deco || []) {
    g.fillStyle = T.trunk; g.beginPath(); g.moveTo(d.x - 7, d.y); g.bezierCurveTo(d.x - 9, d.by - 60, d.x - 22, d.by - 14, d.x - 46, d.by); g.lineTo(d.x + 46, d.by); g.bezierCurveTo(d.x + 22, d.by - 14, d.x + 9, d.by - 60, d.x + 7, d.y); g.closePath(); g.fill();
    g.fillStyle = T.ground; g.beginPath(); g.ellipse(d.x, d.by + 2, 120, 10, 0, 0, Math.PI * 2); g.fill();
  }
  for (const l of sc.links) {
    tracePath(g, l.d);
    if (sc.style === 'tree' && l.t === 'c') { g.strokeStyle = T.branch(l.color); g.lineWidth = l.w; }
    else if (l.t === 'm') { g.strokeStyle = T.accent; g.lineWidth = 2.5; }
    else { g.strokeStyle = sc.style === 'radial' ? T.tint(l.color) : T.line; g.lineWidth = sc.style === 'radial' ? l.w : 2; }
    g.stroke();
  }
  if (sc.leaves) { for (const lf of sc.leaves) { g.save(); g.translate(lf.x, lf.y); g.rotate(lf.a); g.fillStyle = T.leaf; g.beginPath(); g.ellipse(0, 0, 9, 4.2, 0, 0, Math.PI * 2); g.fill(); g.restore(); } }
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const n of sc.nodes) {
    const p = P(n.id); if (!p) continue;
    const im = imgOf(p), ghost = n.kind === 'ref' || n.kind === 'dup';
    if (sc.style === 'classic') { drawCard(g, n, p, im, yearsTxt, T, ghost); continue; }
    g.save(); g.shadowColor = T.shadow; g.shadowBlur = 10; g.shadowOffsetY = 2;
    g.beginPath(); g.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2); g.fillStyle = T.halo; g.fill(); g.restore();
    if (im) { g.save(); g.beginPath(); g.arc(n.x, n.y, n.r, 0, Math.PI * 2); g.clip(); if (p.deceased) g.filter = 'grayscale(1)'; g.drawImage(im, n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); g.restore(); }
    g.beginPath(); g.arc(n.x, n.y, n.r + 1, 0, Math.PI * 2); g.strokeStyle = p.deceased ? T.dec : n.color; g.lineWidth = 3.5; if (ghost) g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
    const small = n.kind !== 'p'; const f = small ? FONT.sname : FONT.name; g.font = f; g.fillStyle = T.ink;
    const lines = wrapLines(p.name, small ? 112 : 136, f); lines.forEach((ln, i) => g.fillText(ln, n.x, n.y + n.r + 22 + i * (small ? 17 : 19)));
    const yt = yearsTxt(p); if (yt) { g.font = FONT.yr; g.fillStyle = T.muted; g.fillText(yt, n.x, n.y + n.r + 22 + lines.length * (small ? 17 : 19) + 1); }
  }
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawCard(g, n, p, im, yearsTxt, T, ghost) {
  const x = n.x - n.w / 2, y = n.y - n.h / 2;
  g.save(); g.shadowColor = T.shadow; g.shadowBlur = 12; g.shadowOffsetY = 3; rr(g, x, y, n.w, n.h, 18); g.fillStyle = T.card; g.fill(); g.restore();
  g.save(); rr(g, x, y, n.w, n.h, 18); g.clip(); g.fillStyle = p.deceased ? T.dec : n.color; g.fillRect(x, y, n.w, 6); g.restore();
  rr(g, x, y, n.w, n.h, 18); g.strokeStyle = T.border; g.lineWidth = 1.5; if (ghost) g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
  const cx = n.x, cy = y + 16 + 34;
  if (im) { g.save(); g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.clip(); if (p.deceased) g.filter = 'grayscale(1)'; g.drawImage(im, cx - 34, cy - 34, 68, 68); g.restore(); }
  g.beginPath(); g.arc(cx, cy, 35, 0, Math.PI * 2); g.strokeStyle = p.deceased ? T.dec : n.color; g.lineWidth = 3; g.stroke();
  g.fillStyle = T.ink; g.font = FONT.name; wrapLines(p.name, n.w - 16, FONT.name).forEach((ln, i) => g.fillText(ln, cx, y + 112 + i * 20));
  const yt = yearsTxt(p); if (yt) { g.fillStyle = T.muted; g.font = FONT.yr; g.fillText(yt, cx, y + n.h - 14); }
}
