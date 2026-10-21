// Isolated Web App for Chromebooks: the same pages and code as the public site, split into files so they run
// under the IWA's strict CSP/Trusted Types, plus the manifest that grants Direct Sockets for the A1 mini.
// Output: artifacts/iwa-app/ (signed into downloads/click-studio.swbn by tools/iwa/build.cjs).
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','iwa-app');
const VERSION='1.1.1',REMOTE='https://hichoni.github.io/3d-modeling/',UPDATE_URL='https://hichoni.github.io/3d-modeling/downloads/click-studio-update.json';
function manifest(){return {name:'Click Studio · A1 mini 직접 출력',short_name:'Click Studio',description:'크롬북에서 모델링·슬라이싱하고 같은 Wi-Fi의 Bambu Lab A1 mini로 바로 출력합니다.',id:'/',start_url:'/',scope:'/',display:'standalone',background_color:'#f6f1e8',theme_color:'#ff7a45',lang:'ko',version:VERSION,update_manifest_url:UPDATE_URL,
 icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}],
 permissions_policy:{'cross-origin-isolated':['self'],'direct-sockets':['self'],'direct-sockets-private':['self'],'direct-sockets-multicast':['self'],'local-network':['self'],'loopback-network':['self']}};}
// A flat app icon drawn in code: orange tile, build plate, printed block and nozzle.
function icon(size){
 const px=Buffer.alloc(size*size*4),s=size/512,set=(x,y,[r,g,b,a=255])=>{const i=(y*size+x)*4;px[i]=r;px[i+1]=g;px[i+2]=b;px[i+3]=a;};
 const inRound=(x,y,x0,y0,x1,y1,rad)=>{if(x<x0||x>x1||y<y0||y>y1)return false;const cx=Math.min(Math.max(x,x0+rad),x1-rad),cy=Math.min(Math.max(y,y0+rad),y1-rad);return (x-cx)**2+(y-cy)**2<=rad*rad;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const X=x/s,Y=y/s;let c=[255,122,69];
  if(inRound(X,Y,96,356,416,392,14))c=[255,255,255];else if(inRound(X,Y,176,236,336,356,18))c=[44,52,72];else if(inRound(X,Y,196,256,316,282,8))c=[255,214,102];
  else if(Y>=120&&Y<=180&&Math.abs(X-256)<=46-(Y-120)*.45)c=[255,255,255];else if(inRound(X,Y,150,96,362,128,10))c=[255,255,255];
  set(x,y,c);}
 const raw=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++)px.copy(raw,y*(size*4+1)+1,y*size*4,(y+1)*size*4);
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;}),crc=b=>{let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const chunk=(type,data)=>{const len=Buffer.alloc(4),sum=Buffer.alloc(4),body=Buffer.concat([Buffer.from(type),data]);len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(body));return Buffer.concat([len,body,sum]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
// The IWA requires Trusted Types; the app only assigns markup it builds itself, so a pass-through default policy suffices.
const TRUSTED_TYPES="if(self.trustedTypes&&trustedTypes.createPolicy&&!trustedTypes.defaultPolicy)trustedTypes.createPolicy('default',{createHTML:s=>s,createScriptURL:s=>s});\n";
const OPEN_PAGE=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Click Studio</title><style>html,body{margin:0;height:100%;background:#f6f1e8;font-family:system-ui,sans-serif;color:#5b6475}body::before{content:'최신 Click Studio를 여는 중…';position:fixed;inset:0;display:grid;place-items:center;font-size:14px}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;background:transparent}</style></head><body><script src="/tt.js"></script><script src="/shell.js"></script></body></html>`;
const LAUNCHER=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Click Studio</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f1e8;font-family:system-ui,'Noto Sans KR',sans-serif;color:#2c3448}main{width:min(560px,92vw)}h1{font-size:28px;margin:0 0 6px}p{color:#5b6475;line-height:1.6}
a.card{display:block;margin:14px 0;padding:20px 22px;border-radius:18px;background:#fff;color:inherit;text-decoration:none;box-shadow:0 2px 0 #e7dccb}a.card:hover{outline:3px solid #ff7a45}a.card b{display:block;font-size:20px;margin-bottom:4px}small{color:#5b6475}</style></head>
<body><main><h1>Click Studio</h1><p>크롬북에서 만들고, 슬라이싱하고, 같은 Wi-Fi의 A1 mini로 바로 출력해요. 출력 PC는 필요 없어요.</p>
<a class="card" href="/open.html?page=studio#connect=1"><b>STL 스튜디오</b><small>STL 불러오기 · 배치 · 레이어 계산 · A1 mini 출력</small></a>
<a class="card" href="/open.html?page=booth"><b>3D 키캡 클리커 만들기</b><small>이름·그림으로 14mm 조각 만들기 체험</small></a>
<p><small>항상 사이트의 최신 버전으로 열려요. 인터넷이 없으면 앱에 들어 있는 버전(v${VERSION})으로 열려요 · <a href="/studio.html#connect=1">앱 안의 스튜디오</a> · <a href="/booth.html">앱 안의 키캡 체험</a></small></p>
<p><small>처음이라면: 프린터에서 LAN Only와 개발자 모드를 켠 뒤, 스튜디오의 [프린터 연결]에서 같은 Wi-Fi의 미니를 찾고 8자리 코드를 입력하세요.</small></p></main></body></html>`;
function page(template,{cssMark,css,jsMark,script,licenseMark,licenses}){
 const html=fs.readFileSync(path.join(root,template),'utf8').replace(cssMark,()=>css).replace(`<script>${jsMark}</script>`,()=>`<script src="/tt.js"></script><script src="/${script}"></script>`).replace(licenseMark,()=>`<!-- Bundled third-party licenses\n${licenses.replace(/-->/g,'')}\n-->`);
 if(/<script>(?!<\/script>)/.test(html.replace(/<script src="\/[a-z-]+\.js"><\/script>/g,'')))throw Error(template+': inline script left in the IWA page');
 return html.replace(/\r\n/g,'\n');
}
// Fonts ship as files (font-src 'self') instead of base64 so the signed bundle stays smaller.
function buildApp({fonts,licenses,boothJS,studioJS}){
 const css=fonts.map(([family,weight,file])=>`@font-face{font-family:'${family}';font-weight:${weight};font-display:block;src:url(/fonts/${file}) format('truetype');}`).join('\n')+fs.readFileSync(path.join(root,'src/style.css'),'utf8');
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'.well-known'),{recursive:true});fs.mkdirSync(path.join(out,'icons'));fs.mkdirSync(path.join(out,'fonts'));
 const files={
  '.well-known/manifest.webmanifest':JSON.stringify(manifest(),null,1),'icons/icon-192.png':icon(192),'icons/icon-512.png':icon(512),'tt.js':TRUSTED_TYPES,'index.html':LAUNCHER,
  ...Object.fromEntries(fonts.map(([,,file])=>['fonts/'+file,fs.readFileSync(path.join(root,'fonts',file))])),
  'open.html':OPEN_PAGE,'shell.js':fs.readFileSync(path.join(root,'src/iwa-shell.js'),'utf8').replace("/* SHELL_VERSION */''",JSON.stringify(VERSION)).replace("/* SHELL_REMOTE */''",JSON.stringify(REMOTE)).replace('/* SHELL_ALLOW_LOOPBACK */false','false'),
  'kiri-worker.js':fs.readFileSync(path.join(root,'vendor/kiri/fdm-worker.js')),
  'studio.js':"const BROWSER_SLICE_WORKER_URL='/kiri-worker.js',CLICK_APP_VERSION='"+VERSION+"';\n"+studioJS,'booth.js':"const BROWSER_SLICE_WORKER_URL='/kiri-worker.js',CLICK_APP_VERSION='"+VERSION+"';\n"+boothJS,
  'studio.html':page('src/studio.html',{cssMark:'/* STUDIO_CSS */',css:fs.readFileSync(path.join(root,'src/studio.css'),'utf8'),jsMark:'/* STUDIO_JS */',script:'studio.js',licenseMark:'<!-- STUDIO_LICENSES -->',licenses}),
  'booth.html':page('src/index.html',{cssMark:'/* BUNDLED_CSS */',css,jsMark:'/* BUNDLED_JS */',script:'booth.js',licenseMark:'<!-- LICENSES -->',licenses})
 };
 for(const [name,data] of Object.entries(files))fs.writeFileSync(path.join(out,name),data);
 console.log('Built Isolated Web App files in artifacts/iwa-app ('+Object.keys(files).length+' files, v'+VERSION+')');return {out,version:VERSION,files:Object.keys(files)};
}
module.exports={buildApp,manifest,VERSION,UPDATE_URL,REMOTE,out};
