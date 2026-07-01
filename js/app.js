/* ============================================================
   slide-layout-builder — app.js
   Extracted/refactored from the original single-file v1.2 build.
   Liquid Glass logic itself now lives in liquid-glass.js.
   ============================================================ */

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
const $ = id => document.getElementById(id);

// Physical slide/page sizes. Each entry is {w,h,unit}; 'unit' is 'in' or
// 'mm'. These are REAL dimensions (not just aspect-ratio numbers) so PDF
// and PPTX export can size pages exactly, not just guess from a ratio.
const RATIOS = {
  '16:9'  : {w:13.333, h:7.5,  unit:'in'}, // standard widescreen slide
  '4:3'   : {w:10,     h:7.5,  unit:'in'}, // standard slide
  '1:1'   : {w:8,      h:8,    unit:'in'}, // square
  'A3'    : {w:297,    h:420,  unit:'mm'},
  'A4'    : {w:210,    h:297,  unit:'mm'},
  'A5'    : {w:148,    h:210,  unit:'mm'},
  'Letter': {w:8.5,    h:11,   unit:'in'},
  'Legal' : {w:8.5,    h:14,   unit:'in'},
  'Ledger': {w:11,     h:17,   unit:'in'}, // a.k.a. Tabloid
};

function mmToIn(mm){ return mm/25.4; }
function pxToIn(px){ return px/96; } // CSS reference pixel = 1/96in

// Resolves S.ratio (including 'Custom') to a {w,h,unit} physical size.
function getCurrentSize(){
  if(S.ratio==='Custom') return S.customSize;
  return RATIOS[S.ratio];
}
// Converts any {w,h,unit} size to inches, for aspect-ratio math and
// PDF/PPTX page sizing (both ultimately measure in inches).
function sizeToInches(size){
  const conv = size.unit==='mm' ? mmToIn : size.unit==='px' ? pxToIn : (v=>v);
  return {w:conv(size.w), h:conv(size.h)};
}

function setRatio(v){
  S.ratio=v;
  $('custom-size-row').style.display = v==='Custom' ? 'flex' : 'none';
  computeCanvasSize();
}
function updateCustomSize(){
  const w=+$('custom-w').value, h=+$('custom-h').value, unit=$('custom-unit').value;
  if(!w||!h) return;
  S.customSize={w,h,unit};
  computeCanvasSize();
}

const PALETTE = ['#0a84ff','#30d158','#ff9f0a','#ff453a','#bf5af2','#5ac8fa','#ffd60a','#ff6961','#2c2c2e','#48484a','#636366','#8e8e93','#ffffff','#1c3d5a','#1a3a2a','#3d1a0a','#2d1a3d','#1a2d3d','#3a1a1a','#1a3a3a'];
const FONTS = {sf:'-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif',dm:'"DM Sans",sans-serif',mono:'"DM Mono",monospace'};

// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════
const S = {
  ratio:'16:9', cols:12, rows:7, pitch:1,
  gutter:8, bg:'#111111', bgImage:null, bgFit:'cover', bgDim:0,
  customSize:{w:1920,h:1080,unit:'px'},
  tiles:[], selectedId:null, mode:'draw', nextId:1
};
let cellW=0,cellH=0,canvasW=0,canvasH=0;

function newTileDefaults(overrides={}){
  return {
    id:S.nextId++, col:0,row:0,colSpan:2,rowSpan:2,
    bg:'#0a84ff', fillet:16,
    headline:'',label:'',icon:'', layout:'bottom-left', fontKey:'sf',
    opacity:1, textLight:true, headlineSize:null, labelSize:null,
    styleMode:'opaque',
    glassBlur:12, glassBrightness:1.05, glassSpec:true,
    rimOffset:5, rimOpacity:0.32,
    tintRGBA:{r:10,g:132,b:255,a:0.4},
    lgScale:60, lgTintOp:0, lgTintColor:'#ffffff',
    ...overrides
  };
}

// ════════════════════════════════════════════
// CANVAS SIZING
// ════════════════════════════════════════════
function computeCanvasSize(){
  const area=$('canvas-area');
  const aw=area.clientWidth-80, ah=area.clientHeight-80;
  const {w:rw,h:rh}=sizeToInches(getCurrentSize());
  let w=aw, h=aw*rh/rw;
  if(h>ah){h=ah;w=h*rw/rh;}
  canvasW=Math.round(w); canvasH=Math.round(h);
  const sc=$('slide-canvas');
  sc.style.width=canvasW+'px'; sc.style.height=canvasH+'px';
  $('canvas-wrap').style.width=canvasW+'px'; $('canvas-wrap').style.height=canvasH+'px';
  computeCell(); drawGrid(); renderAllTiles();
}
function computeCell(){cellW=canvasW/S.cols; cellH=canvasH/S.rows;}

// ════════════════════════════════════════════
// GRID
// ════════════════════════════════════════════
function drawGrid(){
  const cv=$('grid-overlay');
  cv.width=canvasW; cv.height=canvasH;
  cv.style.width=canvasW+'px'; cv.style.height=canvasH+'px';
  const ctx=cv.getContext('2d'); ctx.clearRect(0,0,canvasW,canvasH);
  ctx.strokeStyle='rgba(255,255,255,0.035)'; ctx.lineWidth=1;
  const p=S.pitch;
  for(let c=0;c<=S.cols/p;c++){const x=c*p*cellW;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvasH);ctx.stroke();}
  for(let r=0;r<=S.rows/p;r++){const y=r*p*cellH;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvasW,y);ctx.stroke();}
  ctx.strokeStyle='rgba(255,255,255,0.09)';
  for(let c=0;c<=S.cols;c++){const x=c*cellW;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvasH);ctx.stroke();}
  for(let r=0;r<=S.rows;r++){const y=r*cellH;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvasW,y);ctx.stroke();}
}

// ════════════════════════════════════════════
// SNAP
// ════════════════════════════════════════════
function snap(px,py){
  const p=S.pitch;
  return {c:Math.max(0,Math.round(px/cellW/p)*p), r:Math.max(0,Math.round(py/cellH/p)*p)};
}
function tRect(t){
  return {x:t.col*cellW+S.gutter/2, y:t.row*cellH+S.gutter/2,
          w:t.colSpan*cellW-S.gutter, h:t.rowSpan*cellH-S.gutter};
}

// ════════════════════════════════════════════
// RENDER TILE
// Liquid Glass logic itself lives in js/liquid-glass.js (window.LiquidGlass).
// ════════════════════════════════════════════
function renderAllTiles(){
  document.querySelectorAll('.tile').forEach(e=>e.remove());
  S.tiles.forEach(t=>renderTile(t));
  updateTileList(); updateStatus();
}

function renderTile(t){
  let el=document.getElementById('tile-'+t.id);
  if(!el){
    el=document.createElement('div');
    el.className='tile'; el.id='tile-'+t.id;
    $('slide-canvas').appendChild(el);
    attachTileEvents(el,t.id);
  }
  const r=tRect(t);
  el.style.cssText='';
  el.style.position='absolute';
  el.style.left=r.x+'px'; el.style.top=r.y+'px';
  el.style.width=r.w+'px'; el.style.height=r.h+'px';
  el.style.borderRadius=(t.fillet??16)+'px';
  el.style.opacity=t.opacity??1;
  el.style.overflow='hidden';
  el.style.cursor='move';
  el.style.zIndex='10';

  const mode=t.styleMode||'opaque';
  const blur=t.glassBlur||12;

  // ---- SURFACE layer: background + blur + (for liquid mode) the SVG
  // displacement filter. This layer holds NO text, so the lens
  // distortion never touches the headline/label. ----
  let surfaceStyle='position:absolute;inset:0;border-radius:inherit;z-index:0;';
  if(mode==='opaque'){
    surfaceStyle+=`background:${t.bg||'#333'};`;
    LiquidGlass.remove(t.id);
  } else if(mode==='glass'){
    surfaceStyle+=`background:rgba(255,255,255,0.06);backdrop-filter:blur(${blur}px) brightness(${t.glassBrightness||1.05});-webkit-backdrop-filter:blur(${blur}px) brightness(${t.glassBrightness||1.05});`;
    LiquidGlass.remove(t.id);
  } else if(mode==='tinted'){
    const ra=t.tintRGBA||{r:10,g:132,b:255,a:0.4};
    surfaceStyle+=`background:rgba(${ra.r},${ra.g},${ra.b},${ra.a});backdrop-filter:blur(${blur}px);-webkit-backdrop-filter:blur(${blur}px);`;
    LiquidGlass.remove(t.id);
  } else if(mode==='liquid'){
    LiquidGlass.ensure(t.id, r.w, r.h, {lgScale:t.lgScale||60, glassBlur:t.glassBlur||8});
    const lgBlur=t.glassBlur||6;
    surfaceStyle+=`background:rgba(255,255,255,0.03);backdrop-filter:blur(${lgBlur}px) brightness(1.08);-webkit-backdrop-filter:blur(${lgBlur}px) brightness(1.08);filter:url(#lgf-${t.id});`;
  }

  // ---- CONTENT layer: headline/label/icon. Absolutely positioned,
  // never filtered, so text always stays crisp regardless of mode. ----
  const layout=t.layout||'bottom-left';
  const ai=layout==='center'?'center':'flex-start';
  const jc=layout==='center'?'center':(layout==='top-left'?'flex-start':'flex-end');
  const ta=layout==='center'?'center':'left';

  const light=t.textLight!==false;
  const hl=light?'rgba(255,255,255,0.95)':'rgba(0,0,0,0.92)';
  const lb=light?'rgba(255,255,255,0.62)':'rgba(0,0,0,0.6)';
  const fontStack=FONTS[t.fontKey||'sf'];
  const fs=t.headlineSize||Math.min(Math.max(r.w/4,14),58);
  const ls=t.labelSize||Math.min(Math.max(r.w/10,9),20);
  const iconSz=Math.min(r.h*0.28,38);

  let contentInner='';
  if(layout==='icon-top'&&t.icon) contentInner+=`<div style="font-size:${iconSz}px;line-height:1;margin-bottom:5px">${t.icon}</div>`;
  else if(t.icon) contentInner+=`<div style="font-size:${Math.min(iconSz,28)}px;line-height:1;margin-bottom:3px">${t.icon}</div>`;
  if(t.headline) contentInner+=`<div class="t-headline" style="font-size:${fs}px;color:${hl};font-family:${fontStack}">${t.headline}</div>`;
  if(t.label) contentInner+=`<div class="t-label" style="font-size:${ls}px;color:${lb};font-family:${fontStack}">${t.label}</div>`;

  const contentStyle=`position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:${ai};justify-content:${jc};text-align:${ta};padding:10px 12px;box-sizing:border-box;pointer-events:none;`;

  // ---- OVERLAYS: specular highlight / rim / bottom shine. Sit above
  // the content layer (matches the original paint order) but are
  // likewise never part of the filtered surface. ----
  let overlays='';
  if(mode!=='opaque'&&t.glassSpec!==false){
    const rimOff=t.rimOffset??5;
    const rimOp=t.rimOpacity??0.32;
    const rimR=Math.max(0,(t.fillet??16)-rimOff);
    const tintLayer=mode==='liquid'&&t.lgTintOp>0
      ?`<div style="position:absolute;inset:0;border-radius:inherit;background:${t.lgTintColor||'#fff'};opacity:${t.lgTintOp||0}"></div>`:'';
    overlays=`<div style="position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:2">
      <div class="lg-specular"></div>
      <div class="lg-rim" style="top:${rimOff}px;left:${rimOff}px;right:${rimOff}px;bottom:${rimOff}px;border-radius:${rimR}px;border-color:rgba(255,255,255,${rimOp})"></div>
      <div class="lg-bottom-shine"></div>
      ${tintLayer}
    </div>`;
  }

  el.innerHTML=`<div class="tile-surface" style="${surfaceStyle}"></div>`+
               `<div class="tile-content" style="${contentStyle}">${contentInner}</div>`+
               overlays;

  // Resize handles
  ['tl','tr','bl','br','t','b','l','r'].forEach(pos=>{
    const h=document.createElement('div');
    h.className=`resize-handle ${pos}`; h.dataset.handle=pos;
    el.appendChild(h);
  });

  if(t.id===S.selectedId) el.classList.add('selected');
}

// ════════════════════════════════════════════
// DRAG / RESIZE
// ════════════════════════════════════════════
function attachTileEvents(el,id){
  el.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('resize-handle')){
      startResize(e,S.tiles.find(t=>t.id===id),e.target.dataset.handle);
    } else startDrag(e,id);
    selectTile(id); e.stopPropagation();
  });
}
// Dragging only ever changes position, never size — so the Liquid
// Glass filter (which depends only on size/aspect) never needs to be
// touched mid-drag. We move the element directly via left/top and
// defer the full renderTile() (text reflow, resize handles, etc.) to
// mouseup. rAF-batching also protects against mousemove firing faster
// than the display can paint.
function startDrag(e,id){
  const t=S.tiles.find(t=>t.id===id);
  const el=document.getElementById('tile-'+id);
  const sx=e.clientX,sy=e.clientY,oc=t.col,or=t.row;
  setMode('select');
  let pendingCol=oc, pendingRow=or, rafId=null;
  const applyPosition=()=>{
    rafId=null;
    const x=pendingCol*cellW+S.gutter/2, y=pendingRow*cellH+S.gutter/2;
    el.style.left=x+'px'; el.style.top=y+'px';
  };
  const mv=e=>{
    const {c,r}=snap(oc*cellW+(e.clientX-sx),or*cellH+(e.clientY-sy));
    pendingCol=Math.max(0,Math.min(c,S.cols-t.colSpan));
    pendingRow=Math.max(0,Math.min(r,S.rows-t.rowSpan));
    if(rafId===null) rafId=requestAnimationFrame(applyPosition);
  };
  const up=()=>{
    document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
    if(rafId!==null) cancelAnimationFrame(rafId);
    t.col=pendingCol; t.row=pendingRow;
    renderTile(t); syncEditor(t); updateStatus(); updateTileList();
  };
  document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
}

// Resizing DOES change size, so renderTile() (and for liquid tiles, the
// filter) legitimately needs to update — but only once per animation
// frame, not once per raw mousemove event. LiquidGlass itself also
// caches the displacement raster by (bucketed) aspect ratio, so most
// in-between frames of a resize drag are cheap cache hits rather than
// full canvas re-rasterization.
function startResize(e,t,h){
  e.preventDefault();
  const sx=e.clientX,sy=e.clientY,oc=t.col,or=t.row,ocs=t.colSpan,ors=t.rowSpan,p=S.pitch;
  let rafId=null;
  const apply=()=>{ rafId=null; renderTile(t); syncEditor(t); };
  const mv=e=>{
    const dx=e.clientX-sx,dy=e.clientY-sy;
    if(h.includes('r')) t.colSpan=Math.max(p,Math.round((ocs*cellW+dx)/cellW/p)*p);
    if(h.includes('b')) t.rowSpan=Math.max(p,Math.round((ors*cellH+dy)/cellH/p)*p);
    if(h.includes('l')){const nc=Math.max(0,Math.min(oc+Math.round(dx/cellW/p)*p,oc+ocs-p));t.col=nc;t.colSpan=Math.max(p,ocs-(nc-oc));}
    if(h.includes('t')){const nr=Math.max(0,Math.min(or+Math.round(dy/cellH/p)*p,or+ors-p));t.row=nr;t.rowSpan=Math.max(p,ors-(nr-or));}
    if(rafId===null) rafId=requestAnimationFrame(apply);
  };
  const up=()=>{
    document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
    if(rafId!==null) cancelAnimationFrame(rafId);
    renderTile(t);updateTileList();
  };
  document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
}

// ════════════════════════════════════════════
// DRAW MODE
// ════════════════════════════════════════════
let drawStart=null;
$('slide-canvas').addEventListener('mousedown',e=>{
  if(S.mode!=='draw') return;
  const tgt=e.target;
  if(tgt!=$('slide-canvas')&&tgt!=$('grid-overlay')&&tgt!=$('bg-dim-ov')) return;
  const rect=$('slide-canvas').getBoundingClientRect();
  const {c,r}=snap(e.clientX-rect.left,e.clientY-rect.top);
  drawStart={c,r};
  const g=$('draw-ghost'); g.style.display='block';
  g.style.left=c*cellW+'px'; g.style.top=r*cellH+'px';
  g.style.width=cellW+'px'; g.style.height=cellH+'px';
});
document.addEventListener('mousemove',e=>{
  if(!drawStart) return;
  const rect=$('slide-canvas').getBoundingClientRect();
  const px=e.clientX-rect.left,py=e.clientY-rect.top;
  const {c:c2,r:r2}=snap(px,py);
  const col=Math.min(drawStart.c,c2),row=Math.min(drawStart.r,r2),p=S.pitch;
  const cs=Math.max(p,Math.abs(c2-drawStart.c)||p),rs=Math.max(p,Math.abs(r2-drawStart.r)||p);
  const g=$('draw-ghost');
  g.style.left=col*cellW+'px'; g.style.top=row*cellH+'px';
  g.style.width=cs*cellW+'px'; g.style.height=rs*cellH+'px';
  $('s-mouse').textContent=`${Math.round(px)},${Math.round(py)}|C${Math.floor(px/cellW)} R${Math.floor(py/cellH)}`;
});
document.addEventListener('mouseup',e=>{
  if(!drawStart) return;
  const rect=$('slide-canvas').getBoundingClientRect();
  const {c:c2,r:r2}=snap(e.clientX-rect.left,e.clientY-rect.top);
  const col=Math.min(drawStart.c,c2),row=Math.min(drawStart.r,r2),p=S.pitch;
  const colSpan=Math.max(p,Math.abs(c2-drawStart.c)||p),rowSpan=Math.max(p,Math.abs(r2-drawStart.r)||p);
  $('draw-ghost').style.display='none'; drawStart=null;
  if(colSpan<p*0.4&&rowSpan<p*0.4) return;
  const nt=newTileDefaults({col,row,colSpan,rowSpan,bg:PALETTE[Math.floor(Math.random()*14)]});
  S.tiles.push(nt); renderTile(nt); selectTile(nt.id); updateTileList(); updateStatus();
});
$('slide-canvas').addEventListener('click',e=>{
  if((e.target===$('slide-canvas')||e.target===$('grid-overlay')||e.target===$('bg-dim-ov'))&&S.mode==='select') selectTile(null);
});
$('slide-canvas').addEventListener('mousemove',e=>{
  if(drawStart) return;
  const rect=$('slide-canvas').getBoundingClientRect();
  const px=e.clientX-rect.left,py=e.clientY-rect.top;
  $('s-mouse').textContent=`${Math.round(px)},${Math.round(py)}|C${Math.floor(px/cellW)} R${Math.floor(py/cellH)}`;
});

// ════════════════════════════════════════════
// SELECTION
// ════════════════════════════════════════════
function selectTile(id){
  S.selectedId=id;
  document.querySelectorAll('.tile').forEach(el=>el.classList.remove('selected'));
  if(id!==null){
    document.getElementById('tile-'+id)?.classList.add('selected');
    const t=S.tiles.find(t=>t.id===id);
    if(t) syncEditor(t);
    $('no-selection').style.display='none';
    $('tile-editor').style.display='block';
  } else {
    $('no-selection').style.display='flex';
    $('tile-editor').style.display='none';
  }
  updateTileList(); updateStatus();
}

// ════════════════════════════════════════════
// EDITOR SYNC
// ════════════════════════════════════════════
function syncEditor(t){
  $('t-hl').value=t.headline||''; $('t-lb').value=t.label||''; $('t-ic').value=t.icon||'';
  $('t-layout').value=t.layout||'bottom-left'; $('t-font').value=t.fontKey||'sf';
  $('t-col-n').value=t.bg||'#333333'; $('t-col-h').value=t.bg||'#333333';
  setRng('fillet-rng','fillet-v',t.fillet??16);
  setRng('hl-size','hl-size-v',t.headlineSize||32);
  setRng('lb-size','lb-size-v',t.labelSize||13);
  setRng('op-rng','op-v',Math.round((t.opacity??1)*100));
  $('t-tl').checked=t.textLight!==false;
  $('t-col').value=t.col; $('t-row').value=t.row;
  $('t-csp').value=t.colSpan; $('t-rsp').value=t.rowSpan;
  const mode=t.styleMode||'opaque';
  setStyleTabUI(mode);
  setRng('g-blur','g-blur-v',t.glassBlur??12);
  setRng('g-bright','g-bright-v',Math.round((t.glassBrightness??1.05)*100));
  $('g-spec').checked=t.glassSpec!==false;
  const ra=t.tintRGBA||{r:10,g:132,b:255,a:0.4};
  ['r','g','b'].forEach(ch=>{$('s'+ch).value=ra[ch];$('v'+ch).textContent=ra[ch];});
  $('sa').value=Math.round(ra.a*100); $('va').textContent=Math.round(ra.a*100)+'%';
  setRng('t-blur','t-blur-v',t.glassBlur??14); $('t-spec').checked=t.glassSpec!==false;
  setRng('lg-sc','lg-sc-v',t.lgScale??60);
  setRng('lg-bl','lg-bl-v',t.glassBlur??8);
  const lgTiPct=Math.round((t.lgTintOp||0)*100);
  $('lg-ti').value=lgTiPct; $('lg-ti-v').textContent=lgTiPct+'%';
  $('lg-tc').value=t.lgTintColor||'#ffffff';
  $('lg-spec').checked=t.glassSpec!==false;
  // Rim controls — sync all three panels
  const rimOff=t.rimOffset??5, rimOpPct=Math.round((t.rimOpacity??0.32)*100);
  ['g','t','lg'].forEach(pfx=>{
    setRng(pfx+'-rim-off',pfx+'-rim-off-v',rimOff);
    setRng(pfx+'-rim-op',pfx+'-rim-op-v',rimOpPct);
    const vEl=$(pfx+'-rim-op-v'); if(vEl) vEl.textContent=rimOpPct+'%';
  });
  document.querySelectorAll('.color-swatch').forEach(sw=>sw.classList.toggle('active',sw.dataset.c===t.bg));
}
function setRng(rId,vId,v){const el=$(rId);if(el)el.value=v;const vel=$(vId);if(vel)vel.textContent=v;}

function upTF(field,value){
  const t=S.tiles.find(t=>t.id===S.selectedId); if(!t) return;
  t[field]=value; renderTile(t);
  if(field==='bg'){$('t-col-n').value=value;$('t-col-h').value=value;document.querySelectorAll('.color-swatch').forEach(sw=>sw.classList.toggle('active',sw.dataset.c===value));}
  updateTileList();
}
function upFillet(v){$('fillet-v').textContent=v;upTF('fillet',+v);}
function upGrid(field,value){
  const t=S.tiles.find(t=>t.id===S.selectedId); if(!t||isNaN(value)) return;
  t[field]=value; renderTile(t);
}
function setTileHex(v){if(/^#[0-9a-fA-F]{6}$/.test(v))upTF('bg',v);}
function updateRGBA(){
  const r=+$('sr').value,g=+$('sg').value,b=+$('sb').value,a=+$('sa').value/100;
  $('vr').textContent=r; $('vg').textContent=g; $('vb').textContent=b; $('va').textContent=Math.round(a*100)+'%';
  upTF('tintRGBA',{r,g,b,a});
}

// ════════════════════════════════════════════
// STYLE TABS
// ════════════════════════════════════════════
function setStyleTab(mode){
  setStyleTabUI(mode);
  upTF('styleMode',mode);
}
function setStyleTabUI(mode){
  document.querySelectorAll('.style-tab').forEach(t=>t.classList.toggle('active',t.dataset.m===mode));
  ['opaque','glass','tinted','liquid'].forEach(m=>$('p-'+m).style.display=m===mode?'block':'none');
}

// ════════════════════════════════════════════
// TILE LIST
// ════════════════════════════════════════════
function updateTileList(){
  $('tile-list').innerHTML='';
  $('tile-count').textContent=`(${S.tiles.length})`;
  S.tiles.forEach(t=>{
    const mode=t.styleMode||'opaque';
    let swBg;
    if(mode==='opaque') swBg=t.bg||'#333';
    else if(mode==='tinted'){const ra=t.tintRGBA||{r:10,g:132,b:255,a:0.4};swBg=`rgba(${ra.r},${ra.g},${ra.b},${ra.a})`;}
    else swBg='rgba(255,255,255,0.15)';
    const item=document.createElement('div');
    item.className='tile-item'+(t.id===S.selectedId?' active':'');
    item.innerHTML=`<div class="swatch" style="background:${swBg};border:1px solid rgba(255,255,255,0.15)"></div><div class="tile-name">${t.headline||t.label||'Tile '+t.id}</div><div class="tile-dim">${t.colSpan}×${t.rowSpan}</div><div class="del-btn" data-id="${t.id}">×</div>`;
    item.addEventListener('click',e=>{
      if(e.target.classList.contains('del-btn')) deleteTile(+e.target.dataset.id);
      else selectTile(t.id);
    });
    $('tile-list').appendChild(item);
  });
}

// ════════════════════════════════════════════
// STATUS
// ════════════════════════════════════════════
function updateStatus(){
  $('s-mode').textContent=S.mode.toUpperCase();
  $('s-grid').textContent=`${S.cols}×${S.rows}`;
  $('s-tiles').textContent=S.tiles.length;
  const sel=S.tiles.find(t=>t.id===S.selectedId);
  $('s-sel').textContent=sel?`T${sel.id}(${sel.col},${sel.row}) ${sel.colSpan}×${sel.rowSpan}`:'none';
}

// ════════════════════════════════════════════
// CONTROLS
// ════════════════════════════════════════════
function setMode(m){
  S.mode=m;
  $('mode-draw').classList.toggle('active',m==='draw');
  $('mode-sel').classList.toggle('active',m==='select');
  $('slide-canvas').style.cursor=m==='draw'?'crosshair':'default';
  updateStatus();
}
// ════════════════════════════════════════════
// GRID TOGGLE
// ════════════════════════════════════════════
let gridVisible=true;
function toggleGrid(){
  gridVisible=!gridVisible;
  $('grid-overlay').style.display=gridVisible?'block':'none';
  $('grid-toggle-btn').textContent=gridVisible?'Grid ✓':'Grid ✗';
  $('grid-toggle-btn').style.color=gridVisible?'':'var(--text3)';
}


$('pitch-select').addEventListener('change',e=>{S.pitch=parseFloat(e.target.value);drawGrid();});
$('cols-select').addEventListener('change',e=>{S.cols=+e.target.value;computeCell();drawGrid();renderAllTiles();updateStatus();});
$('rows-select').addEventListener('change',e=>{S.rows=+e.target.value;computeCell();drawGrid();renderAllTiles();updateStatus();});

function updateSlideBg(v){
  S.bg=v; $('bg-hex').value=v;
  const sc=$('slide-canvas');
  if(S.bgImage) sc.style.backgroundColor=v;
  else sc.style.background=v;
}
function setBgFromHex(v){if(/^#[0-9a-fA-F]{6}$/.test(v)){$('bg-color').value=v;updateSlideBg(v);}}
function updateGutter(v){S.gutter=v;$('gutter-val').textContent=v;renderAllTiles();}

function loadBgImage(input){
  const file=input.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=e=>{
    S.bgImage=e.target.result;
    const sc=$('slide-canvas');
    sc.style.backgroundImage=`url(${S.bgImage})`;
    sc.style.backgroundSize=S.bgFit;
    sc.style.backgroundPosition='center';
    sc.style.backgroundRepeat='no-repeat';
    sc.style.backgroundColor=S.bg;
    $('bg-img-name').textContent=file.name;
  };
  r.readAsDataURL(file);
}
function updateBgFit(v){S.bgFit=v;if(S.bgImage)$('slide-canvas').style.backgroundSize=v;}
function updateBgDim(v){S.bgDim=v/100;$('bg-dim-val').textContent=v+'%';$('bg-dim-ov').style.opacity=v/100;}
function clearBgImage(){
  S.bgImage=null;
  const sc=$('slide-canvas');
  sc.style.backgroundImage=''; sc.style.background=S.bg;
  $('bg-img-name').textContent=''; $('bg-file').value='';
}

// ════════════════════════════════════════════
// COLOR SWATCHES
// ════════════════════════════════════════════
function buildSwatches(){
  const c=$('preset-swatches');
  PALETTE.forEach(color=>{
    const sw=document.createElement('div');
    sw.className='color-swatch'; sw.style.background=color; sw.dataset.c=color;
    sw.addEventListener('click',()=>upTF('bg',color));
    c.appendChild(sw);
  });
}

// ════════════════════════════════════════════
// TILE ACTIONS
// ════════════════════════════════════════════
function deleteTile(id){
  S.tiles=S.tiles.filter(t=>t.id!==id);
  document.getElementById('tile-'+id)?.remove();
  LiquidGlass.remove(id);
  if(S.selectedId===id) selectTile(null);
  updateTileList(); updateStatus();
}
function deleteSelected(){if(S.selectedId!==null)deleteTile(S.selectedId);}
function duplicateSelected(){
  const t=S.tiles.find(t=>t.id===S.selectedId); if(!t) return;
  const nt=newTileDefaults({...t,tintRGBA:{...t.tintRGBA},id:undefined,col:Math.min(t.col+1,S.cols-t.colSpan),row:Math.min(t.row+1,S.rows-t.rowSpan)});
  S.tiles.push(nt); renderTile(nt); selectTile(nt.id); updateTileList(); updateStatus();
}
function addTileCenter(){
  const p=S.pitch;
  const nt=newTileDefaults({col:Math.floor(S.cols/4),row:Math.floor(S.rows/4),colSpan:Math.max(p*2,2),rowSpan:Math.max(p*2,2),headline:'Title',label:'Subtitle',bg:PALETTE[Math.floor(Math.random()*14)]});
  S.tiles.push(nt); renderTile(nt); selectTile(nt.id); updateTileList(); updateStatus();
}
function clearSlide(){
  S.tiles=[]; document.querySelectorAll('.tile').forEach(e=>e.remove());
  LiquidGlass.clearAll(); selectTile(null); updateTileList(); updateStatus();
}

document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  if(e.key==='Delete'||e.key==='Backspace') deleteSelected();
  if(e.key==='d') setMode('draw');
  if(e.key==='s') setMode('select');
  if(e.key==='g') toggleGrid();
  if(e.key==='Escape') selectTile(null);
  if(e.key==='D'&&e.shiftKey) duplicateSelected();
});

// ════════════════════════════════════════════
// SAMPLE
// ════════════════════════════════════════════
function loadSample(){
  clearSlide(); S.bg='#0d0d0d';
  $('slide-canvas').style.background=S.bg;
  $('bg-color').value=S.bg; $('bg-hex').value=S.bg;
  const mk=o=>S.tiles.push(newTileDefaults(o));
  mk({col:0,row:0,colSpan:3,rowSpan:4,bg:'#0a84ff',headline:'48MP',label:'Main camera',headlineSize:52,labelSize:14});
  mk({col:3,row:0,colSpan:3,rowSpan:2,bg:'#30d158',headline:'ProRes',label:'Video recording',icon:'🎬',headlineSize:28,labelSize:12});
  mk({col:6,row:0,colSpan:3,rowSpan:2,bg:'#ff9f0a',headline:'A18 Pro',label:'Chip',headlineSize:28,labelSize:12});
  mk({col:9,row:0,colSpan:3,rowSpan:4,bg:'#bf5af2',headline:'29 hrs',label:'Battery life',icon:'⚡',headlineSize:30,labelSize:13});
  mk({col:3,row:2,colSpan:2,rowSpan:2,bg:'#ff453a',headline:'IP68',label:'Water resist.',icon:'💧',headlineSize:24,labelSize:11});
  mk({col:5,row:2,colSpan:4,rowSpan:2,styleMode:'tinted',tintRGBA:{r:255,g:255,b:255,a:0.07},glassBlur:20,fillet:18,headline:'Titanium',label:'Design material',headlineSize:28,labelSize:12,layout:'center'});
  mk({col:0,row:4,colSpan:4,rowSpan:3,bg:'#1a3a2a',headline:'Carbon Neutral',label:'Environmental commitment',icon:'🌱',headlineSize:26,labelSize:12});
  mk({col:4,row:4,colSpan:2,rowSpan:3,styleMode:'liquid',lgScale:80,glassBlur:8,glassSpec:true,headline:'Face ID',label:'Biometric',headlineSize:22,labelSize:11,fillet:18,lgTintOp:0.05,lgTintColor:'#ffffff'});
  mk({col:6,row:4,colSpan:3,rowSpan:3,bg:'#2c2c2e',headline:'USB-C',label:'Universal connect.',icon:'🔌',headlineSize:26,labelSize:12});
  mk({col:9,row:4,colSpan:3,rowSpan:3,bg:'#ffd60a',headline:'Dynamic Island',label:'Notification hub',headlineSize:22,labelSize:12,textLight:false});
  S.tiles.forEach(t=>renderTile(t));
  updateTileList(); updateStatus();
  notify('Sample loaded — Tile 8 uses Liquid Glass!');
}

// ════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════
function openExport(){$('export-modal').classList.add('open');}
function closeExport(){$('export-modal').classList.remove('open');}
function setProgress(p){
  $('progress-bar').style.width=p+'%';
  if(p>=100)setTimeout(()=>$('progress-bar').style.width='0%',700);
}
function notify(msg,isErr=false){
  const n=$('notif'); n.textContent=msg;
  n.className=isErr?'err':'';
  n.classList.add('show');
  setTimeout(()=>n.classList.remove('show'),3200);
}
function dl(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href);
}
function escXML(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function exportJSON(){
  closeExport();
  const data={version:'1.2',slide:{ratio:S.ratio,cols:S.cols,rows:S.rows,gutter:S.gutter,background:S.bg,customSize:S.customSize},tiles:S.tiles.map(t=>({...t}))};
  dl(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'slide-layout.json');
  notify('Exported slide-layout.json');
}

function exportHTML(){
  closeExport();
  const bgStyle=S.bgImage
    ? `background:${S.bg} url('${S.bgImage}') center/${S.bgFit} no-repeat`
    : `background:${S.bg}`;
  const dimOverlay=S.bgDim>0
    ? `<div style="position:absolute;inset:0;background:#000;opacity:${S.bgDim}"></div>`:'';

  let svgDefs='';
  const tileHTML=S.tiles.map(t=>{
    const r=tRect(t);
    const fil=t.fillet??16;
    const light=t.textLight!==false;
    const hl=light?'rgba(255,255,255,0.95)':'rgba(0,0,0,0.92)';
    const lb=light?'rgba(255,255,255,0.62)':'rgba(0,0,0,0.6)';
    const layout=t.layout||'bottom-left';
    const ai=layout==='center'?'center':'flex-start';
    const jc=layout==='center'?'center':(layout==='top-left'?'flex-start':'flex-end');
    const ta=layout==='center'?'center':'left';
    const fs=t.headlineSize||Math.min(Math.max(r.w/4,14),58);
    const ls=t.labelSize||Math.min(Math.max(r.w/10,9),20);
    const mode=t.styleMode||'opaque';

    // ---- SURFACE: background + blur + (liquid) SVG filter, no text ----
    let surfaceStyle=`position:absolute;inset:0;border-radius:${fil}px;`;
    if(mode==='opaque'){
      surfaceStyle+=`background:${t.bg||'#333'};`;
    } else if(mode==='glass'){
      surfaceStyle+=`background:rgba(255,255,255,0.06);backdrop-filter:blur(${t.glassBlur||12}px) brightness(${t.glassBrightness||1.05});-webkit-backdrop-filter:blur(${t.glassBlur||12}px) brightness(${t.glassBrightness||1.05});`;
    } else if(mode==='tinted'){
      const ra=t.tintRGBA||{r:10,g:132,b:255,a:0.4};
      surfaceStyle+=`background:rgba(${ra.r},${ra.g},${ra.b},${ra.a});backdrop-filter:blur(${t.glassBlur||14}px);-webkit-backdrop-filter:blur(${t.glassBlur||14}px);`;
    } else {
      // liquid — embed the real displacement filter so the exported
      // standalone file keeps the lens refraction, not just a blur
      const fid=`exp-lgf-${t.id}`;
      const aspect=LiquidGlass.quantizedAspect(r.w,r.h);
      const mapUrl=LiquidGlass.buildDisplacementMap(aspect,0.28);
      const scaleX=(t.lgScale||60)/Math.max(1,r.w), scaleY=(t.lgScale||60)/Math.max(1,r.h);
      const blur=t.glassBlur||8;
      const blurFracX=blur/Math.max(1,r.w), blurFracY=blur/Math.max(1,r.h);
      svgDefs+=`<filter id="${fid}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB" filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox">
        <feGaussianBlur stdDeviation="${blurFracX} ${blurFracY}" result="blurred"/>
        <feImage href="${mapUrl}" x="0" y="0" width="1" height="1" result="dmap" preserveAspectRatio="none"/>
        <feDisplacementMap in="blurred" in2="dmap" scale="${Math.min(scaleX,scaleY)}" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
        <feComposite in="displaced" in2="SourceGraphic" operator="in"/>
      </filter>`;
      surfaceStyle+=`background:rgba(255,255,255,0.03);backdrop-filter:blur(${blur}px) brightness(1.08);-webkit-backdrop-filter:blur(${blur}px) brightness(1.08);filter:url(#${fid});`;
    }

    // ---- CONTENT: headline/label/icon, never filtered ----
    let contentInner='';
    if(t.icon)contentInner+=`<div style="font-size:${Math.min(r.h*0.25,28)}px;margin-bottom:3px">${t.icon}</div>`;
    if(t.headline)contentInner+=`<div style="font-size:${fs}px;font-weight:600;color:${hl};line-height:1.05">${t.headline}</div>`;
    if(t.label)contentInner+=`<div style="font-size:${ls}px;color:${lb};margin-top:3px">${t.label}</div>`;
    const contentStyle=`position:absolute;inset:0;display:flex;flex-direction:column;align-items:${ai};justify-content:${jc};text-align:${ta};padding:10px 12px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;`;

    // ---- OVERLAYS: specular/rim/shine/tint, never filtered ----
    let overlays='';
    if(mode!=='opaque'&&t.glassSpec!==false){
      const rimOff=t.rimOffset??5, rimOp=t.rimOpacity??0.32;
      const rimR=Math.max(0,fil-rimOff);
      const tintLayer=mode==='liquid'&&t.lgTintOp>0
        ?`<div style="position:absolute;inset:0;border-radius:${fil}px;background:${t.lgTintColor||'#ffffff'};opacity:${t.lgTintOp}"></div>`:'';
      overlays=`<div style="position:absolute;inset:0;border-radius:${fil}px;pointer-events:none">
        <div style="position:absolute;top:0;left:0;right:0;height:38%;border-radius:${fil}px;background:linear-gradient(180deg,rgba(255,255,255,.2) 0%,rgba(255,255,255,0) 100%)"></div>
        <div style="position:absolute;top:${rimOff}px;left:${rimOff}px;right:${rimOff}px;bottom:${rimOff}px;border-radius:${rimR}px;border:1px solid rgba(255,255,255,${rimOp});background:linear-gradient(180deg,rgba(255,255,255,.1) 0%,rgba(255,255,255,.02) 60%,rgba(255,255,255,.05) 100%)"></div>
        <div style="position:absolute;bottom:0;left:8%;right:8%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)"></div>
        ${tintLayer}
      </div>`;
    }

    return `<div style="position:absolute;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;border-radius:${fil}px;opacity:${t.opacity??1};overflow:hidden">`+
           `<div style="${surfaceStyle}"></div>`+
           `<div style="${contentStyle}">${contentInner}</div>`+
           overlays+
           `</div>`;
  }).join('\n');

  const svgBlock=svgDefs?`<svg width="0" height="0" style="position:absolute"><defs>${svgDefs}</defs></svg>`:'';
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh}</style></head><body>${svgBlock}<div style="position:relative;width:${canvasW}px;height:${canvasH}px;${bgStyle};overflow:hidden">${dimOverlay}${tileHTML}</div></body></html>`;
  dl(new Blob([html],{type:'text/html'}),'slide.html');
  notify('Exported slide.html');
}

function exportSVG(){
  closeExport();
  let defs='', body='';
  // Embed background image
  if(S.bgImage){
    defs+=`<image href="${S.bgImage}" x="0" y="0" width="${canvasW}" height="${canvasH}" preserveAspectRatio="${S.bgFit==='contain'?'xMidYMid meet':'xMidYMid slice'}"/>`;
    if(S.bgDim>0) defs+=`<rect width="${canvasW}" height="${canvasH}" fill="#000" opacity="${S.bgDim}"/>`;
  }
  // Specular gradient def
  body+=`<defs><linearGradient id="spec-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="white" stop-opacity="0.2"/><stop offset="100%" stop-color="white" stop-opacity="0"/></linearGradient></defs>`;
  S.tiles.forEach(t=>{
    const r=tRect(t); const fil=t.fillet??16;
    const light=t.textLight!==false;
    const hl=light?'rgba(255,255,255,0.95)':'rgba(0,0,0,0.92)';
    const lb=light?'rgba(255,255,255,0.62)':'rgba(0,0,0,0.6)';
    const fs=t.headlineSize||Math.min(Math.max(r.w/4,14),58);
    const ls=t.labelSize||Math.min(Math.max(r.w/10,9),20);
    const mode=t.styleMode||'opaque';
    let fill=t.bg||'#333';
    if(mode==='glass') fill='rgba(255,255,255,0.06)';
    else if(mode==='tinted'){const ra=t.tintRGBA||{r:10,g:132,b:255,a:0.4};fill=`rgba(${ra.r},${ra.g},${ra.b},${ra.a})`;}
    else if(mode==='liquid') fill='rgba(255,255,255,0.06)';
    const ty=r.y+r.h-10-(t.label?ls+4:0);
    let txt='';
    if(t.headline)txt+=`<text x="${r.x+12}" y="${ty}" font-family="system-ui" font-weight="600" font-size="${fs}" fill="${hl}">${escXML(t.headline)}</text>`;
    if(t.label)txt+=`<text x="${r.x+12}" y="${r.y+r.h-10}" font-family="system-ui" font-size="${ls}" fill="${lb}">${escXML(t.label)}</text>`;
    body+=`<clipPath id="cp${t.id}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${fil}"/></clipPath>\n`;
    body+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${fil}" fill="${fill}" opacity="${t.opacity??1}"/>\n`;
    // Rim for glass modes
    if(mode!=='opaque'&&t.glassSpec!==false){
      const rimOff=t.rimOffset??5, rimOp=t.rimOpacity??0.32;
      const rimR=Math.max(0,fil-rimOff);
      body+=`<rect x="${r.x+rimOff}" y="${r.y+rimOff}" width="${r.w-rimOff*2}" height="${r.h-rimOff*2}" rx="${rimR}" fill="url(#spec-grad)" stroke="rgba(255,255,255,${rimOp})" stroke-width="1" clip-path="url(#cp${t.id})"/>\n`;
    }
    body+=`<g clip-path="url(#cp${t.id})">${txt}</g>\n`;
  });
  const bgRect=S.bgImage?'':`<rect width="${canvasW}" height="${canvasH}" fill="${S.bg}"/>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}">${bgRect}${defs}${body}</svg>`;
  dl(new Blob([svg],{type:'image/svg+xml'}),'slide.svg');
  notify('Exported slide.svg');
}

async function exportPDF(){
  closeExport();
  if(typeof html2canvas==='undefined'||typeof jspdf==='undefined'){notify('PDF libs loading… try again',true);return;}
  setProgress(20); notify('Generating PDF…');
  try{
    const savedSel=S.selectedId;
    // Hide all editor chrome
    $('grid-overlay').style.display='none';
    document.querySelectorAll('.resize-handle').forEach(h=>h.style.display='none');
    document.querySelectorAll('.tile').forEach(t=>t.classList.remove('selected'));
    // Force a layout tick so box-shadow is gone before capture
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const ic=await html2canvas($('slide-canvas'),{scale:2,useCORS:true,allowTaint:true,backgroundColor:null,logging:false});
    setProgress(75);
    // Restore
    if(gridVisible) $('grid-overlay').style.display='block';
    document.querySelectorAll('.resize-handle').forEach(h=>h.style.display='');
    if(savedSel) document.getElementById('tile-'+savedSel)?.classList.add('selected');
    const {jsPDF}=window.jspdf;
    const {w:rw,h:rh}=sizeToInches(getCurrentSize());
    const pdf=new jsPDF({orientation:rw>rh?'landscape':'portrait',unit:'px',format:[canvasW,canvasH]});
    pdf.addImage(ic.toDataURL('image/png'),'PNG',0,0,canvasW,canvasH);
    setProgress(95); pdf.save('slide.pdf'); setProgress(100); notify('Exported slide.pdf');
  }catch(e){console.error(e);setProgress(100);notify('PDF failed: '+e.message,true);}
}

async function exportImage(fmt){
  closeExport();
  if(typeof html2canvas==='undefined'){notify('html2canvas not loaded yet, try again',true);return;}
  const mimeMap={png:'image/png',jpg:'image/jpeg',webp:'image/webp'};
  const mime=mimeMap[fmt]||'image/png';
  setProgress(20); notify(`Generating ${fmt.toUpperCase()}…`);
  try{
    const savedSel=S.selectedId;
    $('grid-overlay').style.display='none';
    document.querySelectorAll('.resize-handle').forEach(h=>h.style.display='none');
    document.querySelectorAll('.tile').forEach(t=>t.classList.remove('selected'));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const ic=await html2canvas($('slide-canvas'),{scale:2,useCORS:true,allowTaint:true,backgroundColor:null,logging:false});
    setProgress(80);
    if(gridVisible) $('grid-overlay').style.display='block';
    document.querySelectorAll('.resize-handle').forEach(h=>h.style.display='');
    if(savedSel) document.getElementById('tile-'+savedSel)?.classList.add('selected');
    const quality=fmt==='jpg'?0.93:fmt==='webp'?0.92:1.0;
    const dataUrl=ic.toDataURL(mime,quality);
    const a=document.createElement('a');
    a.href=dataUrl; a.download=`slide.${fmt}`; a.click();
    setProgress(100); notify(`Exported slide.${fmt}`);
  }catch(e){console.error(e);setProgress(100);notify(`${fmt} failed: `+e.message,true);}
}


async function exportPPTX(){
  closeExport();

  // ── PATH A: dom-to-pptx ──────────────────────────────────────────
  // Produces fully-editable PowerPoint shapes by reading computed CSS.
  // Text, rounded corners, gradients, and colours are native PPTX
  // objects — not flattened into an image. Falls back to Path B if the
  // library hasn't loaded.
  if(window.domToPptx && typeof window.domToPptx.exportToPptx==='function'){
    setProgress(10); notify('Building PPTX (dom-to-pptx)…');
    try{
      const {w:inW,h:inH}=sizeToInches(getCurrentSize());
      setProgress(30);
      await domToPptx.exportToPptx('#slide-canvas',{
        width: inW,
        height: inH,
        fileName:'slide.pptx',
        skipDownload: false
      });
      setProgress(100); notify('Exported slide.pptx ✓ (editable shapes)');
      return;
    }catch(e){
      console.warn('dom-to-pptx failed, falling back to pptxgenjs:',e.message);
      setProgress(0);
      notify('dom-to-pptx failed, trying fallback…');
    }
  }

  // ── PATH B: pptxgenjs shape-by-shape fallback ─────────────────────
  // Reconstructs each tile as a native roundRect + text. Less fidelity
  // than Path A for complex CSS, but works even without dom-to-pptx.
  let Pptx = window.PptxGenJS || window.pptxgen || window.PptxGenJs || window.PPTX;
  if(!Pptx){
    notify('Loading PptxGenJS…');
    await new Promise((res)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
      s.onload=()=>{Pptx=window.PptxGenJS||window.pptxgen||window.PptxGenJs;res();};
      s.onerror=()=>res();
      document.head.appendChild(s);
    });
  }
  if(!Pptx){
    notify('PPTX export unavailable — use HTML or PDF export instead.',true);
    return;
  }

  setProgress(10); notify('Building PPTX (fallback)…');
  try{
    const pptx=new Pptx();
    const {w:inW,h:inH}=sizeToInches(getCurrentSize());
    pptx.defineLayout({name:'CUSTOM',width:inW,height:inH});
    pptx.layout='CUSTOM';
    const slide=pptx.addSlide();
    slide.background={color:S.bg.replace('#','')};
    setProgress(30);

    S.tiles.forEach(t=>{
      const r=tRect(t);
      const x=r.x/canvasW*inW, y=r.y/canvasH*inH;
      const w=r.w/canvasW*inW, h=r.h/canvasH*inH;
      const fil=Math.min((t.fillet??16)/Math.min(r.w,r.h)*0.5,0.49);
      const mode=t.styleMode||'opaque';
      let fillColor='333333', fillTransp=0;
      if(mode==='opaque'){fillColor=(t.bg||'#333333').replace('#','');}
      else if(mode==='glass'){fillColor='FFFFFF';fillTransp=94;}
      else if(mode==='tinted'){
        const ra=t.tintRGBA||{r:10,g:132,b:255,a:0.4};
        fillColor=((1<<24)+(ra.r<<16)+(ra.g<<8)+ra.b).toString(16).slice(1).toUpperCase();
        fillTransp=Math.round((1-ra.a)*100);
      }else{fillColor='FFFFFF';fillTransp=96;}

      slide.addShape(pptx.ShapeType.roundRect,{
        x,y,w,h,
        fill:{color:fillColor,transparency:fillTransp},
        line:{color:fillColor,transparency:fillTransp,width:0.01},
        rectRadius:fil
      });

      if(mode!=='opaque'&&t.glassSpec!==false){
        const rimOff=t.rimOffset??5;
        const rimOp=t.rimOpacity??0.32;
        const rimInX=rimOff/canvasW*inW, rimInY=rimOff/canvasH*inH;
        const rimFil=Math.min(Math.max(0,(t.fillet??16)-rimOff)/Math.min(r.w-rimOff*2,r.h-rimOff*2)*0.5,0.49);
        slide.addShape(pptx.ShapeType.roundRect,{
          x:x+rimInX,y:y+rimInY,w:w-rimInX*2,h:(h-rimInY*2)*0.4,
          fill:{color:'FFFFFF',transparency:80},
          line:{color:'FFFFFF',transparency:80,width:0.01},rectRadius:rimFil
        });
        slide.addShape(pptx.ShapeType.roundRect,{
          x:x+rimInX,y:y+rimInY,w:w-rimInX*2,h:h-rimInY*2,
          fill:{type:'none'},
          line:{color:'FFFFFF',transparency:Math.round((1-rimOp)*100),width:0.75},
          rectRadius:rimFil
        });
      }

      const lines=[];
      const light=t.textLight!==false;
      const tcol=light?'FFFFFF':'000000';
      const lcol=light?'FFFFFF':'000000';
      const fs=t.headlineSize||32, ls=t.labelSize||13;
      const scale=inW/canvasW*72;
      if(t.headline)lines.push({text:t.headline,options:{fontSize:Math.max(6,fs*scale/1.5),bold:true,color:tcol,breakLine:!!t.label,transparency:5}});
      if(t.label)lines.push({text:t.label,options:{fontSize:Math.max(5,ls*scale/1.5),color:lcol,transparency:38,breakLine:false}});
      if(lines.length>0){
        const layout=t.layout||'bottom-left';
        const va=layout==='top-left'?'top':layout==='center'?'middle':'bottom';
        const al=layout==='center'?'center':'left';
        slide.addText(lines,{x:x+0.08,y,w:w-0.12,h,valign:va,align:al,wrap:true,autoFit:true});
      }
    });

    setProgress(80);
    await pptx.writeFile({fileName:'slide.pptx'});
    setProgress(100); notify('Exported slide.pptx ✓ (fallback mode)');
  }catch(e){
    console.error(e); setProgress(100);
    notify('PPTX error: '+e.message,true);
  }
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
window.addEventListener('resize',computeCanvasSize);
buildSwatches();
$('slide-canvas').style.background=S.bg;
computeCanvasSize();
updateStatus();
// Verify PptxGenJS + dom-to-pptx loaded
setTimeout(()=>{
  const ok=!!(window.PptxGenJS||window.pptxgen||window.PptxGenJs);
  const d2p=!!(window.domToPptx?.exportToPptx);
  console.log('PPTX available:',ok,'dom-to-pptx:',d2p,[...Object.keys(window).filter(k=>k.toLowerCase().includes('pptx')),'domToPptx:'+typeof window.domToPptx]);
},2000);
