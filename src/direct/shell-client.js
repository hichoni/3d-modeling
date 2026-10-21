// Auto-updating Chromebook app: the installed app (a thin shell) shows this public page in an iframe and lends it
// Direct Sockets and persistent storage over a MessagePort. The page then always runs the latest deployed code.
// Inert unless loaded by the shell (?click-shell=1 inside the Click Studio app's own origin).
(function(root){
 if(root.parent===root||!new URLSearchParams(root.location.search).has('click-shell'))return;
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
  port=e.ports[0];shell.version=String(e.data.shellVersion||'');
  port.onmessage=ev=>{const m=ev.data,w=waiting.get(m?.id);if(!w)return;waiting.delete(m.id);if(m.ok)w.resolve(m);else{const err=Error(m.error||'연결하지 못했습니다.');err.name=m.name||'NetworkError';w.reject(err);}};
  port.postMessage({op:'hello',id:0,page:root.location.pathname});for(const [m,t] of queue.splice(0))port.postMessage(m,t);
 });
 // Every app setting lives in localStorage; mirror writes to the shell, which keeps them in the app's own storage.
 const proto=Storage.prototype,setItem=proto.setItem,removeItem=proto.removeItem,clear=proto.clear;
 proto.setItem=function(k,v){setItem.call(this,k,v);if(this===root.localStorage&&KEY.test(String(k)))send({op:'storage',action:'set',key:String(k),value:String(v)});};
 proto.removeItem=function(k){removeItem.call(this,k);if(this===root.localStorage&&KEY.test(String(k)))send({op:'storage',action:'remove',key:String(k)});};
 proto.clear=function(){clear.call(this);if(this===root.localStorage)send({op:'storage',action:'clear'});};
 // Same contract as the Direct Sockets API: the shell opens the socket and transfers its streams here.
 class TCPSocket{
  constructor(host,port,options={}){const r=request({op:'tcp',host:String(host),port:Number(port),options:{noDelay:!!options.noDelay,keepAliveDelay:options.keepAliveDelay}});
   this.opened=r.then(m=>{this.sid=m.sid;return {readable:m.readable,writable:m.writable,...m.info};});this.opened.catch(()=>{});this.closed=new Promise(()=>{});}
  close(){return this.opened.then(()=>request({op:'close',sid:this.sid}),()=>{}).then(()=>{},()=>{});}
 }
 class UDPSocket{
  constructor(options={}){const pick=['localAddress','localPort','remoteAddress','remotePort','multicastAllowAddressSharing'],o={};for(const k of pick)if(options[k]!==undefined)o[k]=options[k];
   this.opened=request({op:'udp',options:o}).then(m=>{this.sid=m.sid;const sid=m.sid;return {readable:m.readable,writable:m.writable,...m.info,multicastController:m.multicast?{joinedGroups:[],joinGroup:g=>request({op:'udp-join',sid,group:String(g)}).then(()=>{}),leaveGroup:g=>request({op:'udp-leave',sid,group:String(g)}).then(()=>{})}:undefined};});
   this.opened.catch(()=>{});this.closed=new Promise(()=>{});}
  close(){return this.opened.then(()=>request({op:'close',sid:this.sid}),()=>{}).then(()=>{},()=>{});}
 }
 root.TCPSocket=TCPSocket;root.UDPSocket=UDPSocket;
 // Studio ↔ keycap booth links stay inside the shell.
 root.addEventListener('click',e=>{const a=e.target?.closest?.('a[href]');if(!a||a.target==='_blank'||a.hasAttribute('download'))return;let u;try{u=new URL(a.href,root.location.href);}catch{return;}
  if(u.origin!==root.location.origin||!/\/(?:(?:index|studio)\.html)?$/.test(u.pathname)||u.searchParams.has('click-shell'))return;u.searchParams.set('click-shell','1');a.href=u.href;},true);
})(globalThis);
