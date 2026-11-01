import './style.css';
import { api, ls, outbox, liveChannel, configured } from './api.js';
import { registerSW } from 'virtual:pwa-register';
import { avatarURL, ageGroup } from './avatars.js';
import { colorMap, legendFor, layoutTree, layoutRadial, classicScene, renderSVG, branchPoint, firstName } from './scene.js';
import { Globe } from './globe.js';
import { THEMES, QUALITY, posterLayout, drawPoster, renderPNG, posterDims } from './poster.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AR=n=>(n==null||n==='')?'':Number(n).toLocaleString('ar-EG',{useGrouping:false});
const NOW_Y=new Date().getFullYear();
const CW=148,CH=178,SG=16,HG=28,VG=78,TG=120;
const S={people:new Map(),real:new Map(),meta:{name:''},demo:false,canWrite:false,sel:null,focus:null,hl:new Set(),lay:null,loaded:false,mode:'loading',kids:new Map(),code:null,treeId:null,role:null,viewCode:null,editCode:null};
let OB=null, LIVE=null;
const P=id=>id?S.people.get(id):null;
const isF=p=>p&&p.gender==='f';
const newId=()=>'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const norm=s=>String(s||'').replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toLowerCase().trim();
const initial=p=>esc((p?.name||'؟').trim().charAt(0));
const yearsTxt=p=>{ if(!p) return ''; const b=p.birth,d=p.death;
  if(p.deceased){ if(b&&d) return AR(b)+' – '+AR(d); if(d) return 'تُوفي '+AR(d); if(b) return AR(b)+' – ؟'; return isF(p)?'رحمها الله':'رحمه الله'; }
  return b?AR(b):''; };
const imgSrc=p=>p?.photo||avatarURL(p?.gender==='f'?'f':'m',ageGroup(p||{},kidsOf));
const ph=(p)=>p?`<img src="${esc(imgSrc(p))}" alt="" loading="lazy">`:'';
/* ---------- toast ---------- */
let tT; function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(tT); tT=setTimeout(()=>t.classList.remove('on'),2600); }

/* ---------- indexing ---------- */
function index(){ NC=new Map(); const k=new Map(); for(const p of S.people.values()){ for(const pid of [p.father,p.mother]) if(pid&&S.people.has(pid)){ if(!k.has(pid)) k.set(pid,[]); k.get(pid).push(p.id); } } S.kids=k; }
const kidsOf=id=>S.kids.get(id)||[];
const spousesOf=id=>(P(id)?.spouses||[]).filter(s=>S.people.has(s)&&s!==id);
function siblingsOf(id){ const p=P(id); if(!p) return []; const set=new Set(); for(const par of [p.father,p.mother]) if(par) for(const k of kidsOf(par)) if(k!==id) set.add(k); return [...set].sort(byBirth); }
function byBirth(a,b){ const A=P(a),B=P(b); return (A?.birth??9999)-(B?.birth??9999)||(A?.created||0)-(B?.created||0); }
function descCount(id,seen=new Set()){ if(seen.has(id)) return 0; seen.add(id); let n=1; for(const k of kidsOf(id)) n+=descCount(k,seen); return n; }


/* ---------- names: you type the first name, the app adds the father's line ---------- */
const HON=/^(الحاج|الحاجه|الحاجة|الشيخ|الأستاذ|الاستاذ|الدكتور|الدكتورة|المرحوم|المرحومة|د\.|أ\.)\s+/;
const nw=s=>norm(s).replace(/["'«»“”()]/g,'');
function near(a,b){ if(a===b) return true; if(Math.min(a.length,b.length)<4||Math.abs(a.length-b.length)>1) return false;
  let i=0,j=0,e=0; while(i<a.length&&j<b.length){ if(a[i]===b[j]){i++;j++;continue;} if(++e>1) return false; if(a.length>b.length) i++; else if(b.length>a.length) j++; else {i++;j++;} } return e+(a.length-i)+(b.length-j)<=1; }
function splitFirst(raw){ const m=raw.match(HON); const hon=m?m[0]:''; const w=raw.slice(hon.length).split(' ').filter(Boolean);
  const n=/^(عبد|عبدال|ابو|أبو|ام|أم)$/.test(w[0]||'')&&w[1]?2:1; return {given:(hon+w.slice(0,n).join(' ')).trim(),rest:w.slice(n).join(' ')}; }
let NC=new Map();
function nameInfo(id,depth=0){
  if(NC.has(id)) return NC.get(id);
  const p=P(id); if(!p) return {given:'',units:[],bare:[],full:''};
  const raw=String(p.name||'').trim().replace(/\s+/g,' ');
  const f=P(p.father); const strip=x=>x.replace(HON,'');
  if(!f||f.id===id||depth>40){ const {given,rest}=splitFirst(raw); const r={given,units:rest?[given,rest]:[given],bare:rest?[strip(given),rest]:[strip(given)],full:raw}; NC.set(id,r); return r; }
  NC.set(id,{given:raw,units:[raw],bare:[strip(raw)],full:raw}); // guard against loops while we compute
  const fi=nameInfo(f.id,depth+1); const fw=fi.bare.join(' ').split(' '); const words=raw.split(' ');
  let given=raw;
  for(let i=1;i<words.length;i++){ let k=0; while(i+k<words.length&&k<fw.length&&near(nw(words[i+k]),nw(fw[k]))) k++;
    if(k>0){ const extra=words.slice(i+k).join(' '); given=words.slice(0,i).join(' ')+(extra?' '+extra:''); break; } }
  const units=[given,...fi.bare]; const r={given,units,bare:[strip(given),...fi.bare],full:units.join(' ')}; NC.set(id,r); return r;
}
const fullName=p=>p?nameInfo(p.id).full:'';
const shortName=p=>p?nameInfo(p.id).units.slice(0,3).join(' '):'';
const givenName=p=>p?nameInfo(p.id).given:'';
// what a child/sibling typed as a first name will show as
function previewName(first,fatherId){ const f=P(fatherId); const t=String(first||'').trim(); if(!t) return ''; return f?(t+' '+nameInfo(f.id).bare.slice(0,4).join(' ')):t; }
// a copy of the person with the display name, for the drawing code
function givenOf(raw,fatherId){ const fi=nameInfo(fatherId); const fw=fi.bare.join(' ').split(' '), w=String(raw).trim().split(/\s+/);
  for(let i=1;i<w.length;i++){ let k=0; while(i+k<w.length&&k<fw.length&&near(nw(w[i+k]),nw(fw[k]))) k++; if(k>0){ const ex=w.slice(i+k).join(' '); return w.slice(0,i).join(' ')+(ex?' '+ex:''); } } return w.join(' '); }
const PD=id=>{ const p=P(id); return p?{...p,name:shortName(p)}:p; };

/* ---------- layout ---------- */
function pickRoots(){
  if(S.focus&&P(S.focus)) return [S.focus];
  const roots=[...S.people.values()].filter(p=>!P(p.father)&&!P(p.mother)).map(p=>p.id);
  const sc=new Map(roots.map(r=>[r,descCount(r)]));
  roots.sort((a,b)=>sc.get(b)-sc.get(a)||((isF(P(a))?1:0)-(isF(P(b))?1:0))||byBirth(a,b));
  return roots;
}
let D={CW,CH,SG,HG,VG,TG};
function unitW(n){ return n.ref?D.CW:(1+n.spouses.length)*D.CW+n.spouses.length*D.SG; }
function measure(n){ const uw=unitW(n); if(n.ref||!n.children.length){ n.w=uw; return uw; }
  n.cw=n.children.reduce((s,c)=>s+measure(c),0)+D.HG*(n.children.length-1); n.w=Math.max(uw,n.cw); return n.w; }
function place(n,x,y){ n.y=y; n.ux=x+(n.w-unitW(n))/2;
  if(!n.ref&&n.children.length){ let cx=x+(n.w-n.cw)/2; for(const c of n.children){ place(c,cx,y+D.CH+D.VG); cx+=c.w+D.HG; } } }
function layout(dims,rootId){
  index(); D=dims||{CW,CH,SG,HG,VG,TG}; const {CW:cW,CH:cH,SG:sG,VG:vG,TG:tG}=D;
  const placed=new Set(),shown=new Set();
  function build(id,depth){
    placed.add(id); shown.add(id);
    const sp=spousesOf(id).map(s=>({id:s,dup:shown.has(s)})); sp.forEach(s=>shown.add(s.id));
    const order=sp.map(s=>s.id);
    const oIdx=k=>{ const kp=P(k); const o=kp.father===id?kp.mother:kp.father; const i=order.indexOf(o); return i<0?999:i; };
    const kids=kidsOf(id).slice().sort((a,b)=>oIdx(a)-oIdx(b)||byBirth(a,b));
    const n={id,depth,spouses:sp,children:[]};
    for(const k of kids){ if(placed.has(k)) continue; if(shown.has(k)) n.children.push({ref:true,id:k,depth:depth+1}); else n.children.push(build(k,depth+1)); }
    return n;
  }
  const forest=[]; for(const r of (rootId?[rootId]:pickRoots())){ if(shown.has(r)) continue; forest.push(build(r,0)); }
  let x=0; for(const t of forest){ measure(t); place(t,x,0); x+=t.w+tG; }
  const W=Math.max(cW,x-tG),cards=[],links=[]; let maxY=cH,maxD=0;
  function collect(n){
    maxY=Math.max(maxY,n.y+cH); maxD=Math.max(maxD,n.depth);
    if(n.ref){ cards.push({id:n.id,x:n.ux,y:n.y,kind:'ref',depth:n.depth}); return; }
    cards.push({id:n.id,x:n.ux,y:n.y,kind:'p',depth:n.depth});
    n.spouses.forEach((s,i)=>{ const sx=n.ux+(i+1)*(cW+sG); cards.push({id:s.id,x:sx,y:n.y,kind:s.dup?'dup':'sp',of:n.id,depth:n.depth});
      links.push({t:'m',x1:n.ux+i*(cW+sG)+cW,x2:sx,y:n.y+cH*.42,a:n.id,b:s.id}); });
    for(const c of n.children){ const kp=P(c.id); const o=kp.father===n.id?kp.mother:kp.father; const i=n.spouses.findIndex(s=>s.id===o);
      const ax=i<0?n.ux+cW/2:n.ux+(i+1)*(cW+sG)-sG/2, ay=i<0?n.y+cH:n.y+cH*.42;
      links.push({t:'c',ax,ay,by:n.y+cH+vG/2,cx:c.ux+cW/2,cy:c.y,a:n.id,b:c.id,o}); collect(c); }
  }
  forest.forEach(collect);
  cards.forEach(c=>c.x=W-c.x-cW);
  links.forEach(l=>{ if(l.t==='m'){ const a=W-l.x1,b=W-l.x2; l.x1=Math.min(a,b); l.x2=Math.max(a,b); } else { l.ax=W-l.ax; l.cx=W-l.cx; } });
  const pos=new Map(); for(const c of cards){ if(c.kind==='p') pos.set(c.id,c); } for(const c of cards){ if(c.kind==='sp'&&!pos.has(c.id)) pos.set(c.id,c); }
  const out={cards,links,W,H:maxY,pos,gens:cards.length?maxD+1:0,forest,dims:D}; D={CW,CH,SG,HG,VG,TG}; return out;
}

/* ---------- render ---------- */
const stage=$('#stage'),vp=$('#vp');
function render(){
  const L=layout(); S.forest=L.forest; S.colors=colorMap(L.forest,S.colorMode,P);
  const hl=S.hl, sv=$('#links'), view=S.view, gl=$('#globe');
  stage.hidden=view==='globe'; gl.hidden=view!=='globe';
  if(view==='tree'||view==='radial'){
    const sc=S.scene=(view==='tree'?layoutTree:layoutRadial)(L.forest,P,S.colors);
    const pos=new Map(); for(const [id,n] of sc.pos) pos.set(id,{x:n.x-CW/2,y:n.y-CH/2,kind:n.kind});
    S.lay={W:sc.W,H:sc.H,pos,cards:sc.nodes,gens:L.gens,classic:L};
    stage.style.width=sc.W+'px'; stage.style.height=sc.H+'px'; sv.setAttribute('width',sc.W); sv.setAttribute('height',sc.H);
    sv.classList.add('scene'); sv.innerHTML=renderSVG(sc,{P:PD,img:imgSrc,yearsTxt,sel:S.sel,hl}); $('#cards').innerHTML='';
  } else if(view==='globe'){
    S.lay={...L,classic:L}; if(S.people.size){ const G=ensureGlobe(); G.setData({forest:L.forest,P:PD,colors:S.colors,theme:globeTheme()}); G.setSelected(S.sel); G.start(); }
  } else {
    S.lay={...L,classic:L}; sv.classList.remove('scene');
    stage.style.width=L.W+'px'; stage.style.height=L.H+'px'; sv.setAttribute('width',L.W); sv.setAttribute('height',L.H);
    sv.innerHTML=L.links.map(l=>{ const on=hl.size&&hl.has(l.a)&&hl.has(l.b);
      return l.t==='m'?`<path class="lk m${on?' hl':''}" d="M${l.x1} ${l.y}H${l.x2}"/>`:`<path class="lk${on?' hl':''}" d="M${l.ax} ${l.ay}V${l.by}H${l.cx}V${l.cy}"/>`; }).join('');
    const tint=S.colorMode!=='gender';
    $('#cards').innerHTML=L.cards.map(c=>{ const p=P(c.id); if(!p) return '';
      const cls=['card',isF(p)?'f':'m',p.deceased?'dec':'',S.sel===c.id?'sel':'',hl.has(c.id)?'hl':'',(c.kind==='ref'||c.kind==='dup')?'ghost':''].join(' ');
      const tag=(c.kind==='ref'||c.kind==='dup')?`<span class="tag">${c.kind==='ref'?'متجوز في فرع تاني':'موجود في فرع تاني'}</span>`:'';
      return `<button class="${cls}" style="left:${c.x}px;top:${c.y}px${tint?`;--c:${S.colors.get(c.id)}`:''}" data-id="${esc(c.id)}" data-k="${c.kind}" aria-label="${esc(fullName(p))}"><span class="ph">${ph(p)}</span><span class="nm">${esc(shortName(p))}</span><span class="yr">${yearsTxt(p)||'&nbsp;'}</span>${tag}</button>`; }).join('');
  }
  if(G_.globe&&view!=='globe') G_.globe.stop();
  renderViewbar(L);
  // stats
  const all=[...S.people.values()];
  $('#stats').innerHTML=all.length?`<span><b>${AR(all.length)}</b> فرد</span><span><b>${AR(L.gens)}</b> ${L.gens===1?'جيل':'أجيال'}</span><span><b>${AR(all.filter(p=>!p.deceased).length)}</b> عايشين</span>`:'';
  $('#famName').textContent=famTitle();
  $('#roChip').hidden=S.canWrite||S.demo;
  $('#fab').hidden=!(S.canWrite||S.demo)||!all.length;
  $('#demoBar').hidden=!S.demo;
  const bb=$('#branchBar'); bb.hidden=!(S.focus&&P(S.focus)); if(!bb.hidden) $('#branchTxt').textContent='فرع '+shortName(P(S.focus));
  renderEmpty(all.length);
  if(S.sel){ if(P(S.sel)) renderSheet(S.sel); else closeSheet(); }
}
function renderEmpty(n){ const e=$('#empty');
  if(n){ e.hidden=true; return; } e.hidden=false;
  if(S.mode==='loading'){ e.innerHTML=`<div class="empty-in"><p class="loading">بنحمّل الشجرة…</p></div>`; return; }
  if(S.mode==='unreachable'){ e.innerHTML=`<div class="empty-in"><h2>مش قادرين نوصل للبيانات</h2><p>اتأكد إن النت شغال. الصفحة هتكمّل تحاول لوحدها.</p></div>`; return; }
  e.innerHTML=`<div class="empty-in">
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true"><path d="M60 92V52M60 52c0-14-22-12-22-28M60 52c0-14 22-12 22-28M60 70c-10 0-30-2-34-16M60 70c10 0 30-2 34-16" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/><circle cx="38" cy="18" r="10" fill="var(--male-soft)" stroke="var(--male)" stroke-width="2.5"/><circle cx="82" cy="18" r="10" fill="var(--female-soft)" stroke="var(--female)" stroke-width="2.5"/><circle cx="24" cy="50" r="8" fill="var(--surface)" stroke="var(--line)" stroke-width="2.5"/><circle cx="96" cy="50" r="8" fill="var(--surface)" stroke="var(--line)" stroke-width="2.5"/></svg>
    <h2>الشجرة لسه فاضية</h2>
    ${S.canWrite?`<p>ابدأ بأقدم جد تعرفه، وبعدين ضيف ولاده وأحفاده. الشجرة هتترتب لوحدها كل ما تضيف حد.</p>
    <button class="btn pri" id="eStart">ابدأ بأقدم جد</button><button class="btn" id="eType">اكتب العيلة كلها مرة واحدة</button>`:`<p>صاحب الشجرة لسه مضافش حد. أول ما يبدأ هتظهر هنا على طول.</p>`}
    <button class="btn" id="eDemo">شوف مثال جاهز</button></div>`;
  $('#eStart')?.addEventListener('click',()=>openForm({mode:'add'}));
  $('#eType')?.addEventListener('click',()=>openTypeFamily(null));
  $('#eDemo').addEventListener('click',enterDemo);
}

/* ---------- pan & zoom ---------- */
const view={x:20,y:20,k:1}; let didFit=false;
function apply(){ stage.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.k})`; }
const clampK=k=>Math.min(2.2,Math.max(0.02,k));
function zoomAt(f,cx,cy){ const r=vp.getBoundingClientRect(); cx??=r.width/2; cy??=r.height/2; const k=clampK(view.k*f); const wx=(cx-view.x)/view.k,wy=(cy-view.y)/view.k; view.k=k; view.x=cx-wx*k; view.y=cy-wy*k; apply(); }
function animate(){ stage.classList.add('anim'); clearTimeout(animate.t); animate.t=setTimeout(()=>stage.classList.remove('anim'),520); }
function fit(anim=true){ if(S.view==='globe'){ G_.globe?.fit(); return; } const L=S.lay; if(!L||!L.cards.length) return; const r=vp.getBoundingClientRect(); const pad=40;
  const k=clampK(Math.min((r.width-pad*2)/L.W,(r.height-pad*2-60)/L.H,1));
  if(anim) animate(); view.k=k; view.x=(r.width-L.W*k)/2; view.y=Math.max(pad+30,(r.height-L.H*k)/2); apply(); }
function centerOn(id){ if(S.view==='globe'){ G_.globe?.setSelected(id); return; } const c=S.lay?.pos.get(id); if(!c) return; const r=vp.getBoundingClientRect(); const k=Math.max(view.k,0.85);
  const sheetOpen=$('#sheet').classList.contains('open'); const wide=innerWidth>=900;
  const cx=wide&&sheetOpen?(r.width+380)/2:r.width/2; const cy=!wide&&sheetOpen?r.height*0.28:r.height/2;
  animate(); view.k=k; view.x=cx-(c.x+CW/2)*k; view.y=cy-(c.y+CH/2)*k; apply();
  setTimeout(()=>{ const el=stage.querySelector(`.card[data-id="${CSS.escape(id)}"][data-k="${c.kind}"]`)||stage.querySelector(`.nd[data-id="${CSS.escape(id)}"]`); if(el){ el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); } },420); }
const ptrs=new Map(); let downT=null,moved=false,last=null,pinch=null;
vp.addEventListener('pointerdown',e=>{ if(S.view==='globe'||e.target.closest('.zoom,.fab,.banner,.branchbar,.empty button,.viewbar,.legend')) return;
  vp.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1){ downT=e.target; moved=false; last={x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY}; vp.classList.add('drag'); }
  if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; const r=vp.getBoundingClientRect(); pinch={d:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top,k:view.k,x:view.x,y:view.y}; moved=true; } });
vp.addEventListener('pointermove',e=>{ if(!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2&&pinch){ const [a,b]=[...ptrs.values()]; const r=vp.getBoundingClientRect(); const d=Math.hypot(a.x-b.x,a.y-b.y); const mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top;
    const k=clampK(pinch.k*d/pinch.d); const wx=(pinch.mx-pinch.x)/pinch.k,wy=(pinch.my-pinch.y)/pinch.k; view.k=k; view.x=mx-wx*k; view.y=my-wy*k; apply(); return; }
  if(ptrs.size===1&&last){
    if(!moved&&Math.hypot(e.clientX-last.ox,e.clientY-last.oy)>6) moved=true;
    if(moved){ view.x+=e.clientX-last.x; view.y+=e.clientY-last.y; apply(); }
    last.x=e.clientX; last.y=e.clientY; } });
function endPtr(e){ if(!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if(ptrs.size<2) pinch=null;
  if(ptrs.size===1){ const v=[...ptrs.values()][0]; last={x:v.x,y:v.y,ox:v.x,oy:v.y}; }
  if(ptrs.size===0){ vp.classList.remove('drag'); if(!moved&&e.type==='pointerup'){ const c=downT?.closest?.('.card,.nd'); if(c) selectPerson(c.dataset.id); else if(S.sel&&innerWidth<900) closeSheet(); } last=null; } }
vp.addEventListener('pointerup',endPtr); vp.addEventListener('pointercancel',endPtr);
vp.addEventListener('wheel',e=>{ if(S.view==='globe') return; e.preventDefault(); const r=vp.getBoundingClientRect();
  const mouse=e.deltaMode===1||(e.deltaX===0&&Math.abs(e.deltaY)>=50&&Number.isInteger(e.deltaY));
  if(e.ctrlKey||mouse) zoomAt(Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.0018)),e.clientX-r.left,e.clientY-r.top);
  else { view.x-=e.deltaX; view.y-=e.deltaY; apply(); } },{passive:false});
vp.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.classList?.contains('card')) selectPerson(e.target.dataset.id); });
$('#zIn').onclick=()=>{ if(S.view==='globe') return G_.globe?.zoomBy(1.25); animate();zoomAt(1.25);}; $('#zOut').onclick=()=>{ if(S.view==='globe') return G_.globe?.zoomBy(0.8); animate();zoomAt(0.8);}; $('#zFit').onclick=()=>fit();

/* ---------- sheet ---------- */
function selectPerson(id){ S.sel=id; render(); openSheet(); }
let sheetOpenedAt=0;
function openSheet(){ sheetOpenedAt=Date.now(); $('#sheet').classList.add('open'); if(innerWidth<900) $('#scrim').hidden=false; }
function closeSheet(){ $('#sheet').classList.remove('open'); $('#scrim').hidden=true; if(S.sel){ S.sel=null; render(); } }
$('#scrim').onclick=()=>{ if(Date.now()-sheetOpenedAt>450) closeSheet(); }; // ignore the tap that opened the sheet
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#dlg').open){ closeSheet(); $('#results').hidden=true; } });
const pchip=id=>{ const p=P(id); if(!p) return ''; return `<button class="pchip ${isF(p)?'f':''}" data-go="${esc(id)}"><i>${ph(p)}</i>${esc(shortName(p))}</button>`; };
const relRow=(label,ids)=>ids.length?`<div class="rel-row"><span>${label}</span><div class="chips">${ids.map(pchip).join('')}</div></div>`:'';
function availRels(p){ const r=[]; if(!P(p.father)) r.push('father'); if(!P(p.mother)) r.push('mother'); r.push('son','daughter','brother','sister'); r.push(isF(p)?'husband':'wife'); return r; }
const REL={father:{l:'أب',g:'m'},mother:{l:'أم',g:'f'},son:{l:'ابن',g:'m'},daughter:{l:'بنت',g:'f'},brother:{l:'أخ',g:'m'},sister:{l:'أخت',g:'f'},husband:{l:'زوج',g:'m'},wife:{l:'زوجة',g:'f'}};
function renderSheet(id){ const p=P(id); if(!p) return;
  const f=isF(p); const sp=spousesOf(id), kids=kidsOf(id).slice().sort(byBirth), sib=siblingsOf(id);
  let age=''; if(!p.deceased&&p.birth) age=`العمر ${AR(NOW_Y-p.birth)} سنة`; else if(p.deceased&&p.birth&&p.death) age=`${f?'عاشت':'عاش'} ${AR(p.death-p.birth)} سنة`;
  const edit=S.canWrite||S.demo;
  $('#sheetBody').innerHTML=`
    <div class="ph-head">
      <div class="ph-big ${f?'f':''} ${p.deceased?'dec':''}">${ph(p)}</div>
      <div style="min-width:0"><h2>${esc(shortName(p))}</h2>${fullName(p)!==shortName(p)?`<div class="fulln">${esc(fullName(p))}</div>`:''}
        <div class="meta">${yearsTxt(p)?`<span>${yearsTxt(p)}</span>`:''}${age?`<span>، ${age}</span>`:''}${p.deceased?`<span class="pill dec">${f?'رحمها الله':'رحمه الله'}</span>`:''}</div></div>
      <div class="sh-acts">${edit?`<button class="ibtn" id="sEdit2" aria-label="تعديل" title="تعديل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>`:''}<button class="ibtn" id="sClose" aria-label="إغلاق"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    </div>
    <div class="rels">
      ${relRow('الأب',P(p.father)?[p.father]:[])}${relRow('الأم',P(p.mother)?[p.mother]:[])}
      ${relRow(f?'الزوج':(sp.length>1?'الزوجات':'الزوجة'),sp)}
      ${relRow('الأولاد',kids)}${relRow('الإخوات',sib)}
      ${!P(p.father)&&!P(p.mother)&&!sp.length&&!kids.length?'<p class="hint">مفيش أقارب متسجلين لسه.</p>':''}
    </div>
    ${p.notes?`<div class="notes">${esc(p.notes)}</div>`:''}
    ${edit?`<div><p class="sec-t">ضيف قريب لـ ${esc(givenName(p))}</p><div class="addgrid">${availRels(p).map(r=>`<button data-add="${r}">${REL[r].l}</button>`).join('')}</div></div>
    <div class="bulkrow"><button class="btn" id="sKids">ولاد كتير مرة واحدة<small>اكتب أسماءهم ورا بعض</small></button><button class="btn" id="sType">اكتب ذريّته كلها<small>ولاد وأحفاد في نص واحد</small></button></div>`:''}
    <div class="actions">
      ${edit?`<button class="btn" id="sEdit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>تعديل</button>`:''}
      <button class="btn" id="sBranch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M12 7.5V12M6 16.5V14h12v2.5"/></svg>اعرض فرعه</button>
      <button class="btn" id="sRel">صلة القرابة</button>
      ${edit?`<button class="btn dan" id="sDel">حذف</button>`:''}
    </div>
    <div id="delConfirm" hidden></div>`;
  const b=$('#sheetBody');
  b.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>goTo(x.dataset.go));
  b.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>openForm({mode:'add',base:id,rel:x.dataset.add}));
  $('#sClose').onclick=closeSheet;
  $('#sEdit2')?.addEventListener('click',()=>openForm({mode:'edit',id}));
  $('#sKids')?.addEventListener('click',()=>openKids(id));
  $('#sType')?.addEventListener('click',()=>openTypeFamily(id));
  $('#sEdit')?.addEventListener('click',()=>openForm({mode:'edit',id}));
  $('#sBranch').onclick=()=>{ S.focus=id; render(); fit(); };
  $('#sRel').onclick=()=>openRel(id);
  $('#sDel')?.addEventListener('click',()=>{ const d=$('#delConfirm'); d.hidden=false;
    d.innerHTML=`<div class="notes">هتمسح <b>${esc(shortName(p))}</b> من الشجرة، وكل الروابط بتاعته هتتشال. ولاده هيفضلوا موجودين.<div style="display:flex;gap:8px;margin-top:10px"><button class="btn dan full" id="dYes">أيوه، امسح</button><button class="btn" id="dNo">لأ</button></div></div>`;
    $('#dNo').onclick=()=>{d.hidden=true;}; $('#dYes').onclick=()=>deletePerson(id); });
}
function goTo(id){ if(!S.lay?.pos.has(id)){ S.focus=null; } S.sel=id; render(); openSheet(); centerOn(id); }

/* ---------- persistence ---------- */
function writeErr(e){ if(e?.code==='not_allowed'){ S.canWrite=false; render(); toast('اللينك ده للعرض بس. اطلب لينك التعديل من صاحب الشجرة.'); } else toast('الحفظ ماتمّش. هنحاول تاني لما النت يرجع.'); }
function cacheSave(){ if(!S.code) return; ls.set('ft-cache-'+S.code,{meta:S.meta,role:S.role,treeId:S.treeId,viewCode:S.viewCode,editCode:S.editCode,people:[...S.real.values()],at:Date.now()}); }
async function flush(){ if(!OB) return; const sent=OB.list().length; const ok=await OB.flush((e)=>writeErr(e)); updateNet(); if(ok&&sent){ LIVE?.ping(); } }
async function commit(list){
  const now=Date.now(); for(const p of list){ p.updated=now; S.people.set(p.id,p); if(!S.demo) S.real.set(p.id,p); }
  render();
  if(S.demo) return true;
  OB.push({t:'save',people:list.map(p=>({...p}))}); cacheSave(); flush(); return true;
}
async function removeDoc(id){ S.people.delete(id); if(S.demo) return; S.real.delete(id); OB.push({t:'del',id}); cacheSave(); flush(); }
async function deletePerson(id){
  const changed=[]; for(const p of S.people.values()){ if(p.id===id) continue; let c=null;
    if(p.father===id){ c=c||{...p}; c.father=null; } if(p.mother===id){ c=c||{...p}; c.mother=null; }
    if((p.spouses||[]).includes(id)){ c=c||{...p}; c.spouses=p.spouses.filter(s=>s!==id); }
    if(c) changed.push(c); }
  const name=shortName(P(id)); S.sel=null; closeSheet(); await removeDoc(id); if(changed.length) await commit(changed); else render(); toast('اتمسح '+name); }

/* ---------- forms ---------- */
const dlg=$('#dlg');
function openDlg(html){ $('#dlgIn').innerHTML=html; if(!dlg.open) dlg.showModal(); $('#dlgIn').querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dlg.close()); }
dlg.addEventListener('click',e=>{ if(e.target===dlg) dlg.close(); });
const xBtn=`<button class="ibtn" data-close aria-label="إغلاق"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
const peopleSorted=(filter=()=>true)=>[...S.people.values()].filter(filter).sort((a,b)=>fullName(a).localeCompare(fullName(b),'ar'));
const opt=(p,sel)=>`<option value="${esc(p.id)}"${sel===p.id?' selected':''}>${esc(shortName(p))}${p.birth?' ('+AR(p.birth)+')':''}</option>`;

function loadFileImg(file){ return new Promise((res,rej)=>{ const u=URL.createObjectURL(file); const im=new Image(); im.onload=()=>res(im); im.onerror=()=>rej(new Error('img')); im.src=u; }); }
function squareCanvas(im,T){ const s=Math.min(im.width,im.height); const c=document.createElement('canvas'); c.width=c.height=T; c.getContext('2d').drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,T,T); return c; }
async function preparePhoto(file){ const im=await loadFileImg(file); const big=squareCanvas(im,384); const blob=await new Promise(r=>big.toBlob(r,'image/jpeg',0.84)); const small=squareCanvas(im,120).toDataURL('image/jpeg',0.7); return {blob,preview:big.toDataURL('image/jpeg',0.8),small}; }
async function storePhoto(personId,pending){ if(!pending) return null; if(S.demo) return pending.preview;
  try{ return await api.uploadPhoto(S.treeId,personId,pending.blob); }catch{ return pending.small; } }

function openForm({mode,base,rel,id}){
  const editing=mode==='edit'; const p=editing?{...P(id)}:{name:'',gender:rel?REL[rel].g:'m',birth:null,death:null,deceased:false,photo:null,notes:'',father:null,mother:null,spouses:[]};
  const B=base?P(base):null;
  const fixedG=!!rel;
  let linkExisting=false, photo=p.photo||null, pending=null, gender=p.gender||'m';
  const title=editing?'تعديل '+esc(shortName(P(id))):rel?`إضافة ${REL[rel].l} لـ ${esc(shortName(B))}`:'إضافة فرد';
  const bSp=B?spousesOf(base):[];
  const otherParentFld=(rel==='son'||rel==='daughter')?`<div class="fld"><label for="fOther">${isF(B)?'الأب':'الأم'}</label><select id="fOther"><option value="">مش معروف / مش متسجل</option>${bSp.map(s=>opt(P(s),bSp.length===1?s:null)).join('')}</select></div>`:'';
  const exCands=rel?peopleSorted(x=>x.id!==base&&(REL[rel].g==='f'?isF(x):!isF(x))):[];
  openDlg(`<form id="pf" novalidate>
    <div class="dlg-h"><h3>${title}</h3>${xBtn}</div>
    <div class="dlg-b">
      ${rel&&exCands.length?`<div class="seg" id="segMode"><button type="button" class="on" data-m="new">شخص جديد</button><button type="button" data-m="ex">شخص موجود في الشجرة</button></div>`:''}
      <div id="exWrap" hidden><div class="fld"><label for="fEx">اختار ${REL[rel]?.l||''}</label><select id="fEx">${exCands.map(x=>opt(x)).join('')}</select></div><p class="hint">استخدم دي لو الشخص متسجل قبل كده، عشان الفرعين يتربطوا ببعض.</p></div>
      <div id="newWrap" style="display:flex;flex-direction:column;gap:14px">
        <div class="photo-pick"><div class="ph-big ${gender==='f'?'f':''}" id="fPh">${photo?`<img src="${esc(photo)}" alt="">`:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'}</div>
          <div style="display:flex;flex-direction:column;gap:6px"><label class="btn" for="fFile" style="height:38px">اختار صورة</label><input type="file" id="fFile" accept="image/*" hidden>${photo?'<button type="button" class="btn" id="fNoPh" style="height:34px;font-size:12.5px">شيل الصورة</button>':''}</div></div>
        <div class="fld"><label for="fName">${editing||!rel?'الاسم':'الاسم الأول بس'}</label><input type="text" id="fName" value="${esc(p.name)}" placeholder="${editing||!rel||['father','mother','husband','wife'].includes(rel)?'مثلاً: محمود عبد الرحمن':'مثلاً: فارس'}" maxlength="80"><span class="hint" id="fPrev"></span><span class="err" id="eName" hidden>اكتب الاسم الأول</span></div>
        ${fixedG?'':`<div class="fld"><span class="lbl">النوع</span><div class="seg" id="segG"><button type="button" data-g="m" class="${gender!=='f'?'on':''}">ذكر</button><button type="button" data-g="f" class="${gender==='f'?'on':''}">أنثى</button></div></div>`}
        <div class="row2"><div class="fld"><label for="fBirth">سنة الميلاد</label><input type="number" id="fBirth" inputmode="numeric" value="${p.birth??''}" placeholder="1960" min="1700" max="${NOW_Y}"></div>
          <div class="fld"><label for="fDeath">سنة الوفاة</label><input type="number" id="fDeath" inputmode="numeric" value="${p.death??''}" placeholder="—" min="1700" max="${NOW_Y}" ${p.deceased?'':'disabled'}></div></div>
        <label class="check"><input type="checkbox" id="fDec" ${p.deceased?'checked':''}> متوفي</label>
        <span class="err" id="eYears" hidden>سنة الوفاة لازم تكون بعد سنة الميلاد</span>
        ${otherParentFld}
        ${editing?editRelFields(p):''}
        <div class="fld"><label for="fNotes">ملاحظات (اختياري)</label><textarea id="fNotes" maxlength="1000" placeholder="الشغلانة، البلد، أي حاجة حلوة تتحكي">${esc(p.notes||'')}</textarea></div>
      </div>
    </div>
    <div class="dlg-f"><button class="btn pri" type="submit" id="fSave">حفظ</button><button class="btn" type="button" data-close>إلغاء</button></div>
  </form>`);
  const f=$('#pf');
  const prevFather=()=>{ if(editing) return $('#fFa')?.value||p.father; if(rel==='son'||rel==='daughter') return isF(B)?($('#fOther')?.value||null):B.id; if(rel==='brother'||rel==='sister') return B.father; return null; };
  const updPrev=()=>{ const v=$('#fName').value.trim(); const fa=prevFather(); let t='';
    if(v&&fa&&P(fa)){ t=editing?('هيظهر: '+previewName(givenOf(v,fa),fa)):('هيظهر: '+previewName(v,fa)); } $('#fPrev').textContent=t; };
  $('#fName').addEventListener('input',updPrev); $('#fOther')?.addEventListener('change',updPrev); $('#fFa')?.addEventListener('change',updPrev); setTimeout(updPrev,0);
  $('#segMode')?.querySelectorAll('button').forEach(b=>b.onclick=()=>{ linkExisting=b.dataset.m==='ex'; $('#segMode').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); $('#exWrap').hidden=!linkExisting; $('#newWrap').style.display=linkExisting?'none':'flex'; });
  $('#segG')?.querySelectorAll('button').forEach(b=>b.onclick=()=>{ gender=b.dataset.g; $('#segG').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); $('#fPh').classList.toggle('f',gender==='f'); });
  $('#fDec').onchange=e=>{ $('#fDeath').disabled=!e.target.checked; if(!e.target.checked) $('#fDeath').value=''; };
  $('#fFile').onchange=async e=>{ const file=e.target.files[0]; if(!file) return; try{ pending=await preparePhoto(file); photo=pending.preview; $('#fPh').innerHTML=`<img src="${photo}" alt="">`; }catch{ toast('الصورة دي مش راضية تفتح، جرّب واحدة تانية'); } };
  $('#fNoPh')?.addEventListener('click',()=>{ photo=null; pending=null; $('#fPh').innerHTML=initial(p); });
  let spEdit=editing?[...spousesOf(id)]:[];
  if(editing) wireSpouseEditor(spEdit,p);
  if(!linkExisting) setTimeout(()=>{ if(!editing) $('#fName')?.focus(); },60);
  f.onsubmit=async e=>{ e.preventDefault();
    if(linkExisting){ const ex=$('#fEx').value; if(!ex) return; dlg.close(); await linkRelative(base,rel,{...P(ex)},null); goTo(base); return; }
    const name=$('#fName').value.trim().replace(/\s+/g,' '); if(!name){ $('#eName').hidden=false; $('#fName').focus(); return; }
    const birth=parseInt($('#fBirth').value)||null, dec=$('#fDec').checked, death=dec?(parseInt($('#fDeath').value)||null):null;
    if(birth&&death&&death<birth){ $('#eYears').hidden=false; return; }
    const data={...p,name,gender:fixedG?REL[rel].g:gender,birth,death,deceased:dec,photo,notes:$('#fNotes').value.trim()};
    $('#fSave').disabled=true;
    if(!editing){ data.id=newId(); data.created=Date.now(); data.spouses=[]; }
    if(pending){ $('#fSave').textContent='بنرفع الصورة…'; data.photo=await storePhoto(data.id,pending); }
    if(editing){ dlg.close(); await saveEdit(data,spEdit); toast('اتحفظ'); return; }
    dlg.close();
    if(rel){ await linkRelative(base,rel,data,$('#fOther')?.value||null); } else { await commit([data]); }
    toast('اتضاف '+name);
    if(S.people.size===1){ setTimeout(()=>fit(),50); }
    goTo(rel?base:data.id);
  };
}
function editRelFields(p){
  const males=peopleSorted(x=>!isF(x)&&x.id!==p.id), females=peopleSorted(x=>isF(x)&&x.id!==p.id);
  return `<div class="row2"><div class="fld"><label for="fFa">الأب</label><select id="fFa"><option value="">—</option>${males.map(x=>opt(x,p.father)).join('')}</select></div>
    <div class="fld"><label for="fMo">الأم</label><select id="fMo"><option value="">—</option>${females.map(x=>opt(x,p.mother)).join('')}</select></div></div>
    <div class="fld"><span class="lbl">${isF(p)?'الزوج':'الزوجة/الزوجات'}</span><div class="sp-list" id="spList"></div>
    <select id="fSpAdd"><option value="">+ اربط ب${isF(p)?'زوج':'زوجة'} موجود</option></select></div>`;
}
function wireSpouseEditor(list,p){
  const draw=()=>{ $('#spList').innerHTML=list.length?list.map(s=>`<span class="pchip ${isF(P(s))?'f':''}"><i>${ph(P(s))}</i>${esc(shortName(P(s)))}<button type="button" data-rm="${esc(s)}" aria-label="شيل">×</button></span>`).join(''):'<span class="hint">مفيش</span>';
    $('#spList').querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ list.splice(list.indexOf(b.dataset.rm),1); draw(); });
    const cands=peopleSorted(x=>x.id!==p.id&&!list.includes(x.id)&&(isF(p)?!isF(x):isF(x)));
    $('#fSpAdd').innerHTML=`<option value="">+ اربط ب${isF(p)?'زوج':'زوجة'} موجود</option>`+cands.map(x=>opt(x)).join(''); };
  draw(); $('#fSpAdd').onchange=e=>{ if(e.target.value){ list.push(e.target.value); draw(); } };
}
async function saveEdit(data,spList){
  const ch=new Map(); const get=id=>ch.get(id)||(()=>{ const c={...P(id)}; c.spouses=[...(c.spouses||[])]; ch.set(id,c); return c; })();
  data.father=$('#fFa')?.value||null; data.mother=$('#fMo')?.value||null;
  if(data.father===data.id) data.father=null; if(data.mother===data.id) data.mother=null;
  const before=spousesOf(data.id);
  data.spouses=[...new Set(spList)]; ch.set(data.id,data);
  for(const s of before) if(!data.spouses.includes(s)){ const o=get(s); o.spouses=o.spouses.filter(x=>x!==data.id); }
  for(const s of data.spouses) if(!before.includes(s)){ const o=get(s); if(!o.spouses.includes(data.id)) o.spouses.push(data.id); }
  // gender change sanity: if now female but listed as someone's father, swap
  for(const k of kidsOf(data.id)){ const kp=P(k); if(isF(data)&&kp.father===data.id&&!kp.mother){ const c=get(k); c.father=null; c.mother=data.id; } if(!isF(data)&&kp.mother===data.id&&!kp.father){ const c=get(k); c.mother=null; c.father=data.id; } }
  await commit([...ch.values()]);
}
async function linkRelative(baseId,rel,other,otherParent){
  const ch=new Map(); const get=id=>ch.get(id)||(()=>{ const c={...P(id)}; c.spouses=[...(c.spouses||[])]; ch.set(id,c); return c; })();
  const O=other; O.spouses=[...(O.spouses||[])]; ch.set(O.id,O);
  const B=get(baseId);
  const marry=(a,b)=>{ if(!a||!b||a.id===b.id) return; if(!a.spouses.includes(b.id)) a.spouses.push(b.id); if(!b.spouses.includes(a.id)) b.spouses.push(a.id); };
  switch(rel){
    case 'father': B.father=O.id; if(P(B.mother)) marry(O,get(B.mother)); break;
    case 'mother': B.mother=O.id; if(P(B.father)) marry(get(B.father),O); break;
    case 'son': case 'daughter':
      if(isF(B)){ O.mother=B.id; if(otherParent) O.father=otherParent; } else { O.father=B.id; if(otherParent) O.mother=otherParent; } break;
    case 'brother': case 'sister':
      if(!P(B.father)&&!P(B.mother)){
        if(P(O.father)||P(O.mother)){ B.father=O.father||null; B.mother=O.mother||null; }
        else { const F={id:newId(),name:'والد '+B.name.replace(/^(الحاج|الحاجة|الشيخ|الأستاذ|الاستاذ|د\.|أ\.)\s+/,'').split(' ')[0],gender:'m',birth:null,death:null,deceased:false,photo:null,notes:'اتضاف تلقائي عشان يربط الإخوات. عدّل اسمه.',father:null,mother:null,spouses:[],created:Date.now()}; ch.set(F.id,F); B.father=F.id; O.father=F.id; }
      } else { O.father=B.father||null; O.mother=B.mother||null; }
      break;
    case 'husband': case 'wife': marry(B,O); break;
  }
  await commit([...ch.values()]);
}

/* ---------- relationship finder ---------- */
function upMap(id){ const m=new Map([[id,{d:0,prev:null}]]); const q=[id]; while(q.length){ const c=q.shift(); const p=P(c); const d=m.get(c).d; for(const par of [p?.father,p?.mother]) if(par&&P(par)&&!m.has(par)){ m.set(par,{d:d+1,prev:c}); q.push(par); } } return m; }
function pathUp(m,from,to){ const path=[]; let c=to; while(c){ path.push(c); c=m.get(c).prev; } return path.reverse(); } // from..to (from at 0)
function blood(a,b){ const ma=upMap(a),mb=upMap(b); let best=null;
  for(const [id,va] of ma){ const vb=mb.get(id); if(!vb) continue; const s=va.d+vb.d; if(!best||s<best.s||(s===best.s&&Math.abs(va.d-vb.d)<Math.abs(best.a-best.b))) best={id,a:va.d,b:vb.d,s}; }
  if(!best) return null;
  const pa=pathUp(ma,a,best.id), pb=pathUp(mb,b,best.id);
  // full vs half sibling detection
  let full=false; if(best.a===1&&best.b===1){ const A=P(a),B=P(b); full=!!(A.father&&A.mother&&A.father===B.father&&A.mother===B.mother); }
  return {...best,pa,pb,full};
}
function bloodTerm(r,bId){ const g=!isF(P(bId)); const {a,b,pa,pb}=r; const M=id=>!isF(P(id));
  if(a===0&&b===0) return {t:'نفس الشخص'};
  if(a===0){ if(b===1) return {t:g?'ابن':'بنت'}; if(b===2) return {t:g?'حفيد':'حفيدة'}; return {t:(g?'ابن ':'بنت ')+'حفيد'.repeat(1)+(b>3?` (الجيل ${AR(b)})`:'')}; }
  if(b===0){ if(a===1) return {t:g?'أبو':'أم'}; const side=M(pa[1])?'من ناحية الأب':'من ناحية الأم'; if(a===2) return {t:g?'جد':'جدة',s:side}; return {t:g?'جد أكبر':'جدة كبرى',s:`(الجيل ${AR(a)}، ${side})`}; }
  if(a===1&&b===1){ if(r.full) return {t:g?'أخ':'أخت'}; const A=P(pa[0]),B=P(pb[0]); const viaF=A.father&&A.father===B.father; return {t:g?'أخ':'أخت',s:viaF?'من الأب':'من الأم'}; }
  if(a===2&&b===1) return {t:M(pa[1])?(g?'عم':'عمة'):(g?'خال':'خالة')};
  if(a===1&&b===2) return {t:(g?'ابن ':'بنت ')+(M(pb[1])?'أخ':'أخت')};
  if(a===2&&b===2) return {t:(g?'ابن ':'بنت ')+(M(pa[1])?(M(pb[1])?'عم':'عمة'):(M(pb[1])?'خال':'خالة'))};
  if(a===3&&b===1) return {t:(M(pa[2])?(g?'عم':'عمة'):(g?'خال':'خالة'))+' '+(M(pa[1])?'الأب':'الأم')};
  if(a===1&&b===3) return {t:(g?'حفيد ':'حفيدة ')+(M(pb[2])?'الأخ':'الأخت')};
  if(a===3&&b===2) return {t:(g?'ابن ':'بنت ')+(M(pa[2])?(M(pb[1])?'عم':'عمة'):(M(pb[1])?'خال':'خالة'))+' '+(M(pa[1])?'الأب':'الأم')};
  return {t:'قريب'+(g?'':'ة')+' من بعيد',s:`الجد المشترك ${shortName(P(r.id))}`};
}
function relationship(aId,bId){
  if(aId===bId) return {txt:'ده نفس الشخص',path:[aId]};
  const A=P(aId),B=P(bId); const hv=isF(B)?'هي':'هو';
  const br=blood(aId,bId);
  if(br){ const t=bloodTerm(br,bId); return {txt:`<b>${esc(shortName(B))}</b> ${hv} <b>${t.t}</b> ${esc(shortName(A))}${t.s?' '+esc(t.s):''}`,path:[...br.pa,...br.pb]}; }
  if(spousesOf(aId).includes(bId)) return {txt:`<b>${esc(shortName(B))}</b> ${hv} <b>${isF(B)?'زوجة':'زوج'}</b> ${esc(shortName(A))}`,path:[aId,bId]};
  for(const s of spousesOf(aId)){ const r=blood(s,bId); if(r){ const t=bloodTerm(r,bId); let term=t.t; if(r.a===1&&r.b===0) term=isF(B)?'حماة':'حما'; return {txt:`<b>${esc(shortName(B))}</b> ${hv} <b>${term}</b> ${esc(shortName(A))} (${t.t} ${isF(A)?'جوزها':'مراته'})`,path:[aId,s,...r.pa.slice(1),...r.pb]}; } }
  for(const s of spousesOf(bId)){ const r=blood(aId,s); if(r){ const t=bloodTerm(r,s); let term=(isF(B)?'زوجة ':'زوج ')+t.t; if(r.a===0&&r.b===1) term=isF(B)?'مرات الابن':'جوز البنت'; return {txt:`<b>${esc(shortName(B))}</b> ${hv} <b>${term}</b> ${esc(shortName(A))}`,path:[...r.pa,...r.pb,bId]}; } }
  return {txt:`مفيش صلة قرابة متسجلة بين <b>${esc(shortName(A))}</b> و<b>${esc(shortName(B))}</b>`,path:[]};
}
function openRel(aId){
  if(S.people.size<2){ toast('ضيف شخصين على الأقل الأول'); return; }
  const list=peopleSorted(); const a=aId||S.sel||list[0].id; const b=list.find(x=>x.id!==a).id;
  openDlg(`<div class="dlg-h"><h3>صلة القرابة</h3>${xBtn}</div>
    <div class="dlg-b"><p class="hint">اختار شخصين والبرنامج هيقولك قرابتهم لبعض من الشجرة.</p>
      <div class="fld"><label for="rA">الشخص الأول</label><select id="rA">${list.map(x=>opt(x,a)).join('')}</select></div>
      <div class="fld"><label for="rB">الشخص التاني</label><select id="rB">${list.map(x=>opt(x,b)).join('')}</select></div>
      <div class="rel-result" id="rOut"></div></div>
    <div class="dlg-f"><button class="btn pri" id="rShow">وريني على الشجرة</button><button class="btn" data-close>قفل</button></div>`);
  let cur=null; const calc=()=>{ cur=relationship($('#rA').value,$('#rB').value); $('#rOut').innerHTML=cur.txt; };
  $('#rA').onchange=calc; $('#rB').onchange=calc; calc();
  $('#rShow').onclick=()=>{ S.hl=new Set(cur.path); S.focus=null; dlg.close(); closeSheet(); render(); fit();
    toast('الطريق بين الاتنين متعلّم باللون'); setTimeout(()=>{ S.hl=new Set(); render(); },12000); };
}
$('#bRel').onclick=()=>openRel();

/* ---------- search ---------- */
const q=$('#q'),res=$('#results'); let resIdx=0;
q.addEventListener('input',()=>{ const t=norm(q.value); if(!t){ res.hidden=true; return; }
  const m=[...S.people.values()].filter(p=>norm(fullName(p)).includes(t)).map(p=>({p,r:norm(fullName(p)).startsWith(t)?0:norm(shortName(p)).includes(t)?1:2})).sort((a,b)=>a.r-b.r).map(x=>x.p).slice(0,12); resIdx=0;
  res.innerHTML=m.length?m.map((p,i)=>`<button data-go="${esc(p.id)}" class="${i===0?'on':''}"><span class="pchip ${isF(p)?'f':''}" style="padding:0;border:0;background:none"><i>${ph(p)}</i></span><span>${esc(shortName(p))} <small>${yearsTxt(p)}</small></span></button>`).join(''):'<p class="hint" style="padding:8px">مفيش حد بالاسم ده</p>';
  res.hidden=false; res.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{ res.hidden=true; q.value=''; q.blur(); goTo(b.dataset.go); }); });
q.addEventListener('keydown',e=>{ const bs=[...res.querySelectorAll('[data-go]')]; if(!bs.length) return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); resIdx=(resIdx+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length; bs.forEach((b,i)=>b.classList.toggle('on',i===resIdx)); }
  if(e.key==='Enter'){ e.preventDefault(); bs[resIdx].click(); } });
document.addEventListener('pointerdown',e=>{ if(!e.target.closest('.search')) res.hidden=true; });

/* ---------- export ---------- */
async function offer(filename,blob){
  const file=new File([blob],filename,{type:blob.type});
  const mobile=matchMedia('(pointer:coarse)').matches;
  if(mobile&&navigator.canShare?.({files:[file]})){ try{ await navigator.share({files:[file],title:famTitle()}); return; }catch(e){ if(e?.name==='AbortError') return; } }
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000); toast('اتنزّل الملف');
}

/* ---------- views & colours ---------- */
const VIEWS=[{id:'classic',l:'كروت'},{id:'tree',l:'شجرة'},{id:'radial',l:'دائرة'},{id:'globe',l:'كورة'}];
const CMODES=[{id:'gender',l:'ولد وبنت',d:'أزرق للولاد، وردي للبنات'},{id:'gen',l:'بالجيل',d:'كل جيل له لون، تعرف مين في نفس المستوى'},{id:'branch',l:'بالفرع',d:'كل ابن من ولاد الجد الكبير وذريته لون واحد'}];
S.view=ls.get('ft-view','classic'); if(!VIEWS.some(v=>v.id===S.view)) S.view='classic';
S.colorMode=ls.get('ft-color','gender'); if(!CMODES.some(v=>v.id===S.colorMode)) S.colorMode='gender';
const G_={globe:null};
function ensureGlobe(){ if(!G_.globe){ G_.globe=new Globe($('#globe'),{onPick:id=>{ if(id) selectPerson(id); else if(S.sel) closeSheet(); }}); addEventListener('resize',()=>{ if(S.view==='globe') G_.globe.resize(); }); } G_.globe.resize(); return G_.globe; }
function globeTheme(){ const cs=getComputedStyle(document.documentElement), v=k=>cs.getPropertyValue(k).trim();
  return {ring:v('--border'),line:v('--line'),accent:v('--accent'),ink:v('--ink'),labelBg:v('--surface')}; }
function renderViewbar(L){
  const vb=$('#viewbar'); const has=S.people.size>0; vb.hidden=!has;
  vb.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===S.view));
  const lg=$('#legend'); const items=S.colorMode==='gender'||!has?[]:legendFor(S.forest,S.colorMode,P);
  lg.hidden=!items.length; lg.innerHTML=items.slice(0,10).map(i=>`<span><i style="background:${i.color}"></i>${esc(i.label)}</span>`).join('');
  $('#gHint').hidden=S.view!=='globe'||!has;
}
$('#viewbar').querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ if(S.view===b.dataset.v) return; S.view=b.dataset.v; ls.set('ft-view',S.view); didFit=false; render(); if(S.view!=='globe'){ didFit=true; fit(false); } });
$('#bColor').onclick=()=>{
  openDlg(`<div class="dlg-h"><h3>تلوين الشجرة</h3>${xBtn}</div><div class="dlg-b"><div class="choose">${CMODES.map(m=>`<button data-m="${m.id}" class="${S.colorMode===m.id?'on':''}"><span class="ic sw">${m.id==='gender'?'<i style="background:var(--male)"></i><i style="background:var(--female)"></i>':m.id==='gen'?'<i style="background:#2E7D6B"></i><i style="background:#B5762A"></i><i style="background:#8E4C8A"></i>':'<i style="background:#3D6FA8"></i><i style="background:#B0473D"></i><i style="background:#5B7F2E"></i>'}</span><span><b>${m.l}</b>${m.d}</span></button>`).join('')}</div></div>`);
  $('#dlgIn').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ S.colorMode=b.dataset.m; ls.set('ft-color',S.colorMode); dlg.close(); render(); });
};

/* ---------- poster export ---------- */
function loadImg(src){ return new Promise(r=>{ const i=new Image(); if(!src.startsWith('data:')) i.crossOrigin='anonymous'; i.onload=()=>r(i); i.onerror=()=>r(null); i.src=src; }); }
async function preloadImages(ids){ const m=new Map(), byUrl=new Map();
  await Promise.all([...ids].map(async id=>{ const p=P(id); if(!p) return; const u=imgSrc(p); if(!byUrl.has(u)) byUrl.set(u,loadImg(u)); let im=await byUrl.get(u);
    if(!im&&p.photo){ const a=avatarURL(p.gender==='f'?'f':'m',ageGroup(p,kidsOf)); if(!byUrl.has(a)) byUrl.set(a,loadImg(a)); im=await byUrl.get(a); }
    m.set(id,im); }));
  return m; }
let lastPoster={style:null,theme:'paper',quality:'xhd',legend:true,split:false};
const POSTER_DIMS={CW:206,CH:248,SG:22,HG:30,VG:100,TG:150};
function posterBranches(){ if(!S.forest?.length||S.focus) return [];
  const size=n=>n.ref?1:1+n.spouses.length+n.children.reduce((a,c)=>a+size(c),0);
  const out=[]; const take=n=>{ const sz=size(n); if(sz<3) return; const kids=n.children.filter(c=>!c.ref&&size(c)>=3);
    if(sz>36&&kids.length>1) kids.forEach(take); else out.push(n.id); };
  const bp=branchPoint(S.forest[0]); (bp?.children||[]).filter(c=>!c.ref).forEach(take); return out; }
async function offerFiles(files){
  if(files.length===1) return offer(files[0].name,files[0]);
  const mobile=matchMedia('(pointer:coarse)').matches;
  if(mobile&&navigator.canShare?.({files})){ try{ await navigator.share({files,title:famTitle()}); return; }catch(e){ if(e?.name==='AbortError') return; } }
  for(const f of files){ const url=URL.createObjectURL(f); const a=document.createElement('a'); a.href=url; a.download=f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),8000); await new Promise(r=>setTimeout(r,400)); }
  toast(`اتنزّلت ${AR(files.length)} صور`);
}
$('#bExport').onclick=()=>{
  if(!S.people.size){ toast('ضيف أفراد الأول'); return; }
  const st=lastPoster.style||(S.view==='globe'?'radial':S.view);
  const gens=S.lay?.gens||0;
  openDlg(`<div class="dlg-h"><h3>صورة الشجرة</h3>${xBtn}</div>
    <div class="dlg-b">
      <div class="fld"><span class="lbl">الشكل</span><div class="seg" id="pStyle">${[['classic','كروت'],['tree','شجرة'],['radial','دائرة']].map(([k,l])=>`<button type="button" data-k="${k}" class="${st===k?'on':''}">${l}</button>`).join('')}</div></div>
      <div class="fld"><span class="lbl">الخلفية</span><div class="seg" id="pTheme">${Object.entries(THEMES).map(([k,t])=>`<button type="button" data-k="${k}" class="${lastPoster.theme===k?'on':''}"><i class="tsw" style="background:${t.bg};border-color:${t.frame}"></i>${t.label}</button>`).join('')}</div></div>
      <div class="fld"><label for="pTitle">العنوان</label><input type="text" id="pTitle" value="${esc(famTitle())}" maxlength="50"></div>
      <div class="fld"><label for="pSub">سطر تحت العنوان (اختياري)</label><input type="text" id="pSub" value="${esc(`${AR(S.people.size)} فرد  ،  ${AR(gens)} أجيال`)}" maxlength="80"></div>
      <div class="fld"><span class="lbl">الجودة</span><div class="seg" id="pQ">${QUALITY.map(q=>`<button type="button" data-k="${q.id}" class="${lastPoster.quality===q.id?'on':''}">${q.label}</button>`).join('')}</div><span class="hint" id="pQhint"></span></div>
      ${S.colorMode!=='gender'?`<label class="check"><input type="checkbox" id="pLegend" ${lastPoster.legend?'checked':''}> اكتب دليل الألوان تحت العنوان</label>`:''}
      ${posterBranches().length>1?`<label class="check"><input type="checkbox" id="pSplit" ${lastPoster.split?'checked':''}> صورة لكل فرع (${AR(posterBranches().length)} صور) عشان الأسامي تبقى كبيرة</label>`:''}
      <div class="prog" id="pProg" hidden><div></div></div><p class="hint" id="pMsg"></p>
    </div>
    <div class="dlg-f"><button class="btn pri" id="pPng">صورة PNG</button><button class="btn" id="pPdf">PDF</button><button class="btn" data-close>إلغاء</button></div>`);
  const pick=(id,key)=>$('#'+id).querySelectorAll('button').forEach(b=>b.onclick=()=>{ lastPoster[key]=b.dataset.k; $('#'+id).querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); hint(); });
  lastPoster.style=st; pick('pStyle','style'); pick('pTheme','theme'); pick('pQ','quality');
  function sceneFor(rootId){ const style=lastPoster.style, colors=S.colors;
    if(style==='classic') return classicScene(layout(POSTER_DIMS,rootId),colors,true);
    const forest=rootId?layout(null,rootId).forest:S.forest; return (style==='tree'?layoutTree:layoutRadial)(forest,P,colors,true); }
  function build(rootId){ const sc=sceneFor(rootId||(S.focus&&P(S.focus)?S.focus:null));
    const legend=S.colorMode!=='gender'&&$('#pLegend')?.checked&&!rootId?legendFor(S.forest,S.colorMode,P):null;
    const base=$('#pTitle').value.trim()||famTitle();
    const L=posterLayout(sc,{title:rootId?`${base}  ،  فرع ${firstName(P(rootId).name)}`:base,subtitle:rootId?'':$('#pSub').value.trim(),legend});
    return {sc,L}; }
  function hint(){ try{ const {L}=build(); const q=QUALITY.find(q=>q.id===lastPoster.quality); const d=posterDims(L,q); $('#pQhint').textContent=`${q.hint}، ${AR(d.W)}×${AR(d.H)} بكسل`; }catch{} }
  hint();
  async function go(fmt){
    const btns=[$('#pPng'),$('#pPdf')]; btns.forEach(b=>b.disabled=true); const prog=$('#pProg'), bar=prog.firstElementChild; prog.hidden=false; $('#pMsg').textContent='بنجهّز الصورة…';
    try{
      try{ await Promise.all(['600 15px "Readex Pro"','500 13px "Readex Pro"','400 12px "Readex Pro"','700 40px "Aref Ruqaa"'].map(f=>document.fonts.load(f))); }catch{}
      const T=THEMES[lastPoster.theme]; const q=QUALITY.find(q=>q.id===lastPoster.quality);
      const roots=$('#pSplit')?.checked?posterBranches():[null];
      const files=[]; const baseName=($('#pTitle').value.trim()||famTitle()).replace(/\s+/g,'-');
      for(let i=0;i<roots.length;i++){
        const rid=roots[i]; const {sc,L}=build(rid); const imgs=await preloadImages(new Set(sc.nodes.map(n=>n.id)));
        const ctx={P:PD,imgOf:p=>imgs.get(p.id),yearsTxt,meta:'',foot:`اتعملت بتطبيق شجرة العيلة  ،  ${new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long'})}`};
        const d=posterDims(L,q,fmt==='pdf'?9000:null); const name=baseName+(rid?'-'+firstName(P(rid).name).replace(/\s+/g,'-'):'');
        if(roots.length>1) $('#pMsg').textContent=`بنجهّز صورة ${AR(i+1)} من ${AR(roots.length)}…`;
        const prog=f=>bar.style.width=(((i+f)/roots.length)*100).toFixed(0)+'%';
        if(fmt==='png'){
          files.push(new File([await renderPNG({W:d.W,H:d.H,draw:g=>{ g.scale(d.s,d.s); drawPoster(g,sc,L,T,ctx); },onProgress:prog})],name+'.png',{type:'image/png'}));
        } else {
          const cv=document.createElement('canvas'); cv.width=d.W; cv.height=d.H; const g=cv.getContext('2d'); g.scale(d.s,d.s); drawPoster(g,sc,L,T,ctx); prog(.8);
          const {jsPDF}=await import('jspdf'); const k=Math.min(1,14000/Math.max(d.W,d.H)); const w=d.W*k,h=d.H*k;
          const doc=new jsPDF({orientation:w>h?'l':'p',unit:'px',format:[w,h],hotfixes:['px_scaling'],compress:true});
          doc.addImage(cv.toDataURL('image/jpeg',0.92),'JPEG',0,0,w,h); files.push(new File([doc.output('blob')],name+'.pdf',{type:'application/pdf'}));
          cv.width=cv.height=1;
        }
      }
      dlg.close(); await offerFiles(files);
    }catch(err){ console.warn(err); $('#pMsg').textContent='الصورة ماطلعتش. جرّب جودة أقل.'; btns.forEach(b=>b.disabled=false); prog.hidden=true; }
  }
  $('#pPng').onclick=()=>go('png'); $('#pPdf').onclick=()=>go('pdf');
  $('#pSplit')?.addEventListener('change',e=>{ lastPoster.split=e.target.checked; });
};

/* ---------- demo ---------- */
function demoPeople(){ const L=[]; let t=1; const mk=(id,name,g,b,d,f,m,sp=[],notes='')=>L.push({id,name,gender:g,birth:b,death:d,deceased:!!d,father:f,mother:m,spouses:sp,photo:null,notes,created:t++});
  mk('d1','الحاج محمود عبد الرحمن','m',1928,2004,null,null,['d2'],'كان بيشتغل في السكة الحديد، وأصله من المنوفية.');
  mk('d2','الحاجة زينب حسن','f',1934,2011,null,null,['d1']);
  mk('d3','أحمد محمود','m',1955,null,'d1','d2',['d4']); mk('d4','سعاد إبراهيم','f',1960,null,null,null,['d3']);
  mk('d5','فاطمة محمود','f',1958,null,'d1','d2',['d6']); mk('d6','مصطفى علي','m',1952,2019,null,null,['d5']);
  mk('d7','حسن محمود','m',1963,null,'d1','d2',['d8']); mk('d8','نادية فؤاد','f',1967,null,null,null,['d7']);
  mk('d9','كريم أحمد','m',1984,null,'d3','d4',['d10']); mk('d10','منى سامي','f',1988,null,null,null,['d9']);
  mk('d11','هبة أحمد','f',1987,null,'d3','d4');
  mk('d12','عمر مصطفى','m',1980,null,'d6','d5'); mk('d13','سارة مصطفى','f',1983,null,'d6','d5');
  mk('d14','يوسف حسن','m',1992,null,'d7','d8'); mk('d15','مريم حسن','f',1995,null,'d7','d8');
  mk('d16','آدم كريم','m',2015,null,'d9','d10'); mk('d17','ليلى كريم','f',2019,null,'d9','d10');
  mk('d18','علي عمر','m',2010,null,'d12',null);
  return L; }
function enterDemo(){ S.demo=true; S.focus=null; S.sel=null; S.people=new Map(demoPeople().map(p=>[p.id,p])); render(); fit(false); }
$('#exitDemo').onclick=()=>{ S.demo=false; S.focus=null; S.sel=null; S.hl=new Set(); closeSheet(); if(!S.code){ showLanding(); return; } S.canWrite=S.role==='edit'; S.people=S.real; render(); fit(false); };
$('#showAll').onclick=()=>{ S.focus=null; render(); fit(); };
$('#fab').onclick=()=>openAddChooser();


/* ---------- helpers ---------- */
function famTitle(){ const n=(S.meta.name||'').trim(); return n?('عيلة '+n.replace(/^عيلة\s*/,'')):'شجرة العيلة'; }
function updateNet(){ const c=$('#offChip'); const pend=OB?OB.list().length:0;
  if(!navigator.onLine){ c.hidden=false; c.textContent=pend?`مفيش نت، ${AR(pend)} تعديل مستني`:'مفيش نت'; } else if(pend){ c.hidden=false; c.textContent='بنحفظ…'; } else c.hidden=true; }
const linkFor=code=>`${location.origin}/?t=${code}`;
const recent={ list:()=>ls.get('ft-recent',[]), add(e){ const l=recent.list().filter(x=>x.code!==e.code); l.unshift({...e,at:Date.now()}); ls.set('ft-recent',l.slice(0,8)); }, drop(code){ ls.set('ft-recent',recent.list().filter(x=>x.code!==code)); } };
async function copy(text){ try{ await navigator.clipboard.writeText(text); toast('اتنسخ'); }catch{ toast('انسخه يدوي'); } }
async function shareLink(url,label){ if(navigator.share){ try{ await navigator.share({title:famTitle(),text:label,url}); return; }catch(e){ if(e?.name==='AbortError') return; } } copy(url); }
let installEvt=null; addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); installEvt=e; });
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent); const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;

/* ---------- share & settings ---------- */
$('#bMenu').onclick=()=>{
  const w=S.canWrite&&!S.demo;
  if(S.demo){ openDlg(`<div class="dlg-h"><h3>المثال</h3>${xBtn}</div><div class="dlg-b"><p class="hint">ده مثال للتجربة. اخرج منه وابدأ شجرة عيلتك.</p></div><div class="dlg-f"><button class="btn pri" id="dExit">اخرج من المثال</button></div>`); $('#dExit').onclick=()=>{ dlg.close(); $('#exitDemo').click(); }; return; }
  const linkRow=(id,url,label)=>`<div class="linkbox"><input id="${id}" value="${esc(url)}" readonly aria-label="${label}"><button class="btn" data-copy="${id}">نسخ</button><button class="btn pri" data-share="${id}" data-label="${esc(label)}">ابعت</button></div>`;
  openDlg(`<div class="dlg-h"><h3>المشاركة والإعدادات</h3>${xBtn}</div>
    <div class="dlg-b">
      ${w?`<div class="fld"><label for="sFam">اسم العيلة</label><div class="linkbox"><input type="text" id="sFam" value="${esc(S.meta.name||'')}" placeholder="مثلاً: عبد الرحمن" maxlength="40" style="direction:rtl;font-size:14px"><button class="btn pri" id="sSave">حفظ</button></div></div>`:''}
      <div class="fld"><div class="role-t"><span class="dot v"></span>لينك المشاهدة</div><p class="hint" style="margin:0">اللي معاه اللينك ده يشوف الشجرة بس.</p>${linkRow('lnkV',linkFor(S.viewCode),'شوف شجرة '+famTitle())}</div>
      ${w&&S.editCode?`<div class="fld"><div class="role-t"><span class="dot"></span>لينك التعديل</div><p class="hint" style="margin:0">اللي معاه اللينك ده يقدر يضيف ويعدّل ويمسح. ابعته للي بتثق فيهم بس.</p>${linkRow('lnkE',linkFor(S.editCode),'ساعدني نكمّل شجرة '+famTitle())}</div>`:''}
      ${standalone?'':`<div><p class="sec-t">على الموبايل زي التطبيق</p><button class="btn pri" id="bInstall">نزّل التطبيق</button></div>`}
      <div><p class="sec-t">نسخة احتياطية</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="bkOut">نزّل نسخة احتياطية</button>${w?'<button class="btn" id="bkIn">استرجع من نسخة</button>':''}</div><p class="hint" id="bkMsg"></p></div>
      <div><button class="btn" id="bOther">افتح شجرة تانية / اعمل جديدة</button></div>
    </div>`);
  $('#dlgIn').querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{ const i=$('#'+b.dataset.copy); i.select(); copy(i.value); });
  $('#dlgIn').querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>shareLink($('#'+b.dataset.share).value,b.dataset.label));
  $('#sSave')?.addEventListener('click',()=>{ const v=$('#sFam').value.trim(); S.meta={...S.meta,name:v}; render(); OB.push({t:'name',name:v}); cacheSave(); flush(); recent.add({code:S.code,name:v,role:S.role}); toast('اتحفظ'); });
  $('#bInstall')?.addEventListener('click',()=>openInstall());
  $('#bkOut').onclick=()=>{ const j=JSON.stringify({app:'family-tree',v:1,meta:S.meta,people:[...S.real.values()]},null,1); offer('family-tree-backup.json',new Blob([j],{type:'application/json'})); };
  $('#bkIn')?.addEventListener('click',()=>$('#fileImport').click());
  $('#bOther').onclick=()=>{ dlg.close(); showLanding(); };
};
$('#switchTree').onclick=()=>{ if(!S.demo) $('#bMenu').click(); };
$('#fileImport').onchange=async e=>{ const file=e.target.files[0]; e.target.value=''; if(!file) return;
  try{ const j=JSON.parse(await file.text()); if(!Array.isArray(j.people)) throw 0;
    const list=j.people.filter(p=>p&&p.id&&p.name).map(p=>({...p,spouses:Array.isArray(p.spouses)?p.spouses:[]}));
    for(let i=0;i<list.length;i+=50) await commit(list.slice(i,i+50));
    if(j.meta?.name||j.meta?.familyName){ const n=j.meta.name||j.meta.familyName; S.meta.name=n; OB.push({t:'name',name:n}); flush(); }
    dlg.close(); render(); fit(); toast(`اترجّع ${AR(list.length)} فرد`);
  }catch{ const m=$('#bkMsg'); if(m) m.textContent='الملف ده مش نسخة احتياطية من الشجرة.'; } };

/* ---------- landing ---------- */
function extractCode(v){ v=String(v||'').trim(); const m=v.match(/[?&#]t=([a-f0-9]{12,40})/i); if(m) return m[1].toLowerCase(); if(/^[a-f0-9]{12,40}$/i.test(v)) return v.toLowerCase(); return null; }
function showLanding(){
  LIVE?.close(); LIVE=null; S.code=null; closeSheet();
  history.replaceState(null,'','/');
  $('#app').hidden=true; const L=$('#landing'); L.hidden=false;
  const rec=recent.list();
  L.innerHTML=`<div class="land-in">
    <div class="land-mark"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 44V26M24 26c0-7-10-6-10-14M24 26c0-7 10-6 10-14M24 34c-5 0-13-1-15-7M24 34c5 0 13-1 15-7" stroke="#F3F6F2" stroke-width="2.6" stroke-linecap="round"/><circle cx="14" cy="9" r="5" fill="#E0A653"/><circle cx="34" cy="9" r="5" fill="#E0A653"/><circle cx="8" cy="26" r="4" fill="#CFE3D6"/><circle cx="40" cy="26" r="4" fill="#CFE3D6"/></svg></div>
    <h1>شجرة العيلة</h1>
    <p class="lead">سجّل عيلتك كلها، من الأجداد للأحفاد. تقول ده ابن مين وده أخو مين، والشجرة بتترتب لوحدها.</p>
    ${!configured?'<p class="err">التطبيق لسه مش متوصل بقاعدة البيانات.</p>':''}
    ${rec.length?`<div class="land-card"><h2>الشجر بتاعتك</h2><div class="recent">${rec.map(r=>`<button data-code="${esc(r.code)}"><span>${esc(r.name?('عيلة '+r.name.replace(/^عيلة\s*/,'')):'شجرة العيلة')}</span><small>${r.role==='edit'?'تعديل':'مشاهدة'}</small></button>`).join('')}</div></div>`:''}
    <div class="land-card"><h2>ابدأ شجرة جديدة</h2>
      <div class="land-row"><div class="fld"><input type="text" id="lName" placeholder="اسم العيلة، مثلاً: عبد الرحمن" maxlength="40"></div><button class="btn pri" id="lCreate">ابدأ</button></div></div>
    <div class="land-card"><h2>معاك لينك من حد في العيلة؟</h2>
      <div class="land-row"><div class="fld"><input type="text" id="lCode" placeholder="الصق اللينك هنا" style="direction:ltr"></div><button class="btn" id="lOpen">افتح</button></div><span class="err" id="lErr" hidden>اللينك ده مش صح</span></div>
    <ul class="feat">
      <li><b>بتترتب لوحدها</b>ضيف الأب والأم والأولاد والشجرة ترسم نفسها.</li>
      <li><b>صلة القرابة</b>اختار أي اتنين وهتعرف ده ابن عم ولا خال ده.</li>
      <li><b>العيلة كلها تضيف</b>ابعت لينك للتعديل أو للمشاهدة بس.</li>
      <li><b>صورة أو PDF</b>طلّع الشجرة كاملة وابعتها على واتساب.</li>
    </ul>
    <button class="btn" id="lDemo">شوف مثال جاهز</button>
    ${standalone?'':'<button class="btn pri" id="lInstall">نزّل التطبيق على موبايلك</button>'}
  </div>`;
  L.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>openTree(b.dataset.code));
  $('#lCreate').onclick=async()=>{ const b=$('#lCreate'); b.disabled=true; b.textContent='لحظة…';
    try{ const t=await api.createTree($('#lName').value.trim()); recent.add({code:t.edit_code,name:t.name,role:'edit'}); await openTree(t.edit_code,true); }
    catch(e){ toast(e.code==='offline'?'محتاج نت عشان تعمل شجرة جديدة':'حصلت مشكلة، جرّب تاني'); b.disabled=false; b.textContent='ابدأ'; } };
  $('#lName').onkeydown=e=>{ if(e.key==='Enter') $('#lCreate').click(); };
  $('#lOpen').onclick=()=>{ const c=extractCode($('#lCode').value); if(!c){ $('#lErr').hidden=false; return; } openTree(c); };
  $('#lInstall')?.addEventListener('click',()=>openInstall());
  $('#lDemo').onclick=()=>{ L.hidden=true; $('#app').hidden=false; S.canWrite=true; enterDemo(); };
}

/* ---------- open a tree ---------- */
let refetchT=null, fetching=false;
function applyServer(t){
  S.treeId=t.id; S.role=t.role; S.viewCode=t.view_code; S.editCode=t.edit_code||null; S.canWrite=t.role==='edit';
  S.meta={name:t.name||''};
  const m=new Map((t.people||[]).map(p=>[p.id,p])); OB.overlay(m,S.meta); S.real=m;
  if(!S.demo) S.people=S.real;
}
async function refetch(){ if(!S.code||fetching) return; fetching=true; const code=S.code;
  try{ const t=await api.openTree(code); if(code!==S.code) return;
    if(!t){ recent.drop(code); toast('اللينك ده مش شغال. ممكن يكون اتغيّر.'); showLanding(); return; }
    applyServer(t); S.loaded=true; S.mode='ready'; cacheSave(); render();
  }catch(e){ if(e.code!=='offline') console.warn(e); } finally{ fetching=false; updateNet(); } }
const nudge=()=>{ clearTimeout(refetchT); refetchT=setTimeout(refetch,400); };
async function openTree(code,fresh=false){
  $('#landing').hidden=true; $('#app').hidden=false;
  LIVE?.close(); S.code=code; S.demo=false; S.sel=null; S.focus=null; S.hl=new Set(); OB=outbox(code); didFit=false;
  ls.set('ft-last',code); history.replaceState(null,'',`/?t=${code}`);
  const c=ls.get('ft-cache-'+code,null);
  if(c){ S.treeId=c.treeId; S.role=c.role; S.viewCode=c.viewCode; S.editCode=c.editCode; S.canWrite=c.role==='edit'; S.meta=c.meta||{name:''};
    const m=new Map((c.people||[]).map(p=>[p.id,p])); OB.overlay(m,S.meta); S.real=S.people=m; S.mode='ready'; }
  else { S.real=S.people=new Map(); S.mode='loading'; S.canWrite=false; }
  render(); if(S.people.size){ didFit=true; fit(false); }
  try{ const t=await api.openTree(code); if(code!==S.code) return;
    if(!t){ recent.drop(code); ls.del('ft-last'); toast('اللينك ده مش شغال. ممكن يكون اتغيّر.'); showLanding(); return; }
    applyServer(t); S.mode='ready'; S.loaded=true; cacheSave(); recent.add({code,name:t.name,role:t.role});
    render(); if(!didFit&&S.people.size){ didFit=true; fit(false); }
    LIVE=liveChannel(t.id,nudge); flush(); showInstallBar();
    if(fresh) setTimeout(()=>openForm({mode:'add'}),300);
  }catch(e){ if(!c){ S.mode='unreachable'; render(); } updateNet(); }
}

/* ---------- quick & bulk adding ---------- */
const FEMALE=new Set('فاطمة زينب مريم سارة هبة منى نادية سعاد ليلى نور هدى آية اية رحمة ياسمين دينا رانيا شيماء أسماء اسماء إيمان ايمان أمل امل سلمى فرح ملك جنى حبيبة روان ندى نهى عائشة عايشة خديجة آمنة امنة سمية حنان عبير ولاء فيروز رقية صفية سناء وفاء نجلاء هالة ريهام مي لبنى سهير عزة أميرة اميرة بسمة شهد تسنيم مروة نسمة رشا غادة إسراء اسراء دعاء سماح نيرة هند سلوى زهرة كريمة نعمة فوزية عفاف ست تحية سعدية بهية نبيلة جميلة لطيفة سميرة أمينة امينة زكية نوال سحر جيهان داليا ميار مريم لينا لين تقى تقوى مودة حلا جودي جوري كنزي ريم رنا لمى لمياء نرمين شيرين يسرا يسرى بثينة ثريا صباح نجاة إنجي انجي حسناء أسيل اسيل منة منه بسنت هايدي نادين ميرنا مارينا جنة جنه سلمي ساره فاطمه زينات عزيزة نفيسة'.split(' '));
const MALE_EXC=new Set('حمزة حمزه أسامة اسامة اسامه طلحة عبادة معاوية عطية عطيه حذيفة حذيفه عكرمة قتادة علاء بهاء ضياء زكرياء زكريا رجاء يحيى مصطفى موسى عيسى مرتضى مجتبى'.split(' '));
function guessGender(name){ const w=String(name||'').trim().replace(/^(الحاج|الحاجة|الشيخ|الأستاذ|الاستاذ|الدكتور|الدكتورة|د\.|أ\.|ام|أم|ابو|أبو)\s+/,'');
  if(/^(الحاجة|الدكتورة|الأستاذة|الاستاذة|ام|أم|ست)\s/.test(String(name).trim())) return 'f';
  const f=w.split(/\s+/)[0]||''; if(FEMALE.has(f)) return 'f'; if(MALE_EXC.has(f)) return 'm';
  if(/(ة|اء)$/.test(f)) return 'f'; return 'm'; }
const toWestern=s=>String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
function parsePersonText(t){ // "أحمد محمود (1950-2010) متوفي"
  let s=toWestern(t).trim(); let birth=null,death=null,deceased=false;
  if(/(متوف[يى]|الله يرحم|رحمه الله|رحمها الله|المرحوم|المرحومة|\(م\)|✝)/.test(s)){ deceased=true; s=s.replace(/(الله يرحمه|الله يرحمها|رحمه الله|رحمها الله|متوف[يى]ة?|\(م\)|✝)/g,'').replace(/^(المرحومة|المرحوم)\s+/,''); }
  const m=s.match(/\(?\s*(1[6-9]\d\d|20\d\d)\s*(?:[-–—/]\s*(1[6-9]\d\d|20\d\d)?)?\s*\)?/);
  if(m){ birth=+m[1]; if(m[2]){ death=+m[2]; deceased=true; } s=s.replace(m[0],' '); }
  if(!birth){ const d=s.match(/\(?\s*[-–—]\s*(1[6-9]\d\d|20\d\d)\s*\)?/); if(d){ death=+d[1]; deceased=true; s=s.replace(d[0],' '); } }
  const name=s.replace(/[()]/g,' ').replace(/\s+/g,' ').trim();
  return {name,birth,death,deceased}; }
function blankPerson(o){ return {id:newId(),created:Date.now(),name:'',gender:'m',birth:null,death:null,deceased:false,photo:null,notes:'',father:null,mother:null,spouses:[],...o}; }

function openAddChooser(){
  const sel=S.sel&&P(S.sel);
  openDlg(`<div class="dlg-h"><h3>إضافة</h3>${xBtn}</div><div class="dlg-b"><div class="choose">
    <button id="cOne"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg></span><span><b>فرد واحد</b>بالتفاصيل كاملة: صورة وسنين وملاحظات.</span></button>
    ${sel?`<button id="cKids"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="12" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5V12M5 16.5V14h14v2.5M12 12v4.5"/></svg></span><span><b>ولاد ${esc(sel.name.split(' ')[0])} مرة واحدة</b>اكتب الأسماء ورا بعض، كل اسم في سطر.</span></button>`:''}
    <button id="cType"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M8 11h12M12 16h8M4 11v0M4 16v0"/></svg></span><span><b>اكتب العيلة كلها</b>اكتبها زي ما بتكتبها في ورقة: كل جيل بشَرطة زيادة. ممكن تلصقها من واتساب.</span></button>
  </div></div>`);
  $('#cOne').onclick=()=>openForm({mode:'add'});
  $('#cKids')?.addEventListener('click',()=>openKids(sel.id));
  $('#cType').onclick=()=>openTypeFamily(sel?sel.id:null);
}

/* many children at once */
function openKids(baseId){
  const B=P(baseId); if(!B) return; const sp=spousesOf(baseId);
  openDlg(`<form id="kf" novalidate><div class="dlg-h"><h3>ولاد ${esc(shortName(B))}</h3>${xBtn}</div>
    <div class="dlg-b">
      <div class="fld"><label for="kOther">${isF(B)?'الأب':'الأم'}</label><select id="kOther"><option value="">مش معروف / مش متسجل</option>${sp.map(s=>opt(P(s),sp.length===1?s:null)).join('')}</select></div>
      <p class="hint" style="margin:0">اكتب الاسم ودوس Enter للي بعده. النوع بيتحدد من الاسم، ولو غلط دوس عليه يتغير.</p>
      <div class="krows" id="krows"></div>
      <button type="button" class="addrow" id="kAdd">+ كمان واحد</button>
    </div>
    <div class="dlg-f"><button class="btn pri" type="submit" id="kSave">حفظ</button><button class="btn" type="button" data-close>إلغاء</button></div></form>`);
  const rows=$('#krows'); const first=n=>(n||'').replace(/^(الحاج|الحاجة|الشيخ|الأستاذ|الاستاذ|د\.|أ\.)\s+/,'').split(' ')[0]||'';
  function addRow(focus){ const r=document.createElement('div'); r.className='krow';
    r.innerHTML=`<input type="text" placeholder="الاسم الأول" maxlength="60" aria-label="الاسم"><button type="button" class="gtog" data-g="m">ابن</button><input type="number" inputmode="numeric" placeholder="الميلاد" aria-label="سنة الميلاد" min="1700" max="${NOW_Y}"><button type="button" class="rm" aria-label="شيل">×</button>`;
    const [nm,g,yr,rm]=[r.children[0],r.children[1],r.children[2],r.children[3]]; let manual=false;
    const setG=v=>{ g.dataset.g=v; g.textContent=v==='f'?'بنت':'ابن'; g.classList.toggle('f',v==='f'); };
    nm.addEventListener('input',()=>{ if(!manual) setG(guessGender(nm.value)); if(r===rows.lastElementChild&&nm.value.trim()) addRow(false); });
    nm.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); const nx=r.nextElementSibling; if(nx) nx.children[0].focus(); else addRow(true); } });
    g.onclick=()=>{ manual=true; setG(g.dataset.g==='f'?'m':'f'); };
    rm.onclick=()=>{ if(rows.children.length>1) r.remove(); else { nm.value=''; yr.value=''; } };
    rows.appendChild(r); if(focus) nm.focus(); }
  addRow(true);
  $('#kAdd').onclick=()=>addRow(true);
  $('#kf').onsubmit=async e=>{ e.preventDefault();
    const other=$('#kOther').value||null; const out=[]; const fatherName=isF(B)?(other?first(P(other).name):''):first(B.name); const surname=fatherName?' '+fatherName:'';
    [...rows.children].forEach(r=>{ const raw=r.children[0].value.trim(); if(!raw) return; const pp=parsePersonText(raw); let name=pp.name;
      const y=parseInt(toWestern(r.children[2].value))||pp.birth;
      const c=blankPerson({name,gender:r.children[1].dataset.g,birth:y||null,death:pp.death,deceased:pp.deceased});
      if(isF(B)){ c.mother=B.id; c.father=other; } else { c.father=B.id; c.mother=other; }
      out.push(c); });
    if(!out.length){ toast('اكتب اسم واحد على الأقل'); return; }
    dlg.close(); await commit(out); toast(`اتضاف ${AR(out.length)} ${out.length===1?'فرد':'أفراد'}`); goTo(baseId); };
}

/* type the whole family as indented text */
function parseFamilyText(text){
  const lines=toWestern(text).split(/\r?\n/); const items=[]; 
  for(const raw of lines){ if(!raw.trim()) continue;
    const lead=raw.match(/^[\s ]*([-–—*•ـ>]+)?\s*/); let depth=0;
    if(lead[1]) depth=lead[1].replace(/\s/g,'').length; else { const sp=raw.match(/^[  \t]*/)[0].replace(/\t/g,'  ').length; depth=Math.floor(sp/2); }
    const body=raw.slice(lead[0].length).trim(); if(!body) continue;
    const parts=body.split(/\s*[+＋&]\s*|\s+(?:متجوز|متجوزة|زوجته|جوزها|مراته)\s+/).filter(Boolean);
    const main=parsePersonText(parts[0]); if(!main.name) continue;
    const spouses=parts.slice(1).map(parsePersonText).filter(x=>x.name);
    items.push({depth,main,spouses}); }
  // normalise depth jumps (child can only be 1 deeper than parent)
  let prev=-1; for(const it of items){ if(it.depth>prev+1) it.depth=prev+1; prev=it.depth; }
  return items; }
function openTypeFamily(anchorId){
  const A=anchorId?P(anchorId):null;
  const sample=A?`- ${guessGender(A.name)==='f'?'':''}أحمد 1955 + سعاد\n-- كريم 1984\n-- هبة 1987\n- فاطمة 1958\n- حسن (1963-2019)`:`محمود عبد الرحمن (1928-2004) + زينب حسن\n- أحمد 1955 + سعاد\n-- كريم 1984\n-- هبة 1987\n- فاطمة 1958\n- حسن 1963`;
  openDlg(`<div class="dlg-h"><h3>${A?'ذريّة '+esc(shortName(A)):'اكتب العيلة'}</h3>${xBtn}</div>
    <div class="dlg-b">
      <div class="tf-help">كل شخص في سطر. ${A?'السطر اللي بيبدأ بـ <code>-</code> يبقى ابن أو بنت '+esc(A.name.split(' ')[0])+'، و<code>--</code> حفيد، وهكذا.':'أول سطر الجد، و<code>-</code> قبل الاسم يبقى ابنه، و<code>--</code> حفيده، وهكذا.'} اكتب الزوجة بعد <code>+</code>، والسنين بين قوسين <code>(1950-2010)</code>. اللي اسمه متسجل قبل كده بيتربط بيه بدل ما يتكرر.</div>
      <div class="fld"><textarea id="tfText" placeholder="${esc(sample)}" spellcheck="false"></textarea></div>
      <div class="land-row" style="justify-content:space-between;align-items:center"><span class="tf-sum" id="tfSum">اكتب فوق وهتشوف الشجرة هنا</span><button type="button" class="btn" id="tfSample" style="height:34px;font-size:12.5px">حط مثال</button></div>
      <div class="tf-prev" id="tfPrev" hidden></div>
    </div>
    <div class="dlg-f"><button class="btn pri" id="tfSave" disabled>ضيفهم للشجرة</button><button class="btn" data-close>إلغاء</button></div>`);
  const ta=$('#tfText'); let items=[]; const gOver=new Map(); // key -> gender override
  const existingByName=new Map(); { const cnt=new Map(); for(const p of S.people.values()){ for(const k of new Set([norm(p.name),norm(nameInfo(p.id).units.slice(0,2).join(' ')),norm(shortName(p)),norm(fullName(p))])){ cnt.set(k,(cnt.get(k)||0)+1); existingByName.set(k,p.id); } } for(const [k,c] of cnt) if(c>1) existingByName.delete(k); }
  const key=(i,j)=>i+':'+j;
  function draw(){
    items=parseFamilyText(ta.value); const prev=$('#tfPrev');
    if(!items.length){ prev.hidden=true; $('#tfSum').textContent='اكتب فوق وهتشوف الشجرة هنا'; $('#tfSave').disabled=true; return; }
    let nNew=0,nEx=0;
    prev.innerHTML=items.map((it,i)=>{ const ex=existingByName.get(norm(it.main.name)); if(ex) nEx++; else nNew++; nNew+=it.spouses.length;
      const g=gOver.get(key(i,0))||(ex?P(ex).gender:guessGender(it.main.name));
      const yrs=it.main.birth||it.main.death?` <small>${it.main.birth?AR(it.main.birth):'؟'}${it.main.deceased?' – '+(it.main.death?AR(it.main.death):'؟'):''}</small>`:(it.main.deceased?' <small>رحمه الله</small>':'');
      return `<div class="tf-line"><span class="ind" style="width:${(A?it.depth+1:it.depth)*14}px"></span><button type="button" class="gtog ${g==='f'?'f':''}" data-k="${key(i,0)}" ${ex?'disabled':''}>${g==='f'?'بنت':'ولد'}</button><span>${esc(it.main.name)}${yrs}</span>${ex?'<span class="ex">موجود</span>':''}${it.spouses.map((s,j)=>{ const sg=gOver.get(key(i,j+1))||(g==='f'?'m':'f'); return ` <span class="sp">+ ${esc(s.name)}</span>`; }).join('')}</div>`; }).join('');
    prev.hidden=false;
    $('#tfSum').textContent=`هيتضاف ${AR(nNew)} ${nNew===1?'فرد':'أفراد'}${nEx?`، و${AR(nEx)} ${nEx===1?"موجود هيتربط":"موجودين هيتربطوا"}`:''}`;
    $('#tfSave').disabled=!nNew;
    prev.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ const cur=b.classList.contains('f')?'f':'m'; gOver.set(b.dataset.k,cur==='f'?'m':'f'); draw(); });
  }
  let t; ta.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(draw,150); });
  $('#tfSample').onclick=()=>{ ta.value=sample; draw(); ta.focus(); };
  setTimeout(()=>ta.focus(),60);
  $('#tfSave').onclick=async()=>{
    const ch=new Map(); const get=id=>ch.get(id)||(()=>{ const c={...P(id)}; c.spouses=[...(c.spouses||[])]; ch.set(id,c); return c; })();
    const stack=[]; let added=0;
    items.forEach((it,i)=>{
      const exId=existingByName.get(norm(it.main.name));
      let me;
      if(exId){ me=get(exId); }
      const parent=it.depth===0?(A?get(A.id):null):stack[it.depth-1];
      if(!exId){ me=blankPerson({...it.main,gender:gOver.get(key(i,0))||guessGender(it.main.name)}); ch.set(me.id,me); added++; }
      if(parent&&!exId){ const ps=parent.spouses.length===1?parent.spouses[0]:null;
        if(isF(parent)){ me.mother=parent.id; me.father=ps; } else { me.father=parent.id; me.mother=ps; } }
      it.spouses.forEach((s,j)=>{ const sx=existingByName.get(norm(s.name)); let sp;
        if(sx) sp=get(sx); else { sp=blankPerson({...s,gender:gOver.get(key(i,j+1))||(isF(me)?'m':'f')}); ch.set(sp.id,sp); added++; }
        if(!me.spouses.includes(sp.id)) me.spouses.push(sp.id); if(!sp.spouses.includes(me.id)) sp.spouses.push(me.id); });
      stack[it.depth]=me; stack.length=it.depth+1;
    });
    const list=[...ch.values()]; dlg.close();
    for(let k=0;k<list.length;k+=50) await commit(list.slice(k,k+50));
    toast(`اتضاف ${AR(added)} ${added===1?'فرد':'أفراد'}`); S.focus=null; render(); fit();
  };
}

/* ---------- boot ---------- */
const setHdr=()=>{ const h=document.querySelector('.top'); if(h&&h.offsetHeight) document.documentElement.style.setProperty('--hdr',h.getBoundingClientRect().bottom+'px'); };
addEventListener('resize',setHdr); new ResizeObserver(setHdr).observe(document.querySelector('.top'));
addEventListener('online',()=>{ updateNet(); flush().then(refetch); });
addEventListener('offline',updateNet);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&S.code){ flush(); nudge(); } });
setInterval(()=>{ if(S.code&&document.visibilityState==='visible') refetch(); },60000);
addEventListener('resize',()=>{ clearTimeout(window.__rz); window.__rz=setTimeout(()=>{ if(!didFit) fit(false); },150); });
registerSW({immediate:true});
apply();
{ const fromUrl=extractCode(location.search)||extractCode(location.hash); const last=ls.get('ft-last',null);
  if(fromUrl) openTree(fromUrl); else if(last) openTree(last); else showLanding(); }

/* ---------- light / dark with a sunrise-sunset reveal ---------- */
const mqDark=matchMedia('(prefers-color-scheme: dark)');
const effTheme=()=>document.documentElement.dataset.theme||(mqDark.matches?'dark':'light');
function setThemeColor(){ const m=document.querySelector('meta[name="theme-color"]'); if(m) m.content=effTheme()==='dark'?'#0E1412':'#1F3A31'; }
{ const t=ls.get('ft-theme',null); if(t==='dark'||t==='light') document.documentElement.dataset.theme=t; setThemeColor(); }
function applyTheme(t){ document.documentElement.dataset.theme=t; ls.set('ft-theme',t); setThemeColor(); if(S.view==='globe'&&G_.globe){ G_.globe.theme=globeTheme(); G_.globe.draw(); } }
$('#bTheme').onclick=e=>{
  const next=effTheme()==='dark'?'light':'dark'; const btn=e.currentTarget.getBoundingClientRect();
  const x=btn.left+btn.width/2, y=btn.top+btn.height/2, R=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!document.startViewTransition||reduce){ const h=document.documentElement; h.classList.add('theme-anim'); applyTheme(next); setTimeout(()=>h.classList.remove('theme-anim'),500); return; }
  const tr=document.startViewTransition(()=>applyTheme(next));
  tr.ready.then(()=>{
    // night falls from the button outward; morning rises the same way, with a soft edge
    document.documentElement.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${R}px at ${x}px ${y}px)`]},{duration:700,easing:'cubic-bezier(.65,0,.25,1)',pseudoElement:'::view-transition-new(root)'});
    document.documentElement.animate({filter:[next==='dark'?'brightness(1)':'brightness(.85)',next==='dark'?'brightness(.75)':'brightness(1)']},{duration:700,easing:'ease-out',pseudoElement:'::view-transition-old(root)'});
  }).catch(()=>{});
};
mqDark.addEventListener('change',()=>{ setThemeColor(); if(S.view==='globe'&&G_.globe){ G_.globe.theme=globeTheme(); G_.globe.draw(); } });

/* ---------- install the app ---------- */
const UA=navigator.userAgent;
const inApp=/FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|; wv\)/i.test(UA);
const isAndroid=/Android/i.test(UA), isSafari=isIOS&&/Safari/i.test(UA)&&!/CriOS|FxiOS|EdgiOS/i.test(UA);
function showInstallBar(){ const dismissed=ls.get('ft-inst-x',0); $('#instBar').hidden=standalone||(Date.now()-dismissed<5*864e5)||!S.code; }
$('#instX').onclick=()=>{ ls.set('ft-inst-x',Date.now()); $('#instBar').hidden=true; };
$('#instGo').onclick=()=>openInstall();
addEventListener('appinstalled',()=>{ $('#instBar').hidden=true; installEvt=null; toast('اتنزّل التطبيق، هتلاقيه على الشاشة الرئيسية'); });
const icShare='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
const icPlus='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const icDots='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
async function openInstall(){
  if(standalone){ toast('انت فاتح التطبيق بالفعل'); return; }
  if(installEvt){ try{ installEvt.prompt(); const r=await installEvt.userChoice; if(r?.outcome==='accepted'){ $('#instBar').hidden=true; } installEvt=null; return; }catch{} }
  const link=S.code?linkFor(S.editCode||S.viewCode||S.code):location.origin;
  let steps;
  if(inApp) steps=`<li>البرنامج اللي انت فاتح منه (فيسبوك أو انستجرام) مش بيسمح بالتنزيل.</li><li>دوس ${icDots} فوق واختار <b>افتح في المتصفح</b>${isIOS?' (Safari)':' (Chrome)'}.</li><li>هناك هتلاقي زرار <b>نزّل التطبيق</b>.</li>`;
  else if(isIOS) steps=isSafari?`<li>دوس زرار المشاركة ${icShare} اللي تحت في Safari.</li><li>انزل شوية واختار <b>Add to Home Screen</b> ${icPlus} (إضافة إلى الشاشة الرئيسية).</li><li>دوس <b>Add</b> فوق، وهتلاقي الأيقونة على الشاشة.</li>`
    :`<li>دوس زرار المشاركة ${icShare} اللي جنب العنوان فوق.</li><li>اختار <b>Add to Home Screen</b> ${icPlus}.</li><li>لو مش لاقيها، افتح اللينك في <b>Safari</b> وكرر نفس الخطوات.</li>`;
  else if(isAndroid) steps=`<li>دوس ${icDots} فوق في المتصفح.</li><li>اختار <b>تثبيت التطبيق</b> أو <b>Add to Home screen</b>.</li><li>وافق، وهتلاقي الأيقونة على الشاشة زي أي تطبيق.</li>`;
  else steps=`<li>في Chrome أو Edge دوس على أيقونة التثبيت ${icPlus} في آخر شريط العنوان.</li><li>أو من القايمة ${icDots} اختار <b>تثبيت شجرة العيلة</b>.</li><li>على الموبايل افتح نفس اللينك ونزّله من هناك.</li>`;
  openDlg(`<div class="dlg-h"><h3>نزّل التطبيق</h3>${xBtn}</div><div class="dlg-b">
    <div class="inst-hero"><img src="/pwa-192.png" alt=""><p class="hint" style="margin:0">بيتفتح زي أي تطبيق من الشاشة الرئيسية، ومن غير نت بيعرض آخر نسخة من الشجرة.</p></div>
    <ol class="inst-steps">${steps}</ol>
    <div class="linkbox"><input id="instLink" value="${esc(link)}" readonly aria-label="لينك التطبيق"><button class="btn" id="instCopy">نسخ اللينك</button></div>
  </div>`);
  $('#instCopy').onclick=()=>{ $('#instLink').select(); copy($('#instLink').value); };
}
