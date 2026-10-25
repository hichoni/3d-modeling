// Auto-updating Chromebook app: the installed app (a thin shell) shows this public page in an iframe and lends it
// Direct Sockets and persistent storage over a MessagePort. The page then always runs the latest deployed code.
// Inert unless loaded by the shell (?click-shell=1 inside the Click Studio app's own origin). Links followed inside the
// app's frame (launcher, studio, booth) drop the query, so the frame's session remembers it; only the app's own origin
// can still hand over the port below.
(function(root){
 let remembered=false;try{remembered=root.sessionStorage.getItem('click-shell')==='1';}catch{}
 if(root.parent===root||!(new URLSearchParams(root.location.search).has('click-shell')||remembered))return;
 try{root.sessionStorage.setItem('click-shell','1');}catch{}
 const ORIGINS=root.CLICK_SHELL_ORIGINS||[],PROTOCOL=1,KEY=/^click-[a-z0-9-]{1,60}$/;
 // The shell passes saved settings through the frame name so they exist before any app script reads them.
 let boot={};try{boot=JSON.parse(root.name||'{}');}catch{}root.name='';
 if(boot.clickShell===PROTOCOL&&boot.storage&&typeof boot.storage==='object')for(const [k,v] of Object.entries(boot.storage))if(KEY.test(k)&&typeof v==='string')try{localStorage.setItem(k,v);}catch{}
 let port=null,next=1;const queue=[],waiting=new Map();
 const send=(message,transfer=[])=>{if(port)port.postMessage(message,transfer);else queue.push([message,transfer]);};
 const request=message=>new Promise((resolve,reject)=>{const id=next++;waiting.set(id,{resolve,reject});send({...message,id});});
 const shell={active:true,version:null,protocol:PROTOCOL};root.ClickShell=shell;
 root.addEventListener('message',e=>{
  if(port||e.source!==root.parent||!ORIGINS.includes(e.origin)||e.data?.type!=='click-shell-port'||e.data.protocol!==PROTOCOL||!e.ports[0])return;
  port=e.ports[0];shell.version=String(e.data.shellVersion||'');shell.origin=e.origin;
  port.onmessage=ev=>{const m=ev.data,w=waiting.get(m?.id);if(!w)return;waiting.delete(m.id);if(m.ok)w.resolve(m);else{const err=Error(m.error||'연결하지 못했습니다.');err.name=m.name||'NetworkError';w.reject(err);}};
  port.postMessage({op:'hello',id:0,page:root.location.pathname});for(const [m,t] of queue.splice(0))port.postMessage(m,t);
 });
 // The app cannot close a page's printer connections once it has handed their streams over, so each page swap inside
 // its frame (launcher, booth, studio links; reloads) left one open, until the printer ran out of LAN connections.
 // The page relays every socket through its own pipes and cuts them before it goes; that closes them in the app too.
 const live=new Set();
 function relay(m){const stop=new AbortController(),down=new TransformStream(),up=new TransformStream(),entry={stop,sid:m.sid};
  m.readable.pipeTo(down.writable,{signal:stop.signal}).catch(()=>{});up.readable.pipeTo(m.writable,{signal:stop.signal}).catch(()=>{});
  live.add(entry);return {readable:down.readable,writable:up.writable,entry};}
 function cutAll(){for(const e of live){e.stop.abort();send({op:'close',sid:e.sid,id:0});}live.clear();}
 shell.cutAll=cutAll;root.addEventListener('pagehide',cutAll);
 root.document.addEventListener('click',e=>{
  if(!port||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest?.('a[href]');if(!a||a.target&&a.target!=='_self'||a.getAttribute('href').startsWith('#')||a.hasAttribute('download'))return;
  let url;try{url=new URL(a.getAttribute('href'),root.location.href);}catch{return;}if(url.origin!==root.location.origin||!live.size)return;
  e.preventDefault();cutAll();setTimeout(()=>{root.location.href=url.href;},300);
 },true);
 // Every app setting lives in localStorage; mirror writes to the shell, which keeps them in the app's own storage.
 const proto=Storage.prototype,setItem=proto.setItem,removeItem=proto.removeItem,clear=proto.clear;
 proto.setItem=function(k,v){setItem.call(this,k,v);if(this===root.localStorage&&KEY.test(String(k)))send({op:'storage',action:'set',key:String(k),value:String(v)});};
 proto.removeItem=function(k){removeItem.call(this,k);if(this===root.localStorage&&KEY.test(String(k)))send({op:'storage',action:'remove',key:String(k)});};
 proto.clear=function(){clear.call(this);if(this===root.localStorage)send({op:'storage',action:'clear'});};
 // Same contract as the Direct Sockets API: the shell opens the socket and transfers its streams here.
 class TCPSocket{
  constructor(host,port,options={}){const r=request({op:'tcp',host:String(host),port:Number(port),options:{noDelay:!!options.noDelay,keepAliveDelay:options.keepAliveDelay}});
   this.opened=r.then(m=>{this.sid=m.sid;const x=relay(m);this.entry=x.entry;return {readable:x.readable,writable:x.writable,...m.info};});this.opened.catch(()=>{});this.closed=new Promise(()=>{});}
  close(){return this.opened.then(()=>{this.entry&&live.delete(this.entry);return request({op:'close',sid:this.sid});},()=>{}).then(()=>{},()=>{});}
 }
 class UDPSocket{
  constructor(options={}){const pick=['localAddress','localPort','remoteAddress','remotePort','multicastAllowAddressSharing'],o={};for(const k of pick)if(options[k]!==undefined)o[k]=options[k];
   this.opened=request({op:'udp',options:o}).then(m=>{this.sid=m.sid;const sid=m.sid,x=relay(m);this.entry=x.entry;return {readable:x.readable,writable:x.writable,...m.info,multicastController:m.multicast?{joinedGroups:[],joinGroup:g=>request({op:'udp-join',sid,group:String(g)}).then(()=>{}),leaveGroup:g=>request({op:'udp-leave',sid,group:String(g)}).then(()=>{})}:undefined};});
   this.opened.catch(()=>{});this.closed=new Promise(()=>{});}
  close(){return this.opened.then(()=>{this.entry&&live.delete(this.entry);return request({op:'close',sid:this.sid});},()=>{}).then(()=>{},()=>{});}
 }
 root.TCPSocket=TCPSocket;root.UDPSocket=UDPSocket;
 // Studio ↔ keycap booth links stay inside the shell.
 root.addEventListener('click',e=>{const a=e.target?.closest?.('a[href]');if(!a||a.target==='_blank'||a.hasAttribute('download'))return;let u;try{u=new URL(a.href,root.location.href);}catch{return;}
  if(u.origin!==root.location.origin||!/\/(?:(?:index|studio)\.html)?$/.test(u.pathname)||u.searchParams.has('click-shell'))return;u.searchParams.set('click-shell','1');a.href=u.href;},true);
})(globalThis);
