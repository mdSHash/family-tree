// Illustrated default avatars: boy/girl × child/adult/elder, flat silhouette style.
const SKIN = '#EBC7A3', SKIN_D = '#D9AE86';
const PAL = {
  m: { bg: '#DCEAF1', cloth: '#2E6C8C', cloth2: '#3F86AA', hair: '#2A2622' },
  f: { bg: '#F6E2EA', cloth: '#A04E6C', cloth2: '#C2708E', hair: '#3A2620' },
};

export function ageGroup(p, kidsOf) {
  const y = new Date().getFullYear();
  if (p.birth) { const a = (p.death || y) - p.birth; return a < 13 ? 'kid' : a >= 58 ? 'elder' : 'adult'; }
  const k = kidsOf ? kidsOf(p.id) : [];
  if (k.some(c => (kidsOf(c) || []).length)) return 'elder';
  if (p.deceased && k.length) return 'elder';
  return 'adult';
}

function male(age, c) {
  const kid = age === 'kid', old = age === 'elder';
  const hy = kid ? 30 : 27, hr = kid ? 12.5 : 11;
  const hair = old ? '#D8D4CE' : c.hair;
  return `
  <path d="M8 64c1-14 11-21 24-21s23 7 24 21z" fill="${c.cloth}"/>
  <path d="M25 43.5c2 4 4.5 6 7 6s5-2 7-6" fill="none" stroke="${c.cloth2}" stroke-width="2.4" stroke-linecap="round"/>
  <rect x="28" y="${hy + 6}" width="8" height="${kid ? 7 : 9}" rx="3" fill="${SKIN_D}"/>
  <circle cx="32" cy="${hy}" r="${hr}" fill="${SKIN}"/>
  <path d="M${32 - hr - .6} ${hy - 1}c0-${hr * .9} ${hr * .55}-${hr * 1.15} ${hr + .6}-${hr * 1.15}s${hr + .6} ${hr * .25} ${hr + .6} ${hr * 1.15}c-${hr * .35}-${hr * .45}-${hr * .9}-${hr * .62}-${hr + .6}-${hr * .62}s-${hr * .95} ${hr * .2}-${hr + .6} ${hr * .62}z" fill="${hair}"/>
  ${old ? `<path d="M23.5 ${hy + 2}c1 7.5 4.6 10.5 8.5 10.5s7.5-3 8.5-10.5c-2.6 3-5.4 4-8.5 4s-5.9-1-8.5-4z" fill="${hair}"/>` : ''}
  <circle cx="${32 - hr * .38}" cy="${hy + 1}" r="1.15" fill="#3B2A22" opacity=".7"/><circle cx="${32 + hr * .38}" cy="${hy + 1}" r="1.15" fill="#3B2A22" opacity=".7"/>
  ${old ? '' : `<path d="M${32 - 2.6} ${hy + 5}q2.6 2 5.2 0" fill="none" stroke="#B5785A" stroke-width="1.1" stroke-linecap="round"/>`}`;
}

function female(age, c) {
  const kid = age === 'kid', old = age === 'elder';
  if (kid) {
    const hy = 30, hr = 12.5;
    return `
    <path d="M17.5 31c-1 10 1 18 4 22h21c3-4 5-12 4-22-2-11-8-15-14.5-15S18.5 20 17.5 31z" fill="${c.hair}"/>
    <path d="M10 64c1-12 10-18 22-18s21 6 22 18z" fill="${c.cloth}"/>
    <rect x="28" y="${hy + 6}" width="8" height="7" rx="3" fill="${SKIN_D}"/>
    <circle cx="32" cy="${hy}" r="${hr}" fill="${SKIN}"/>
    <path d="M19.4 28c1-8 6-11.5 12.6-11.5S43.6 20 44.6 28c-3-3.2-7-4.4-12.6-4.4s-9.6 1.2-12.6 4.4z" fill="${c.hair}"/>
    <path d="M40 18.5l5.5-3.2-.6 6.2zM40 18.5l2.4 5.7-6-1.9z" fill="${c.cloth2}"/><circle cx="40.6" cy="19.6" r="1.6" fill="${c.cloth}"/>
    <circle cx="27.2" cy="31" r="1.15" fill="#3B2A22" opacity=".7"/><circle cx="36.8" cy="31" r="1.15" fill="#3B2A22" opacity=".7"/>
    <path d="M29.4 35q2.6 2 5.2 0" fill="none" stroke="#B5785A" stroke-width="1.1" stroke-linecap="round"/>`;
  }
  const scarf = old ? '#B9A9AF' : c.cloth, scarf2 = old ? '#A3929A' : c.cloth2;
  return `
  <path d="M9 64c1.5-11 8-17 15-19.5h16c7 2.5 13.5 8.5 15 19.5z" fill="${scarf2}"/>
  <path d="M32 12.5c-9 0-14.5 6.5-14.5 16.5 0 6.5 2.6 11.3 6.5 14.6L18 51c4.5 3 9 4.2 14 4.2S41.5 54 46 51l-6-7.4c3.9-3.3 6.5-8.1 6.5-14.6 0-10-5.5-16.5-14.5-16.5z" fill="${scarf}"/>
  <ellipse cx="32" cy="29.5" rx="8.4" ry="10" fill="${SKIN}"/>
  <path d="M23.6 27.5c.6-6 4-9.2 8.4-9.2s7.8 3.2 8.4 9.2c-2.2-2.6-5-3.6-8.4-3.6s-6.2 1-8.4 3.6z" fill="${scarf}" opacity=".55"/>
  <circle cx="28.6" cy="30" r="1.1" fill="#3B2A22" opacity=".7"/><circle cx="35.4" cy="30" r="1.1" fill="#3B2A22" opacity=".7"/>
  ${old ? '<path d="M27.5 26.6q1.1-.6 2.2 0M34.3 26.6q1.1-.6 2.2 0" stroke="#9A8270" stroke-width=".8" fill="none"/>' : `<path d="M29.6 34.4q2.4 1.8 4.8 0" fill="none" stroke="#B5785A" stroke-width="1.1" stroke-linecap="round"/>`}`;
}

const cache = new Map();
export function avatarSVG(gender, age) {
  const k = gender + age; if (cache.has(k)) return cache.get(k);
  const g = gender === 'f' ? 'f' : 'm', c = PAL[g];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="c"><circle cx="32" cy="32" r="32"/></clipPath></defs><g clip-path="url(#c)"><rect width="64" height="64" fill="${c.bg}"/>${g === 'f' ? female(age, c) : male(age, c)}</g></svg>`;
  cache.set(k, svg); return svg;
}
export function avatarURL(gender, age) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSVG(gender, age)); }
