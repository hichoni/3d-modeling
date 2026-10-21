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
 request({op:'hello',page:root.location.pathname}).then(m=>{root.ClickAndroid.version=String(m.version||'');},()=>{});
})(globalThis);
