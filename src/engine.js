// Geometry adapted from the supplied stamp-maker-2.html. Units: millimetres.
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const isSquareish = sh => sh==='square'||sh==='rounded'||sh==='circle';
// Plate size: the 14 mm keycap insert, or the 20 mm plate of the big stamp head (models/keycap-head).
function plateSize(){ return S.kind==='stamp20'?20:14; }
function dims(){ const s=plateSize(); return {w:s,h:s}; }
function chars(){ return Array.from((S.text||'').replace(/\s+/g,'')).slice(0,8); }
function fmt(v, d=1){ return String(Number(v.toFixed(d))); }

/* ---------- 글꼴 불러오기 ---------- */
const fontCache = {};
function ensureFont(f, text){
  const key = f.id+'|'+text;
  if(!fontCache[key]){
    const spec = `${f.weight} 64px "${f.family}"`;
    fontCache[key] = (document.fonts && document.fonts.load ? document.fonts.load(spec, text||'가') : Promise.resolve([]))
      .then(list=>list && list.length>0).catch(()=>false);
  }
  return fontCache[key];
}

/* ---------- 배치 계산 ---------- */
function layoutShape(n, layout){ // [cols, rows] (셀이 정사각일 때의 상자 비율용)
  if(n<=1) return [1,1];
  if(layout==='row') return [n,1];
  if(layout==='col') return [1,n];
  if(layout==='trad') return [Math.ceil(n/2), 2];
  if(n===2) return [2,1];
  return [Math.ceil(n/2), 2];
}
function layoutCells(n, layout, box, g){
  const {x,y,w,h} = box; const cells=[];
  if(n<=0) return cells;
  if(n===1) return [{x,y,w,h}];
  if(layout==='row'){ const cw=(w-g*(n-1))/n; for(let i=0;i<n;i++) cells.push({x:x+i*(cw+g),y,w:cw,h}); return cells; }
  if(layout==='col'){ const ch=(h-g*(n-1))/n; for(let i=0;i<n;i++) cells.push({x,y:y+i*(ch+g),w,h:ch}); return cells; }
  if(layout==='trad'){ // 오른쪽 열부터, 위에서 아래로. 홀수면 첫 열(성)은 한 칸을 길게
    const cols=Math.ceil(n/2), colW=(w-g*(cols-1))/cols;
    const per=[]; for(let c=0;c<cols;c++) per.push(2); if(n%2===1) per[0]=1;
    for(let c=0;c<cols;c++){
      const cx = x + w - (c+1)*colW - c*g, m=per[c], rh=(h-g*(m-1))/m;
      for(let r=0;r<m;r++) cells.push({x:cx, y:y+r*(rh+g), w:colW, h:rh});
    }
    return cells;
  }
  // 자동: 왼쪽에서 오른쪽, 홀수면 첫 글자(성)를 왼쪽에 길게
  if(n===2){ const cw=(w-g)/2; return [{x,y,w:cw,h},{x:x+cw+g,y,w:cw,h}]; }
  const cols=Math.ceil(n/2), colW=(w-g*(cols-1))/cols, rh=(h-g)/2;
  if(n%2===1){
    cells.push({x,y,w:colW,h});
    const rest=n-1, rc=rest/2;
    for(let r=0;r<2;r++) for(let c=0;c<rc;c++) cells.push({x:x+(c+1)*(colW+g), y:y+r*(rh+g), w:colW, h:rh});
  } else {
    for(let r=0;r<2;r++) for(let c=0;c<cols;c++) cells.push({x:x+c*(colW+g), y:y+r*(rh+g), w:colW, h:rh});
  }
  return cells;
}
function contentBox(wpx, hpx, shape, insetPx, n, layout){
  const A = wpx/2-insetPx, B = hpx/2-insetPx;
  if(A<=1||B<=1) return null;
  if(shape==='circle'||shape==='oval'){
    const [c,r] = layoutShape(n, layout);
    let ar = c/r; if(S.fill) ar = Math.pow(ar,0.5)*Math.pow(A/B,0.5);
    const th = Math.atan2(A, B*ar), k = 1.06; // 글자 모서리는 대개 비어 있어 살짝 키움
    return {w:Math.min(2*A, 2*A*Math.cos(th)*k), h:Math.min(2*B, 2*B*Math.sin(th)*k)};
  }
  return {w:2*A, h:2*B};
}

/* ---------- 2D 도장 면 그리기 ---------- */
function roundRectPath(ctx,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
}
function cornerR(w,h){ return Math.min(w,h)*0.2; }
function shapePath(ctx, cx, cy, wpx, hpx, shape, inset, ppm){
  const W=wpx-2*inset, H=hpx-2*inset; ctx.beginPath(); if(W<=0||H<=0) return false;
  if(shape==='circle'||shape==='oval') ctx.ellipse(cx,cy,W/2,H/2,0,0,Math.PI*2);
  else if(shape==='rounded') roundRectPath(ctx,cx-W/2,cy-H/2,W,H,cornerR(wpx,hpx)-inset);
  else ctx.rect(cx-W/2,cy-H/2,W,H);
  ctx.closePath(); return true;
}
function mkCanvas(w,h){ const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; }

let lastCellMinMm = 99;
function drawSymbol(ctx,kind,x,y,size){
  ctx.save();ctx.translate(x,y);ctx.scale(size/10,size/10);ctx.beginPath();
  if(kind==='heart'){ctx.moveTo(0,4.5);ctx.bezierCurveTo(-8,-.5,-4.5,-7,0,-2.7);ctx.bezierCurveTo(4.5,-7,8,-.5,0,4.5);ctx.fill();}
  if(kind==='star'){for(let i=0;i<10;i++){const t=-Math.PI/2+i*Math.PI/5,r=i%2?2.3:5;ctx[i?'lineTo':'moveTo'](Math.cos(t)*r,Math.sin(t)*r);}ctx.closePath();ctx.fill();}
  if(kind==='smile'){ctx.lineWidth=.9;ctx.arc(0,0,4.4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(-1.5,-1,.55,0,Math.PI*2);ctx.arc(1.5,-1,.55,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(0,.3,2,0,Math.PI);ctx.stroke();}
  if(kind==='leaf'){ctx.moveTo(-4,4);ctx.bezierCurveTo(-6,-3,1,-4.5,4.5,-4.5);ctx.bezierCurveTo(5,1,2,6,-4,4);ctx.fill();ctx.globalCompositeOperation='destination-out';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-3,3);ctx.lineTo(2.6,-2.6);ctx.stroke();}
  ctx.restore();
}
function letterLayer(cw, ch, ppm, mirror, font, list){
  const L = mkCanvas(cw, ch), lx = L.getContext('2d');
  const {w,h} = dims(); const cx=cw/2, cy=ch/2, k=w/14;
  lx.fillStyle=lx.strokeStyle='#000';
  if(S.content==='icon'){drawSymbol(lx,S.icon,cx,cy,9.5*k*ppm);lastCellMinMm=9.5*k;return L;}
  const n = list.length; if(!n) return L;
  const gapMm = Math.max(0.5, 0.05*Math.min(w,h));
  const box = contentBox(w*ppm, h*ppm, S.shape, (S.border+gapMm)*ppm, n, S.layout);
  if(!box) return L;
  const g = 0.035*Math.min(box.w, box.h);
  const decorated=S.decoration!=='none';
  const cells = layoutCells(n, S.layout, {x:cx-box.w/2, y:cy-box.h/2, w:box.w, h:box.h-(decorated?3.8*k*ppm:0)}, g);
  lastCellMinMm = Math.min(...cells.map(c=>Math.min(c.w,c.h)))/ppm;
  lx.fillStyle = '#000';
  if(mirror){ lx.translate(cw,0); lx.scale(-1,1); }
  const fs = 200;
  lx.font = `${font.weight} ${fs}px "${font.family}", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  lx.textBaseline='alphabetic'; lx.textAlign='left';
  list.forEach((chr,i)=>{
    const cell = cells[i]; if(!cell) return;
    const m = lx.measureText(chr);
    const l = m.actualBoundingBoxLeft||0, r = m.actualBoundingBoxRight||0, a = m.actualBoundingBoxAscent||0, d = m.actualBoundingBoxDescent||0;
    const gw = l+r, gh = a+d; if(gw<=0||gh<=0) return;
    let sx = cell.w/gw, sy = cell.h/gh;
    if(!S.fill){ const s=Math.min(sx,sy); sx=sy=s; }
    lx.save();
    lx.translate(cell.x+cell.w/2, cell.y+cell.h/2);
    lx.scale(sx, sy);
    lx.fillText(chr, -(r-l)/2, -(d-a)/2);
    lx.restore();
  });
  if(decorated)drawSymbol(lx,S.decoration,cx,cy+4.4*k*ppm,2.8*k*ppm);
  const rad = S.bold*ppm;
  if(rad>=0.4){ // 원형으로 번지게 해서 획을 굵게
    const D = mkCanvas(cw,ch), dx = D.getContext('2d');
    const N = 20;
    for(let k=0;k<N;k++){ const t=2*Math.PI*k/N; dx.drawImage(L, rad*Math.cos(t), rad*Math.sin(t)); }
    for(let k=0;k<10;k++){ const t=2*Math.PI*(k+0.5)/10; dx.drawImage(L, 0.6*rad*Math.cos(t), 0.6*rad*Math.sin(t)); }
    dx.drawImage(L,0,0);
    return D;
  }
  return L;
}
/* 도장 면에서 "튀어나온 부분"을 color로 칠함 */
function drawFace(ctx, cw, ch, ppm, mirror, color, font){
  const {w,h} = dims(); const cx=cw/2, cy=ch/2, wpx=w*ppm, hpx=h*ppm;
  ctx.save(); ctx.clearRect(0,0,cw,ch);
  const L = letterLayer(cw, ch, ppm, mirror, font, chars());
  ctx.fillStyle = color;
  if(S.mode!=='engrave'){
    if(S.border>0.001){
      shapePath(ctx,cx,cy,wpx,hpx,S.shape,0,ppm); ctx.fill();
      ctx.globalCompositeOperation='destination-out';
      if(shapePath(ctx,cx,cy,wpx,hpx,S.shape,S.border*ppm,ppm)) ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }
    // 글자를 색으로 칠하기
    const T = mkCanvas(cw,ch), tx=T.getContext('2d');
    tx.drawImage(L,0,0); tx.globalCompositeOperation='source-in'; tx.fillStyle=color; tx.fillRect(0,0,cw,ch);
    ctx.drawImage(T,0,0);
  } else {
    shapePath(ctx,cx,cy,wpx,hpx,S.shape,0,ppm); ctx.fill();
    ctx.globalCompositeOperation='destination-out'; ctx.drawImage(L,0,0);
    ctx.globalCompositeOperation='source-over';
  }
  ctx.globalCompositeOperation='destination-in';
  shapePath(ctx,cx,cy,wpx,hpx,S.shape,0,ppm); ctx.fillStyle='#000'; ctx.fill();
  ctx.restore();
}

/* ---------- 윤곽 추출 (marching squares) ---------- */
function traceContours(alpha, W, H, iso){
  const N = W*H*2;
  const n1 = new Int32Array(N).fill(-1), n2 = new Int32Array(N).fill(-1);
  function link(a,b){ if(n1[a]<0) n1[a]=b; else n2[a]=b; if(n1[b]<0) n1[b]=a; else n2[b]=a; }
  for(let y=0;y<H-1;y++){
    for(let x=0;x<W-1;x++){
      const i=y*W+x, tl=alpha[i], tr=alpha[i+1], bl=alpha[i+W], br=alpha[i+W+1];
      const c=(tl>=iso?8:0)|(tr>=iso?4:0)|(br>=iso?2:0)|(bl>=iso?1:0);
      if(c===0||c===15) continue;
      const T=i*2, R=(i+1)*2+1, B=(i+W)*2, L=i*2+1;
      switch(c){
        case 1: case 14: link(L,B); break;
        case 2: case 13: link(B,R); break;
        case 3: case 12: link(L,R); break;
        case 4: case 11: link(T,R); break;
        case 6: case 9:  link(T,B); break;
        case 7: case 8:  link(T,L); break;
        case 5: { const m=(tl+tr+bl+br)/4; if(m>=iso){ link(T,L); link(B,R); } else { link(T,R); link(L,B); } break; }
        case 10:{ const m=(tl+tr+bl+br)/4; if(m>=iso){ link(T,R); link(L,B); } else { link(T,L); link(B,R); } break; }
      }
    }
  }
  function kp(k){
    const e=k>>1, x=e%W, y=(e-x)/W;
    if((k&1)===0){ const a=alpha[e], b=alpha[e+1]; return [x+(iso-a)/(b-a), y]; }
    const a=alpha[e], b=alpha[e+W]; return [x, y+(iso-a)/(b-a)];
  }
  const vis = new Uint8Array(N), loops=[];
  for(let k=0;k<N;k++){
    if(n1[k]<0||vis[k]) continue;
    const pts=[]; let prev=-1, cur=k, ok=false;
    for(let guard=0; guard<N; guard++){
      vis[cur]=1; pts.push(kp(cur));
      const nx = (n1[cur]!==prev) ? n1[cur] : n2[cur];
      if(nx===k){ ok=true; break; }
      if(nx<0||vis[nx]) break;
      prev=cur; cur=nx;
    }
    if(ok && pts.length>=3) loops.push(pts);
  }
  return loops;
}
function rdp(pts, eps){
  const n=pts.length; if(n<3) return pts.slice();
  const keep=new Uint8Array(n); keep[0]=keep[n-1]=1; const st=[[0,n-1]];
  while(st.length){
    const [a,b]=st.pop(); const ax=pts[a][0], ay=pts[a][1], dx=pts[b][0]-ax, dy=pts[b][1]-ay; const len=Math.hypot(dx,dy);
    let md=0, idx=-1;
    for(let i=a+1;i<b;i++){
      const px=pts[i][0]-ax, py=pts[i][1]-ay;
      const d = len>1e-9 ? Math.abs(px*dy-py*dx)/len : Math.hypot(px,py);
      if(d>md){ md=d; idx=i; }
    }
    if(md>eps && idx>0){ keep[idx]=1; st.push([a,idx],[idx,b]); }
  }
  const out=[]; for(let i=0;i<n;i++) if(keep[i]) out.push(pts[i]); return out;
}
function simplifyClosed(p, eps){
  let m=0, md=-1; const x0=p[0][0], y0=p[0][1];
  for(let i=1;i<p.length;i++){ const d=(p[i][0]-x0)**2+(p[i][1]-y0)**2; if(d>md){ md=d; m=i; } }
  const A=rdp(p.slice(0,m+1),eps), B=rdp(p.slice(m).concat([p[0]]),eps);
  return A.slice(0,-1).concat(B.slice(0,-1));
}
function area(p){ let s=0; for(let i=0,j=p.length-1;i<p.length;j=i++) s+=(p[j][0]*p[i][1]-p[i][0]*p[j][1]); return s/2; }
function pip(pt, poly){
  let inside=false; const x=pt[0], y=pt[1];
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
    if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
/* 윤곽을 바깥/구멍으로 나눠 THREE.Shape 목록으로 */
function loopsToShapes(raw, toMm){
  const items = raw.map(p=>simplifyClosed(p,0.3)).filter(p=>p.length>=3).map(p=>{
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const q of p){ if(q[0]<x0)x0=q[0]; if(q[0]>x1)x1=q[0]; if(q[1]<y0)y0=q[1]; if(q[1]>y1)y1=q[1]; }
    return {p, abs:Math.abs(area(p)), bb:[x0,y0,x1,y1], depth:0, parent:-1};
  }).filter(o=>o.abs>2.5).sort((a,b)=>b.abs-a.abs);
  for(let i=0;i<items.length;i++){
    const it=items[i];
    for(let j=0;j<i;j++){
      const o=items[j];
      if(o.bb[0]<=it.bb[0]&&o.bb[1]<=it.bb[1]&&o.bb[2]>=it.bb[2]&&o.bb[3]>=it.bb[3] && pip(it.p[0], o.p)){ it.depth++; it.parent=j; }
    }
  }
  const shapes=[], map=new Map();
  items.forEach((it,i)=>{ if(it.depth%2===0){ const s=new THREE.Shape(it.p.map(q=>new THREE.Vector2(...toMm(q)))); map.set(i,s); shapes.push(s); } });
  items.forEach(it=>{ if(it.depth%2===1 && map.has(it.parent)) map.get(it.parent).holes.push(new THREE.Path(it.p.map(q=>new THREE.Vector2(...toMm(q))))); });
  return shapes;
}

/* ---------- 3D 모델 만들기 ---------- */
function clampToInsert(x,y){
  // Project raster samples onto the same 14-segment corner polygon as the base (corner radius 0.2 x size).
  const half=plateSize()/2;x=clamp(x,-half,half);y=clamp(y,-half,half);
  const ax=Math.abs(x),ay=Math.abs(y),cx=half*0.6,cy=half*0.6,r=half*0.4;
  if(ax>cx&&ay>cy){const dx=ax-cx,dy=ay-cy,t=Math.atan2(dy,dx),step=Math.PI/28;
    const mid=(Math.min(13,Math.floor(t/step))+.5)*step;
    const maxR=r*Math.cos(step/2)/Math.cos(t-mid),dist=Math.hypot(dx,dy);
    if(dist>maxR){x=Math.sign(x)*(cx+dx*maxR/dist);y=Math.sign(y)*(cy+dy*maxR/dist);}
  }
  return [x,y];
}
function plateShape(w,h){
  const pts=[];
  if(S.shape==='circle'||S.shape==='oval'){
    const N=120; for(let i=0;i<N;i++){ const t=2*Math.PI*i/N; pts.push([w/2*Math.cos(t), h/2*Math.sin(t)]); }
  } else if(S.shape==='rounded'){
    const r=cornerR(w,h), hw=w/2, hh=h/2, seg=14;
    const corners=[[hw-r,-hh+r,-Math.PI/2],[hw-r,hh-r,0],[-hw+r,hh-r,Math.PI/2],[-hw+r,-hh+r,Math.PI]];
    for(const [cx,cy,a0] of corners) for(let i=0;i<=seg;i++){ const t=a0+Math.PI/2*i/seg; pts.push([cx+r*Math.cos(t), cy+r*Math.sin(t)]); }
  } else { pts.push([-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]); }
  const clean=pts.filter((q,i)=>{ const n=pts[(i+1)%pts.length]; return Math.hypot(q[0]-n[0],q[1]-n[1])>1e-6; });
  return new THREE.Shape(clean.map(q=>new THREE.Vector2(q[0],q[1])));
}
const STAMP_RELIEF=1.5;
function buildGeometries(){
  // Stamp: letters mirrored so the print reads right; the 3.0 mm plate fills the keycap base's 2.9 mm pocket and the
  // letters stand 1.5 mm above its rim, so only the letters take ink. The 20 mm plate is always a stamp.
  if(S.kind==='stamp20')S.mode='stamp';
  const stamp=S.mode==='stamp',size=plateSize();Object.assign(S,{w:size,h:size,base:stamp?3:1.5,shape:'rounded',handle:'none',mirror:stamp});const relief=stamp?STAMP_RELIEF:S.relief;
  const {w,h}=dims(); const font=fontById(S.font);
  const ppm = clamp(640/Math.max(w,h), 10, 40), margin = 1.5 + S.bold;
  const cw = Math.ceil((w+2*margin)*ppm)+2, ch = Math.ceil((h+2*margin)*ppm)+2;
  const cv = mkCanvas(cw,ch), ctx = cv.getContext('2d', {willReadFrequently:true});
  drawFace(ctx, cw, ch, ppm, S.mirror, '#000', font);
  const data = ctx.getImageData(0,0,cw,ch).data;
  const alpha = new Float32Array(cw*ch);
  for(let i=0,j=3;i<alpha.length;i++,j+=4) alpha[i]=data[j]/255;
  for(let x=0;x<cw;x++){ alpha[x]=0; alpha[(ch-1)*cw+x]=0; } for(let y=0;y<ch;y++){ alpha[y*cw]=0; alpha[y*cw+cw-1]=0; }
  const loops = traceContours(alpha, cw, ch, 0.5);
  const ox=cw/2, oy=ch/2;
  const shapes = loopsToShapes(loops, q=>clampToInsert((q[0]+.5-ox)/ppm, -(q[1]+.5-oy)/ppm));

  const parts = {plate:[], relief:[]}; const EPS=0.02;
  const m = Math.min(w,h);
  let zPlate = 0, handleTop = 0;
  if(S.handle!=='none'){
    const H = S.handleH, rh = clamp(m*0.3, 3.5, 9), Rf = Math.max(rh, m/2*0.9), fh = Math.max(0, Rf-rh);
    const sx = w/m, sy = h/m;
    const cyl = new THREE.CylinderGeometry(rh, rh, H, S.handle==='hex'?6:64); cyl.rotateX(Math.PI/2); cyl.translate(0,0,H/2); cyl.scale(sx,sy,1);
    parts.plate.push(cyl);
    if(fh>0.05){ const fl = new THREE.CylinderGeometry(Rf, rh, fh+EPS, S.handle==='hex'?6:64); fl.rotateX(Math.PI/2); fl.translate(0,0,H-EPS/2+(fh+EPS)/2 - EPS/2); fl.scale(sx,sy,1); parts.plate.push(fl); }
    const rib = new THREE.BoxGeometry(1.6, 1.2, Math.max(2,H-1)); rib.translate(0, rh*sy+0.25, Math.max(2,H-1)/2); parts.plate.push(rib);
    zPlate = H + fh - EPS; handleTop = H + fh;
  }
  const plate = new THREE.ExtrudeGeometry(plateShape(w,h), {depth:S.base+(zPlate>0?EPS:0), bevelEnabled:false, curveSegments:72});
  plate.translate(0,0,zPlate); parts.plate.push(plate);
  const zTop = zPlate + S.base + (zPlate>0?EPS:0);
  if(shapes.length){
    const rel = new THREE.ExtrudeGeometry(shapes, {depth:relief+EPS, bevelEnabled:false, curveSegments:4});
    rel.translate(0,0,zTop-EPS); parts.relief.push(rel);
  }
  return {parts, totalH: zTop + relief, w, h, handleTop};
}

/* ---------- STL / ZIP ---------- */
function geomTris(g){ const gg = g.index ? g.toNonIndexed() : g; return gg.attributes.position.array; }
function meshStats(list){
  let vol=0, tris=0;
  for(const g of list){ const p=geomTris(g); tris+=p.length/9;
    for(let i=0;i<p.length;i+=9){ const ax=p[i],ay=p[i+1],az=p[i+2],bx=p[i+3],by=p[i+4],bz=p[i+5],cx=p[i+6],cy=p[i+7],cz=p[i+8];
      vol += (ax*(by*cz-bz*cy) - ay*(bx*cz-bz*cx) + az*(bx*cy-by*cx))/6; } }
  return {vol:Math.abs(vol), tris};
}
function toSTL(list){
  const arrs=list.map(geomTris); const tris=arrs.reduce((s,a)=>s+a.length/9,0);
  const buf=new ArrayBuffer(84+tris*50), dv=new DataView(buf);
  const head='Click Imagination | '+plateSize()+'mm '+(S.kind==='stamp20'?'stamp plate':'keycap insert')+' | millimetres'; for(let i=0;i<80;i++) dv.setUint8(i, i<head.length?head.charCodeAt(i):32);
  dv.setUint32(80,tris,true); let o=84;
  for(const p of arrs){ for(let i=0;i<p.length;i+=9){
    const ux=p[i+3]-p[i], uy=p[i+4]-p[i+1], uz=p[i+5]-p[i+2], vx=p[i+6]-p[i], vy=p[i+7]-p[i+1], vz=p[i+8]-p[i+2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const l=Math.hypot(nx,ny,nz)||1; nx/=l; ny/=l; nz/=l;
    dv.setFloat32(o,nx,true); dv.setFloat32(o+4,ny,true); dv.setFloat32(o+8,nz,true); o+=12;
    for(let k=0;k<9;k++){ dv.setFloat32(o,p[i+k],true); o+=4; }
    dv.setUint16(o,0,true); o+=2;
  } }
  return new Uint8Array(buf);
}
const CRC_T=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = (c&1) ? (0xEDB88320^(c>>>1)) : (c>>>1); t[n]=c>>>0; } return t; })();
function crc32(u8){ let c=0xFFFFFFFF; for(let i=0;i<u8.length;i++) c=CRC_T[(c^u8[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function makeZip(files){
  const enc=new TextEncoder(), parts=[], central=[]; let off=0;
  const d=new Date(), tm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1), dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  for(const f of files){
    const nm=enc.encode(f.name), crc=crc32(f.data), len=f.data.length;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(8,0,true);
    lh.setUint16(10,tm,true); lh.setUint16(12,dt,true); lh.setUint32(14,crc,true); lh.setUint32(18,len,true); lh.setUint32(22,len,true);
    lh.setUint16(26,nm.length,true); lh.setUint16(28,0,true);
    parts.push(new Uint8Array(lh.buffer), nm, f.data);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x0800,true); c.setUint16(10,0,true);
    c.setUint16(12,tm,true); c.setUint16(14,dt,true); c.setUint32(16,crc,true); c.setUint32(20,len,true); c.setUint32(24,len,true);
    c.setUint16(28,nm.length,true); c.setUint16(30,0,true); c.setUint16(32,0,true); c.setUint16(34,0,true); c.setUint16(36,0,true);
    c.setUint32(38,0,true); c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30+nm.length+len;
  }
  const cds=central.reduce((s,a)=>s+a.length,0), e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true); e.setUint32(12,cds,true); e.setUint32(16,off,true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], {type:'application/zip'});
}
