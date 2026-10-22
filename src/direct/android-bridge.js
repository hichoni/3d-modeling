// Android tablet app: the app shows this public page in a WebView and injects `ClickNative`, a message channel to
// native TCP/UDP sockets limited to the A1 mini's LAN protocol (same rules as the Chromebook app's shell).
// Here it becomes the Direct Sockets API (TCPSocket/UDPSocket), so DirectRelay, TLS and FTPS run unchanged.
// Inert in every other browser.
(function(root){
 const native=root.ClickNative;
 if(!native||typeof native.postMessage!=='function'||root.TCPSocket)return;
 const waiting=new Map(),sockets=new Map();let next=1;
 const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s);};
 const unb64=text=>{const s=atob(text||''),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;};
 const request=message=>new Promise((resolve,reject)=>{const id=next++;waiting.set(id,{resolve,reject});native.postMessage(JSON.stringify({...message,id}));});
 native.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.id){const w=waiting.get(m.id);if(!w)return;waiting.delete(m.id);if(m.ok)w.resolve(m);else{const err=Error(m.error||'연결하지 못했습니다.');err.name=m.name||'NetworkError';w.reject(err);}return;}
  const s=sockets.get(m.sid);if(!s)return;
  if(m.ev==='data')s.push(unb64(m.data));else if(m.ev==='udp')s.push({data:unb64(m.data),remoteAddress:m.host,remotePort:m.port});
  else if(m.ev==='end'||m.ev==='error'){s.end(m.ev==='error'?m.message:null);sockets.delete(m.sid);}
 });
 function readable(sid){let ctrl,done=false;const stream=new ReadableStream({start(c){ctrl=c;},cancel(){done=true;request({op:'close',sid}).catch(()=>{});}});
  sockets.set(sid,{push:v=>{if(!done)ctrl.enqueue(v);},end:err=>{if(done)return;done=true;try{err?ctrl.error(Error(err)):ctrl.close();}catch{}}});return stream;}
 class TCPSocket{
  constructor(host,port,options={}){
   this.opened=request({op:'tcp',host:String(host),port:Number(port),noDelay:!!options.noDelay}).then(m=>{this.sid=m.sid;const sid=m.sid;
    // A write resolves once the native side has handed the bytes to the socket, so backpressure is real.
    const writable=new WritableStream({write:chunk=>request({op:'write',sid,data:b64(new Uint8Array(chunk.buffer?chunk.buffer.slice(chunk.byteOffset,chunk.byteOffset+chunk.byteLength):chunk))}).then(()=>{}),close:()=>request({op:'shutdown',sid}).then(()=>{},()=>{}),abort:()=>request({op:'close',sid}).then(()=>{},()=>{})});
    return {readable:readable(sid),writable,...m.info};});
   this.opened.catch(()=>{});this.closed=new Promise(()=>{});
  }
  close(){return this.opened.then(()=>request({op:'close',sid:this.sid}),()=>{}).then(()=>{},()=>{});}
 }
 class UDPSocket{
  constructor(options={}){const o={};for(const k of ['localAddress','localPort','remoteAddress','remotePort','multicastAllowAddressSharing'])if(options[k]!==undefined)o[k]=options[k];
   this.opened=request({op:'udp',options:o}).then(m=>{this.sid=m.sid;const sid=m.sid;
    const writable=new WritableStream({write:msg=>request({op:'send',sid,data:b64(new Uint8Array(msg.data)),host:msg.remoteAddress??o.remoteAddress,port:msg.remotePort??o.remotePort}).then(()=>{})});
    return {readable:readable(sid),writable,...m.info,multicastController:m.multicast?{joinedGroups:[],joinGroup:g=>request({op:'join',sid,group:String(g)}).then(()=>{}),leaveGroup:g=>request({op:'leave',sid,group:String(g)}).then(()=>{})}:undefined};});
   this.opened.catch(()=>{});this.closed=new Promise(()=>{});
  }
  close(){return this.opened.then(()=>request({op:'close',sid:this.sid}),()=>{}).then(()=>{},()=>{});}
 }
 root.TCPSocket=TCPSocket;root.UDPSocket=UDPSocket;
 // WebView has no download manager for blob links; the app saves files to the tablet's Download folder.
 root.ClickAndroid={version:null,async save(blob,name){const r=await request({op:'save',name:String(name).replace(/[\\/:*?"<>|]/g,'_').slice(0,120),mime:blob.type||'application/octet-stream',data:b64(new Uint8Array(await blob.arrayBuffer()))});return r.path;}};
 // A 3MF the app caught from MakerWorld's "Bambu Studio로 열기" link, downloaded natively; taken once.
 root.ClickAndroid.takeImport=async()=>{const r=await request({op:'takeImport'});if(!r.name)return null;return {name:r.name,blob:new Blob([unb64(r.data)],{type:'model/3mf'})};};
 request({op:'hello',page:root.location.pathname}).then(m=>{root.ClickAndroid.version=String(m.version||'');void offerUpdate(root.ClickAndroid.version);},()=>{});
 // Screens come from the site and are always current; only the app shell needs a new APK now and then.
 // When the site publishes a newer one, offer it once per version (Android asks before installing).
 async function offerUpdate(mine){
  try{const info=await (await fetch('downloads/click-studio-android.json',{cache:'no-store'})).json(),latest=String(info.version||'');
   const newer=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0);}return false;};
   if(!latest||!mine||!newer(latest,mine))return;try{if(localStorage.getItem('click-android-update-seen')===latest)return;}catch{}
   // The WebView has no download manager, so the app saves the APK itself; Android installs it from Files.
   const d=document,bar=d.createElement('div'),msg=d.createElement('span'),go=d.createElement('button'),x=d.createElement('button'),file='click-studio-v'+latest+'.apk';
   bar.setAttribute('role','status');bar.style.cssText='position:fixed;left:12px;bottom:12px;z-index:60;display:flex;gap:10px;align-items:center;max-width:calc(100vw - 24px);padding:10px 12px 10px 16px;background:#172846;color:#fff;border-radius:14px;box-shadow:0 6px 20px #0004;font:600 14px/1.4 system-ui,sans-serif';
   msg.textContent='📱 새 태블릿 앱 v'+latest+'이 나왔어요 (지금 v'+mine+')';go.type='button';go.textContent='업데이트 받기';go.style.cssText='background:#ff525f;color:#fff;border:0;padding:6px 12px;border-radius:10px;font:inherit;cursor:pointer';
   x.type='button';x.textContent='×';x.setAttribute('aria-label','닫기');x.style.cssText='background:none;border:0;color:#fff;font-size:18px;cursor:pointer';
   const close=()=>{bar.remove();try{localStorage.setItem('click-android-update-seen',latest);}catch{}};x.onclick=close;
   go.onclick=async()=>{go.disabled=true;go.textContent='받는 중…';
    try{const r=await fetch('downloads/'+(info.file||'click-studio.apk'),{cache:'no-store'});if(!r.ok)throw Error(String(r.status));
     const where=await root.ClickAndroid.save(new Blob([await r.arrayBuffer()],{type:'application/vnd.android.package-archive'}),file);
     msg.textContent='✅ '+where+'에 저장했어요. 파일 앱에서 열어 설치하세요.';go.remove();try{localStorage.setItem('click-android-update-seen',latest);}catch{}}
    catch{go.disabled=false;go.textContent='다시 받기';msg.textContent='앱을 받지 못했어요. Wi-Fi를 확인하고 다시 눌러 주세요.';}};
   bar.append(msg,go,x);d.body.append(bar);
  }catch{}
 }
})(globalThis);
