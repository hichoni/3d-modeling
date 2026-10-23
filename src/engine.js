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
/* Characters for the 14 mm keycap: two levels so each part takes its own Posca colour. "base" is the body, "top" the
   raised details (eyes, muzzle, cheeks, inner ears) standing on it; holes cut in "top" (a nose, pupils) stay at body
   height. Drawn in mm, y down, centred, inside the plate's rounded square; details >= 1 mm, gaps >= 0.6 mm. */
const CHAR_STEP=.6;
/* Pixel theme (픽셀): an own 5x7 block font for A-Z/0-9, Hangul from Galmuri11's 11x11 bitmaps (vendor/galmuri, OFL),
   and 12x12 sprites at 1 mm per block ('#' body, 'o' raised detail on it), which print crisply on a 0.4 mm nozzle. */
const PIXEL_FONT={'A':'.###.#...##...#######...##...##...#','B':'####.#...##...#####.#...##...#####.','C':'.###.#...##....#....#....#...#.###.','D':'####.#...##...##...##...##...#####.','E':'######....#....####.#....#....#####','F':'######....#....####.#....#....#....','G':'.###.#...##....#.####...##...#.####','H':'#...##...##...#######...##...##...#','I':'.###...#....#....#....#....#...###.','J':'..###...#....#....#....#.#..#..##..','K':'#...##..#.#.#..##...#.#..#..#.#...#','L':'#....#....#....#....#....#....#####','M':'#...###.###.#.##.#.##...##...##...#','N':'#...##...###..##.#.##..###...##...#','O':'.###.#...##...##...##...##...#.###.','P':'####.#...##...#####.#....#....#....','Q':'.###.#...##...##...##.#.##..#..##.#','R':'####.#...##...#####.#.#..#..#.#...#','S':'.#####....#.....###.....#....#####.','T':'#####..#....#....#....#....#....#..','U':'#...##...##...##...##...##...#.###.','V':'#...##...##...##...##...#.#.#...#..','W':'#...##...##...##.#.##.#.##.#.#.#.#.','X':'#...##...#.#.#...#...#.#.#...##...#','Y':'#...##...#.#.#...#....#....#....#..','Z':'#####....#...#...#...#...#....#####','0':'.###.#...##..###.#.###..##...#.###.','1':'..#...##....#....#....#....#...###.','2':'.###.#...#....#...#...#...#...#####','3':'####.....#....#.###.....#....#####.','4':'...#...##..#.#.#..#.#####...#....#.','5':'######....####.....#....##...#.###.','6':'..##..#...#....####.#...##...#.###.','7':'#####....#...#...#...#....#....#...','8':'.###.#...##...#.###.#...##...#.###.','9':'.###.#...##...#.####....#...#..##..'};
function sprite(rows){
  const cells=[];rows.forEach((r,y)=>[...r].forEach((v,x)=>{if(v!=='.')cells.push([x,y,v]);}));
  const xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]),ox=(Math.min(...xs)+Math.max(...xs)+1)/2,oy=(Math.min(...ys)+Math.max(...ys)+1)/2,e=.02;
  const draw=(c,keep)=>{c.beginPath();for(const [x,y,v] of cells)if(keep(v))c.rect(x-ox-e,y-oy-e,1+2*e,1+2*e);c.fill();};
  return {base:c=>draw(c,()=>true),top:c=>draw(c,v=>v==='o')};
}
let galmuri=null;
function galmuriRows(ch){
  const G=globalThis.GALMURI11;if(!G)return null;
  galmuri||=G.ranges.map(r=>{const s=atob(r.data),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return {...r,u16:new Uint16Array(b.buffer)};});
  const cp=ch.codePointAt(0);for(const r of galmuri)if(cp>=r.first&&cp<r.first+r.count){const rows=r.u16.subarray((cp-r.first)*G.rows,(cp-r.first+1)*G.rows);return rows.some(Boolean)?rows:null;}
  return null;
}
// Blocks of one glyph: the 5x7 font for Latin letters and digits, Galmuri for Hangul (on its 11-block grid, centred on
// the inked part), otherwise the glyph sampled on an n x n grid. grid: blocks per cell side, for the block size.
function pixelBits(ch,n){
  const g=PIXEL_FONT[ch.toUpperCase()];if(g)return {cols:5,rows:7,grid:[5,7],on:(x,y)=>g[y*5+x]==='#'};
  const gr=galmuriRows(ch);
  if(gr){let x0=11,x1=-1,y0=11,y1=-1;gr.forEach((m,y)=>{for(let x=0;x<11;x++)if(m>>x&1){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}});
    return {cols:x1-x0+1,rows:y1-y0+1,grid:[11,11],on:(x,y)=>gr[y+y0]>>(x+x0)&1};}
  const k=8,cv=mkCanvas(n*k,n*k),c=cv.getContext('2d',{willReadFrequently:true});c.font='400 100px "Do Hyeon", sans-serif';c.textBaseline='alphabetic';
  const m=c.measureText(ch),l=m.actualBoundingBoxLeft||0,r=m.actualBoundingBoxRight||0,a=m.actualBoundingBoxAscent||0,d=m.actualBoundingBoxDescent||0;
  if(l+r<=0||a+d<=0)return {cols:n,rows:n,on:()=>false};
  const s=Math.min(n*k/(l+r),n*k/(a+d));c.translate(n*k/2,n*k/2);c.scale(s,s);c.fillText(ch,-(r-l)/2,-(d-a)/2);
  const px=c.getImageData(0,0,n*k,n*k).data,bits=new Uint8Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){let sum=0;for(let j=0;j<k;j++)for(let i=0;i<k;i++)sum+=px[((y*k+j)*n*k+x*k+i)*4+3];bits[y*n+x]=sum/(k*k*255)>.42;}
  return {cols:n,rows:n,grid:[n,n],on:(x,y)=>bits[y*n+x]};
}
function drawPixelGlyph(c,ch,x,y,w,h,ppm){
  const n=Math.max(8,Math.min(16,Math.floor(Math.min(w,h)/(.62*ppm)))),b=pixelBits(ch,n),p=Math.min(w/b.grid[0],h/b.grid[1]),x0=x-b.cols*p/2,y0=y-b.rows*p/2,e=.02*ppm;
  c.beginPath();for(let j=0;j<b.rows;j++)for(let i=0;i<b.cols;i++)if(b.on(i,j))c.rect(x0+i*p-e,y0+j*p-e,p+2*e,p+2*e);c.fill();
}
const CHARACTERS={
 click:{name:'클릭이',label:'클릭',base:c=>{c.save();c.rotate(-.1);rr(c,-5.2,-4.8,10.4,9.6,2.8);c.restore();},
  top:c=>{ell(c,-2,-.6,.65,1.05);ell(c,2,-.6,.65,1.05);arcLine(c,0,.9,1.6,.35,Math.PI-.35,.9);ell(c,-3.6,2,.95,.7);ell(c,3.6,2,.95,.7);}},
 bear:{name:'곰돌이',label:'🐻',base:c=>{circ(c,0,.9,4.7);circ(c,-3.7,-3.2,1.9);circ(c,3.7,-3.2,1.9);},
  top:c=>{circ(c,-3.7,-3.2,.95);circ(c,3.7,-3.2,.95);ell(c,0,2.5,2.5,1.8);circ(c,-1.9,-.1,.62);circ(c,1.9,-.1,.62);cut(c,()=>ell(c,0,1.8,.9,.6));}},
 cat:{name:'고양이',label:'🐱',base:c=>{ell(c,0,1,4.9,4.1);poly(c,[[-4.6,-1.2],[-3.9,-5.6],[-1,-2.9]],.8);poly(c,[[4.6,-1.2],[3.9,-5.6],[1,-2.9]],.8);},
  top:c=>{poly(c,[[-3.75,-2.3],[-3.55,-4.3],[-2.1,-2.95]],.5);poly(c,[[3.75,-2.3],[3.55,-4.3],[2.1,-2.95]],.5);ell(c,-1.9,.4,.6,.85);ell(c,1.9,.4,.6,.85);poly(c,[[-.65,1.7],[.65,1.7],[0,2.5]],.45);}},
 rabbit:{name:'토끼',label:'🐰',base:c=>{circ(c,0,2.2,3.9);ell(c,-1.7,-2.9,1.35,3.2,-.15);ell(c,1.7,-2.9,1.35,3.2,.15);},
  top:c=>{ell(c,-1.7,-2.9,.6,2.2,-.15);ell(c,1.7,-2.9,.6,2.2,.15);circ(c,-1.45,1.7,.6);circ(c,1.45,1.7,.6);ell(c,0,3.2,.5,.4);ell(c,-2.5,3.6,.9,.6);ell(c,2.5,3.6,.9,.6);}},
 chick:{name:'병아리',label:'🐥',base:c=>{circ(c,0,.9,5);circ(c,-.5,-4.6,.9);circ(c,.6,-4.9,.8);},
  top:c=>{circ(c,-1.9,-.3,.62);circ(c,1.9,-.3,.62);poly(c,[[-1.1,.9],[1.1,.9],[0,2.3]],.4);ell(c,-3.2,1.6,.95,.65);ell(c,3.2,1.6,.95,.65);}},
 frog:{name:'개구리',label:'🐸',base:c=>{ell(c,0,1.8,5.6,3.9);circ(c,-2.9,-2.3,2.1);circ(c,2.9,-2.3,2.1);},
  top:c=>{circ(c,-2.9,-2.3,1.35);circ(c,2.9,-2.3,1.35);cut(c,()=>{circ(c,-2.9,-2.1,.55);circ(c,2.9,-2.1,.55);});arcLine(c,0,1.4,2.6,.45,Math.PI-.45,.85);ell(c,-4.1,2,.8,.6);ell(c,4.1,2,.8,.6);}},
 puppy:{name:'강아지',label:'🐶',base:c=>{ell(c,0,.9,4.4,4.1);ell(c,-4.1,.2,1.6,3.1,.35);ell(c,4.1,.2,1.6,3.1,-.35);},
  top:c=>{ell(c,-4.1,.4,1.05,2.4,.35);ell(c,4.1,.4,1.05,2.4,-.35);circ(c,-1.6,.1,.62);circ(c,1.6,.1,.62);ell(c,0,2.1,.95,.7);}},
 panda:{name:'판다',label:'🐼',base:c=>{circ(c,0,1,4.8);circ(c,-3.8,-3.1,1.7);circ(c,3.8,-3.1,1.7);},
  top:c=>{circ(c,-3.8,-3.1,1.2);circ(c,3.8,-3.1,1.2);ell(c,-1.9,.6,1.15,1.5,.5);ell(c,1.9,.6,1.15,1.5,-.5);cut(c,()=>{circ(c,-1.8,.4,.48);circ(c,1.8,.4,.48);});ell(c,0,2.9,.75,.55);}},
 penguin:{name:'펭귄',label:'🐧',base:c=>{ell(c,0,.7,4.6,5.5);},
  top:c=>{circ(c,-1.55,-.8,1.9);circ(c,1.55,-.8,1.9);ell(c,0,1.4,3.1,2.6);cut(c,()=>{circ(c,-1.4,-.9,.5);circ(c,1.4,-.9,.5);poly(c,[[-.75,.55],[.75,.55],[0,1.6]],.3);});}},
 pig:{name:'돼지',label:'🐷',base:c=>{ell(c,0,.9,5,4.3);poly(c,[[-4.6,-1.4],[-3.9,-4.9],[-1.6,-3.2]],.9);poly(c,[[4.6,-1.4],[3.9,-4.9],[1.6,-3.2]],.9);},
  top:c=>{ell(c,0,1.9,2.1,1.45);cut(c,()=>{ell(c,-.7,1.9,.42,.55);ell(c,.7,1.9,.42,.55);});circ(c,-2.2,-.5,.58);circ(c,2.2,-.5,.58);}},
 ghost:{name:'유령',label:'👻',base:c=>{c.beginPath();c.moveTo(-4.4,-.8);c.arc(0,-.8,4.4,Math.PI,0);c.lineTo(4.4,4.4);for(let i=0;i<3;i++){const x=4.4-i*2.933;c.quadraticCurveTo(x-.73,6.3,x-1.47,4.6);c.quadraticCurveTo(x-2.2,6.3,x-2.933,4.4);}c.closePath();c.fill();},
  top:c=>{ell(c,-1.5,-.8,.62,.88);ell(c,1.5,-.8,.62,.88);ell(c,0,1.4,.8,.6);ell(c,-2.8,.7,.85,.58);ell(c,2.8,.7,.85,.58);}},
 whale:{name:'고래',label:'🐳',base:c=>{ell(c,.8,1.4,4.8,3.6);poly(c,[[-3.6,.9],[-6,-2.8],[-4.7,-1.2],[-3.3,-2.9]],.6);circ(c,1.6,-3.3,.7);circ(c,.7,-4.4,.62);circ(c,2.5,-4.4,.62);},
  top:c=>{circ(c,2.2,.6,.6);arcLine(c,2.4,1.8,1.1,.35,Math.PI-.35,.7);}},
 slime:{name:'슬라임',label:'▦',pixel:true,...sprite(["..########..", ".#oooooooo#.", ".#oooooooo#.", ".#o##oo##o#.", ".#o##oo##o#.", ".#oooooooo#.", ".#ooo##ooo#.", ".#oooooooo#.", ".#oooooooo#.", "..########.."])},
 pheart:{name:'픽셀 하트',label:'▦',pixel:true,...sprite(["..##....##..", ".####..####.", "############", "#oo#########", "#o##########", "############", ".##########.", "..########..", "...######...", "....####....", ".....##....."])},
 mushroom:{name:'버섯',label:'▦',pixel:true,...sprite(["...######...", "..##oo####..", ".###oo##oo#.", ".#######oo#.", ".##oo######.", ".##oo######.", "....####....", "....#oo#....", "....#oo#....", "...######..."])},
 gem:{name:'보석',label:'▦',pixel:true,...sprite(["...######...", "..#oooooo#..", ".#oo####oo#.", "############", ".##oooooo##.", "..##oooo##..", "...##oo##...", "....####....", ".....##....."])},
 pcat:{name:'픽셀 고양이',label:'▦',pixel:true,...sprite([".#........#.", ".##......##.", ".###....###.", ".##########.", ".#oooooooo#.", ".#o#oooo#o#.", ".#oooooooo#.", ".#ooo##ooo#.", ".#oooooooo#.", "..########.."])},
 grass:{name:'잔디 블록',label:'▦',pixel:true,...sprite(["oooooooooooo", "oooooooooooo", "oooooooooooo", "o#oo#ooo#oo#", "##o####o####", "############", "###o#####o##", "############", "#o######o###", "############", "####o#######", "############"])},
 sword:{name:'검',label:'▦',pixel:true,...sprite([".....##.....", "....#oo#....", "....#oo#....", "....#oo#....", "....#oo#....", "....#oo#....", "....#oo#....", "..########..", "..########..", ".....##.....", ".....##.....", "....####...."])}
};
/* Frames that hold initials (heart, badge, cloud, speech bubble): the frame is the body, the initials stand on it. */
const FRAMES={
 heart:{name:'하트',base:c=>{c.beginPath();c.moveTo(0,5.6);c.bezierCurveTo(-9.5,-.2,-5.4,-8.2,0,-3.1);c.bezierCurveTo(5.4,-8.2,9.5,-.2,0,5.6);c.fill();},inner:[0,-.5,7.4,4.4]},
 badge:{name:'뱃지',label:'🏷',base:c=>circ(c,0,0,5.9),top:c=>{circ(c,0,0,5.3);cut(c,()=>circ(c,0,0,4.5));},inner:[0,0,7.2,4.6]},
 cloud:{name:'구름',label:'☁',base:c=>{circ(c,-3.2,1,2.6);circ(c,0,-.8,3.4);circ(c,3.2,1,2.6);rr(c,-5.3,.4,10.6,3.2,1.6);},inner:[0,1,7.4,3.6]},
 bubble:{name:'말풍선',label:'💬',base:c=>{rr(c,-6,-5,12,8.6,3);poly(c,[[-2.8,3.2],[-4.4,6.2],[.2,3.2]],.4);},inner:[0,-.7,9,5]}
};
const PICTURE_TAG=/^[A-Z0-9]{1,3}$/;
// Initials in mm, fitted into a w x h box centred at (x, y); bold widens the strokes like the letter mode does.
function fitText(c,text,x,y,w,h,font,bold){
  if(font.pixel){const n=[...text],gw=w/(n.length*6-1);n.forEach((ch,i)=>drawPixelGlyph(c,ch,x-w/2+gw*(i*6+2.5),y,gw*5,h,1));return;}
  c.save();c.font=`${font.weight} 100px "${font.family}", "Apple SD Gothic Neo", sans-serif`;c.textBaseline='alphabetic';c.textAlign='left';
  const m=c.measureText(text),l=m.actualBoundingBoxLeft||0,r=m.actualBoundingBoxRight||0,a=m.actualBoundingBoxAscent||0,d=m.actualBoundingBoxDescent||0;
  if(l+r>0&&a+d>0){const s=Math.min((w-2*bold)/(l+r),(h-2*bold)/(a+d));c.translate(x,y);c.scale(s,s);c.fillText(text,-(r-l)/2,-(d-a)/2);if(bold>0){c.lineWidth=2*bold/s;c.lineJoin='round';c.strokeText(text,-(r-l)/2,-(d-a)/2);}}
  c.restore();
}
function circ(c,x,y,r){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function ell(c,x,y,rx,ry,rot=0){c.beginPath();c.ellipse(x,y,rx,ry,rot,0,Math.PI*2);c.fill();}
function rr(c,x,y,w,h,r){c.beginPath();roundRectPath(c,x,y,w,h,r);c.fill();}
function poly(c,pts,round=0){c.beginPath();pts.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](x,y));c.closePath();c.fill();if(round){c.lineJoin='round';c.lineWidth=round;c.stroke();}}
function arcLine(c,x,y,r,a0,a1,width){c.beginPath();c.arc(x,y,r,a0,a1);c.lineWidth=width;c.lineCap='round';c.stroke();}
function cut(c,draw){c.save();c.globalCompositeOperation='destination-out';draw();c.restore();}
// A picture's two levels. part: 'base' (body) | 'top' (details standing on it) | 'flat' (body minus details: what
// engrave and stamp use). tag: initials, inside a frame or under a smaller picture.
function pictureLevels(id,tag,font,bold){
  const ch=CHARACTERS[id],fr=FRAMES[id],t=tag&&PICTURE_TAG.test(tag)?tag:'';if(ch?.pixel)font=PIXEL_FONT_FACE;
  // The plain heart keeps the classic icon; with initials it becomes the bigger frame.
  if(fr&&(t||id!=='heart'))return {base:c=>fr.base(c),top:fr.top||t?c=>{fr.top?.(c);if(t)fitText(c,t,...fr.inner,font,bold);}:null};
  const below=draw=>t?c=>{c.save();c.translate(0,-2.2);c.scale(.74,.74);draw(c);c.restore();}:draw,tagBelow=c=>{if(t)fitText(c,t,0,4.5,8.6,3.2,font,bold);};
  if(ch)return {base:c=>{below(ch.base)(c);tagBelow(c);},top:below(ch.top)};
  return {base:c=>{below(c=>drawSymbol(c,id,0,0,9.5))(c);tagBelow(c);},top:null};
}
function drawAsset(ctx,id,x,y,mmPx,part='flat',tag='',font=FONTS[0],bold=0){
  const lv=pictureLevels(id,tag,font,bold);ctx.save();ctx.translate(x,y);ctx.scale(mmPx,mmPx);ctx.fillStyle=ctx.strokeStyle='#000';
  if(part==='top')lv.top?.(ctx);else lv.base(ctx);
  if(part==='flat'&&lv.top){ // details drawn apart (their own holes intact), then cleared out of the body
    const T=mkCanvas(ctx.canvas.width,ctx.canvas.height),tc=T.getContext('2d');tc.setTransform(ctx.getTransform());tc.fillStyle=tc.strokeStyle='#000';lv.top(tc);
    ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='destination-out';ctx.drawImage(T,0,0);
  }
  ctx.restore();
}
const pictureHasTop=()=>S.content==='icon'&&!!pictureLevels(S.icon,S.tag,FONTS[0],0).top;
let characterPart='flat';
function drawSymbol(ctx,kind,x,y,size){
  ctx.save();ctx.translate(x,y);ctx.scale(size/10,size/10);ctx.beginPath();
  if(kind==='heart'){ctx.moveTo(0,4.5);ctx.bezierCurveTo(-8,-.5,-4.5,-7,0,-2.7);ctx.bezierCurveTo(4.5,-7,8,-.5,0,4.5);ctx.fill();}
  if(kind==='star'){for(let i=0;i<10;i++){const t=-Math.PI/2+i*Math.PI/5,r=i%2?2.3:5;ctx[i?'lineTo':'moveTo'](Math.cos(t)*r,Math.sin(t)*r);}ctx.closePath();ctx.fill();}
  if(kind==='smile'){ctx.lineWidth=.9;ctx.arc(0,0,4.4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(-1.5,-1,.55,0,Math.PI*2);ctx.arc(1.5,-1,.55,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(0,.3,2,0,Math.PI);ctx.stroke();}
  if(kind==='leaf'){ctx.moveTo(-4,4);ctx.bezierCurveTo(-6,-3,1,-4.5,4.5,-4.5);ctx.bezierCurveTo(5,1,2,6,-4,4);ctx.fill();ctx.globalCompositeOperation='destination-out';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-3,3);ctx.lineTo(2.6,-2.6);ctx.stroke();}
  ctx.restore();
}
/* Border (테두리) round the plate's top. Its outer edge stays 0.6 mm in from the plate edge, clear of the keycap
   base's crush ribs (they reach 0.3 mm in), so the plate fits the base exactly as without one. Dots >= 0.8 mm, gaps
   >= 0.5 mm. The content shrinks to keep 0.5 mm clear inside the band. All sizes in mm. */
const EDGE_CENTER=1.25,EDGE_MARGIN=2.4;
const EDGES={
 line:{name:'선',draw:(c,L)=>L(.9,null)},
 stitch:{name:'점선',draw:(c,L)=>L(.8,[1.4,.9],'butt')},
 dots:{name:'땡땡이',draw:(c,L)=>L(1.1,[0,1.9])},
 bubbles:{name:'물방울',draw:(c,L)=>{L(1.3,[0,3.1]);L(.8,[0,3.1],'round',1.55);}},
 wave:{name:'구름결',draw:(c,L)=>L(1.2,[0,.9])}
};
// Initials under a shrunk picture leave no room for a border.
const edgeAllowed=()=>!(S.content==='icon'&&PICTURE_TAG.test(S.tag||'')&&!FRAMES[S.icon]);
const activeEdge=()=>EDGES[S.edge]&&edgeAllowed()?S.edge:'none';
function contentScale(){if(activeEdge()==='none')return 1;const half=plateSize()/2,gap=Math.max(.5,.05*plateSize());return (half-EDGE_MARGIN)/(half-gap);}
function drawEdge(ctx,cx,cy,ppm,style){
  const w=plateSize(),side=w-2*EDGE_CENTER,r=Math.max(.3,cornerR(w,w)-EDGE_CENTER),P=4*(side-2*r)+2*Math.PI*r;
  ctx.save();ctx.strokeStyle='#000';
  EDGES[style].draw(ctx,(width,dash,cap='round',offset=0)=>{
    ctx.beginPath();roundRectPath(ctx,cx-side/2*ppm,cy-side/2*ppm,side*ppm,side*ppm,r*ppm);ctx.closePath();
    ctx.lineWidth=width*ppm;ctx.lineCap=cap;ctx.lineJoin='round';
    if(dash){const period=dash[0]+dash[1],n=Math.max(8,Math.round(P/period)),k=P/n/period;ctx.setLineDash(dash.map(v=>Math.max(.001,v*k*ppm)));ctx.lineDashOffset=-offset*k*ppm;}else ctx.setLineDash([]);
    ctx.stroke();});
  ctx.restore();
}
function letterLayer(cw, ch, ppm, mirror, font, list){
  const out=contentLayer(cw, ch, ppm, mirror, font, list),edge=activeEdge();
  if(edge!=='none'&&characterPart!=='top')drawEdge(out.getContext('2d'),cw/2,ch/2,ppm,edge);
  return out;
}
function contentLayer(cw, ch, ppm, mirror, font, list){
  const L = mkCanvas(cw, ch), lx = L.getContext('2d');
  const {w,h} = dims(); const cx=cw/2, cy=ch/2, k=w/14, cs=contentScale();
  lx.fillStyle=lx.strokeStyle='#000';
  if(S.content==='icon'){if(mirror){lx.translate(cw,0);lx.scale(-1,1);}drawAsset(lx,S.icon,cx,cy,k*cs*ppm,characterPart,S.tag,font,S.bold);lastCellMinMm=(S.tag?7:12)*k*cs;return L;}
  const n = list.length; if(!n) return L;
  const gapMm = Math.max(0.5, 0.05*Math.min(w,h));
  const box = contentBox(w*ppm, h*ppm, S.shape, (S.border+(activeEdge()==='none'?gapMm:EDGE_MARGIN))*ppm, n, S.layout);
  if(!box) return L;
  const g = 0.035*Math.min(box.w, box.h);
  const decorated=S.decoration!=='none';
  const cells = layoutCells(n, S.layout, {x:cx-box.w/2, y:cy-box.h/2, w:box.w, h:box.h-(decorated?3.8*k*cs*ppm:0)}, g);
  lastCellMinMm = Math.min(...cells.map(c=>Math.min(c.w,c.h)))/ppm;
  lx.fillStyle = '#000';
  if(mirror){ lx.translate(cw,0); lx.scale(-1,1); }
  const fs = 200;
  lx.font = `${font.weight} ${fs}px "${font.family}", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  lx.textBaseline='alphabetic'; lx.textAlign='left';
  if(font.pixel){ // blocks, no rounded bold (it would melt the corners)
    list.forEach((chr,i)=>{const cell=cells[i];if(cell)drawPixelGlyph(lx,chr,cell.x+cell.w/2,cell.y+cell.h/2,cell.w,cell.h,ppm);});
    if(decorated)drawSymbol(lx,S.decoration,cx,cy+4.4*k*cs*ppm,2.8*k*cs*ppm);
    return L;
  }
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
  if(decorated)drawSymbol(lx,S.decoration,cx,cy+4.4*k*cs*ppm,2.8*k*cs*ppm);
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
  const ox=cw/2, oy=ch/2, toShapes=a=>loopsToShapes(traceContours(a, cw, ch, 0.5), q=>clampToInsert((q[0]+.5-ox)/ppm, -(q[1]+.5-oy)/ppm));
  const face=part=>{characterPart=part;const cv=mkCanvas(cw,ch),ctx=cv.getContext('2d',{willReadFrequently:true});drawFace(ctx,cw,ch,ppm,S.mirror,'#000',font);characterPart='flat';
    const data=ctx.getImageData(0,0,cw,ch).data,a=new Float32Array(cw*ch);for(let i=0,j=3;i<a.length;i++,j+=4)a[i]=data[j]/255;
    for(let x=0;x<cw;x++){a[x]=0;a[(ch-1)*cw+x]=0;}for(let y=0;y<ch;y++){a[y*cw]=0;a[y*cw+cw-1]=0;}return a;};
  // Relief levels: one for letters and icons; a character in a raised mode stacks its details on its body. Puffy
  // levels are domed (see puffSlabs); the others are flat extrusions.
  const puffy=S.mode==='puffy',layered=pictureHasTop()&&(S.mode==='relief'||puffy);
  const levels=layered?[{alpha:face('base'),h:puffy?relief+PUFF_EXTRA:relief},{alpha:face('top'),h:CHAR_STEP}]:[{alpha:face('flat'),h:puffy?relief+PUFF_EXTRA:relief}];

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
  let z=zTop,top=zTop;
  for(const level of levels){
    const slabs=puffy?puffSlabs(level.alpha,cw,ch,ppm,level.h):[{alpha:level.alpha,z0:0,z1:level.h}];
    for(const s of slabs){const shapes=toShapes(s.alpha);if(!shapes.length)continue;
      const rel=new THREE.ExtrudeGeometry(shapes,{depth:s.z1-s.z0+EPS,bevelEnabled:false,curveSegments:4});rel.translate(0,0,z+s.z0-EPS);parts.relief.push(rel);top=Math.max(top,z+s.z1);}
    z+=level.h;
  }
  return {parts, totalH: top, w, h, handleTop};
}
/* Puffy (말랑): a 0.4 mm straight wall, then a quarter-round dome reaching full height 1.1 mm in from the edge.
   Built as 0.2 mm slabs (one per printed layer), each the region at least d(z) inside the outline. */
const PUFF_WALL=.4,PUFF_R=1.1,PUFF_EXTRA=.4,PUFF_STEP=.2;
function puffSlabs(alpha,cw,ch,ppm,H){
  const inside=distanceInside(alpha,cw,ch),n=Math.max(1,Math.round(H/PUFF_STEP)),out=[];
  for(let k=0;k<n;k++){
    const z0=k*H/n,z1=(k+1)*H/n,zm=(z0+z1)/2;
    if(zm<=PUFF_WALL){out.push({alpha,z0,z1});continue;}
    const t=Math.min(1,(zm-PUFF_WALL)/(H-PUFF_WALL)),d=PUFF_R*(1-Math.sqrt(1-t*t))*ppm,a=new Float32Array(alpha.length);
    for(let i=0;i<a.length;i++)a[i]=Math.max(0,Math.min(1,inside[i]-d+.5));
    out.push({alpha:a,z0,z1});
  }
  return out;
}
// Distance in pixels from each inside pixel (alpha >= 0.5) to the outline; exact squared EDT (Felzenszwalb).
function distanceInside(alpha,W,H){
  const INF=1e12,f=new Float64Array(Math.max(W,H)),d=new Float64Array(Math.max(W,H)),v=new Int32Array(Math.max(W,H)),zz=new Float64Array(Math.max(W,H)+1),g=new Float64Array(W*H);
  const pass=n=>{let k=0;v[0]=0;zz[0]=-INF;zz[1]=INF;for(let q=1;q<n;q++){let s;do{const p=v[k];s=((f[q]+q*q)-(f[p]+p*p))/(2*q-2*p);if(s<=zz[k])k--;else break;}while(k>=0);k++;v[k]=q;zz[k]=s;zz[k+1]=INF;}k=0;for(let q=0;q<n;q++){while(zz[k+1]<q)k++;const p=v[k];d[q]=(q-p)*(q-p)+f[p];}};
  for(let i=0;i<W*H;i++)g[i]=alpha[i]>=.5?INF:0;
  for(let x=0;x<W;x++){for(let y=0;y<H;y++)f[y]=g[y*W+x];pass(H);for(let y=0;y<H;y++)g[y*W+x]=d[y];}
  const out=new Float32Array(W*H);
  for(let y=0;y<H;y++){for(let x=0;x<W;x++)f[x]=g[y*W+x];pass(W);for(let x=0;x<W;x++)out[y*W+x]=Math.max(0,Math.sqrt(d[x])-.5);}
  return out;
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
