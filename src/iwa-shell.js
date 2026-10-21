// Installed-app shell: shows the latest Click Studio from the website and lends it printer connections.
// Sockets are limited to the A1 mini's LAN protocol (private IPv4; MQTT 8883, FTPS 990 + its passive data port,
// SSDP 2021/1990). Offline or unreachable → the copy bundled in this app opens instead.
(function(){
 const VERSION=/* SHELL_VERSION */'',REMOTE=/* SHELL_REMOTE */'',ALLOW_LOOPBACK=/* SHELL_ALLOW_LOOPBACK */false,PROTOCOL=1;
 const PAGES={studio:['studio.html','/studio.html'],booth:['index.html','/booth.html']},KEY=/^click-[a-z0-9-]{1,60}$/;
 const params=new URLSearchParams(location.search),page=PAGES[params.get('page')]?params.get('page'):'studio',hash=location.hash;
 const fallback=why=>{try{sessionStorage.setItem('click-shell-fallback',why);}catch{}location.replace(PAGES[page][1]+hash);};
 if(!navigator.onLine)return fallback('offline');
 const ip4=ip=>{const p=String(ip).split('.');return p.length===4&&p.every(x=>/^\d{1,3}$/.test(x)&&+x<=255);};
 const privateIPv4=ip=>ip4(ip)&&(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)||ALLOW_LOOPBACK&&/^127\./.test(ip));
 const sockets=new Map(),ftpsHosts=new Map();let nextSid=1,ready=false;
 function allowTcp(host,port){if(!privateIPv4(host)||!Number.isInteger(port))return false;if([8883,990,6000].includes(port))return true;return port>=1024&&port<=65535&&(ftpsHosts.get(host)||0)>0;}
 function allowUdp(o){if(o.localAddress!==undefined)return o.localAddress==='0.0.0.0'&&(o.localPort===2021||o.localPort===1990)&&o.remoteAddress===undefined;return privateIPv4(o.remoteAddress)&&[9,2021,1990].includes(o.remotePort);}
 async function handle(m,reply){
  if(m.op==='hello'){ready=true;document.title=document.title.replace(/^…\s*/,'');return;}
  if(m.op==='storage'){if(m.action==='set'&&KEY.test(m.key)&&typeof m.value==='string'&&m.value.length<5e6)localStorage.setItem(m.key,m.value);else if(m.action==='remove'&&KEY.test(m.key))localStorage.removeItem(m.key);else if(m.action==='clear')for(const k of Object.keys(localStorage))if(KEY.test(k))localStorage.removeItem(k);return;}
  if(m.op==='tcp'){if(!allowTcp(m.host,m.port))return reply({ok:false,name:'NotAllowedError',error:'이 주소·포트는 프린터 연결에 쓰지 않습니다.'});
   const s=new TCPSocket(m.host,m.port,{noDelay:!!m.options?.noDelay,...(m.options?.keepAliveDelay?{keepAliveDelay:m.options.keepAliveDelay}:{})}),o=await s.opened,sid=nextSid++;
   sockets.set(sid,{s,host:m.host,port:m.port});if(m.port===990)ftpsHosts.set(m.host,(ftpsHosts.get(m.host)||0)+1);
   s.closed.then(()=>release(sid),()=>release(sid));
   return reply({ok:true,sid,info:{localAddress:o.localAddress,localPort:o.localPort,remoteAddress:o.remoteAddress,remotePort:o.remotePort},readable:o.readable,writable:o.writable},[o.readable,o.writable]);}
  if(m.op==='udp'){const o=m.options||{};if(!allowUdp(o))return reply({ok:false,name:'NotAllowedError',error:'이 UDP 사용은 프린터 검색에 쓰지 않습니다.'});
   const s=new UDPSocket(o),info=await s.opened,sid=nextSid++;sockets.set(sid,{s,info});s.closed.then(()=>release(sid),()=>release(sid));
   return reply({ok:true,sid,multicast:!!info.multicastController,info:{localAddress:info.localAddress,localPort:info.localPort,remoteAddress:info.remoteAddress,remotePort:info.remotePort},readable:info.readable,writable:info.writable},[info.readable,info.writable]);}
  if(m.op==='udp-join'||m.op==='udp-leave'){const e=sockets.get(m.sid);if(!e?.info?.multicastController||m.group!=='239.255.255.250')return reply({ok:false,error:'멀티캐스트 그룹을 사용할 수 없습니다.'});await e.info.multicastController[m.op==='udp-join'?'joinGroup':'leaveGroup'](m.group);return reply({ok:true});}
  if(m.op==='close'){const e=sockets.get(m.sid);if(e)try{await e.s.close();}catch{}release(m.sid);return reply({ok:true});}
  reply({ok:false,error:'지원하지 않는 요청입니다.'});
 }
 function release(sid){const e=sockets.get(sid);if(!e)return;sockets.delete(sid);if(e.port===990)ftpsHosts.set(e.host,Math.max(0,(ftpsHosts.get(e.host)||1)-1));}
 const storage={};for(const k of Object.keys(localStorage))if(KEY.test(k))storage[k]=localStorage.getItem(k);
 const frame=document.createElement('iframe');frame.setAttribute('credentialless','');frame.title='Click Studio';
 frame.name=JSON.stringify({clickShell:PROTOCOL,storage});frame.src=REMOTE+PAGES[page][0]+'?click-shell=1'+hash;
 const timer=setTimeout(()=>{if(!ready)fallback('timeout');},15000);
 // Each page load inside the frame gets a fresh channel; connections from the previous page are closed.
 frame.addEventListener('load',()=>{for(const sid of [...sockets.keys()]){try{sockets.get(sid).s.close();}catch{}release(sid);}const channel=new MessageChannel();
  channel.port1.onmessage=e=>{const m=e.data||{},reply=(r,t=[])=>{if(m.id)channel.port1.postMessage({...r,id:m.id},t);};handle(m,reply).catch(err=>reply({ok:false,name:err?.name||'NetworkError',error:err?.name==='NotAllowedError'||err?.name==='InvalidAccessError'?'크롬북이 로컬 네트워크 연결을 허용하지 않았습니다. 앱 권한을 확인하세요.':'이 주소의 프린터에 연결하지 못했습니다.'}));};
  try{frame.contentWindow.postMessage({type:'click-shell-port',protocol:PROTOCOL,shellVersion:VERSION},new URL(REMOTE).origin,[channel.port2]);}catch{}
  setTimeout(()=>{if(!ready){clearTimeout(timer);fallback('no-handshake');}},6000);
 });
 document.body.append(frame);
})();
