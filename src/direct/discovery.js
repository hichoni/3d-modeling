// Find A1 minis on the Chromebook's Wi-Fi without a relay.
// 1) SSDP: the printer announces itself (NOTIFY to UDP 2021, ~every 5 s), as Bambu Studio listens for.
// 2) Fallback when the Wi-Fi drops broadcasts: TLS-probe port 8883 and read the serial from the Bambu-signed certificate.
(function(root){
const dec=new TextDecoder(),enc=new TextEncoder();
const QUERY=enc.encode('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1990\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:bambulab-com:device:3dprinter:1\r\n\r\n');
const MODELS={N1:'A1 mini',N2S:'A1',C11:'P1P',C12:'P1S',BL:'X1C','3DPrinter-X1-Carbon':'X1C'};
function privateIPv4(ip){const p=String(ip).split('.');return p.length===4&&p.every(x=>/^\d{1,3}$/.test(x)&&+x<=255)&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);}
function parseNotify(text,remote){
 if(text.length>8192)return null;const h={};for(const line of text.split(/\r?\n/)){const i=line.indexOf(':');if(i>0)h[line.slice(0,i).trim().toLowerCase()]=line.slice(i+1).trim();}
 const serial=h.usn||'',ip=api.privateIPv4(h.location)?h.location:remote,model=h['devmodel.bambu.com']||'';
 if(!/^[A-Za-z0-9]{6,40}$/.test(serial)||!api.privateIPv4(ip)||!model)return null;
 return {ip,serial,model:MODELS[model]||model,supported:model==='N1',name:String(h['devname.bambu.com']||'').replace(/[\x00-\x1f]/g,'').slice(0,40),lanOnly:h['devconnect.bambu.com']==='lan',bound:h['devbind.bambu.com']==='occupied',firmware:h['devversion.bambu.com']||'',source:'ssdp'};
}
async function listen({timeoutMs=6000,signal}={}){
 const found=new Map(),sockets=[];
 const open=async port=>{try{const s=new root.UDPSocket({localAddress:'0.0.0.0',localPort:port,multicastAllowAddressSharing:true});const info=await s.opened;sockets.push({s,info});
   try{await info.multicastController?.joinGroup('239.255.255.250');}catch{}
   const reader=info.readable.getReader();
   (async()=>{try{for(;;){const {value,done}=await reader.read();if(done)break;const p=parseNotify(dec.decode(value.data),value.remoteAddress);if(p&&found.size<32)found.set(p.serial,p);}}catch{}})();
   if(port===2021){const w=info.writable.getWriter();try{await w.write({data:QUERY,remoteAddress:'239.255.255.250',remotePort:1990});await w.write({data:QUERY,remoteAddress:'239.255.255.250',remotePort:2021});}catch{}w.releaseLock();}
  }catch{}};
 await Promise.all([open(2021),open(1990)]);
 if(!sockets.length){const e=Error('이 크롬북에서 프린터 자동 검색을 열지 못했습니다. IP 주소로 찾기를 사용하세요.');e.code='DISCOVERY_UNAVAILABLE';throw e;}
 await new Promise(resolve=>{const t=setTimeout(resolve,timeoutMs);signal?.addEventListener('abort',()=>{clearTimeout(t);resolve();});});
 for(const {s} of sockets)try{await s.close();}catch{}
 return [...found.values()].sort((a,b)=>a.serial.localeCompare(b.serial));
}
// Reads the serial from the printer's certificate after verifying it chains to the Bambu CA. No login, no command.
async function probe(ip,{ca,timeout=4000}={}){
 if(!api.privateIPv4(ip)){const e=Error('같은 Wi-Fi의 사설 IP 주소(예: 192.168.0.23)를 입력하세요.');e.code='BAD_IP';throw e;}
 const transport=await root.DirectSockets.openTcp(ip,8883,{timeout});let timer;
 try{const conn=await Promise.race([root.DirectTLS.connect(transport,{ca:root.DirectTLS.parsePem(ca)}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('프린터의 보안 연결 응답이 없습니다.')),timeout);})]);
  const serial=conn.peerCertificate.subjectNames['2.5.4.3']||'';await conn.close();
  if(!/^[A-Za-z0-9]{6,40}$/.test(serial))throw Error('Bambu Lab 프린터 일련번호를 읽지 못했습니다.');
  return {ip,serial,model:serial.startsWith('030')?'A1 mini':'Bambu Lab',supported:serial.startsWith('030'),lanOnly:true,source:'probe'};
 }finally{clearTimeout(timer);try{await transport.close();}catch{}}
}
// The Chromebook's own Wi-Fi address, from a connected UDP socket (no packet is sent).
async function localAddress(){try{const s=new root.UDPSocket({remoteAddress:'192.168.0.1',remotePort:9}),info=await s.opened,ip=info.localAddress;await s.close();return api.privateIPv4(ip)?ip:null;}catch{return null;}}
async function scan({ca,onProgress=()=>{},signal}={}){
 const me=await localAddress();if(!me){const e=Error('크롬북의 Wi-Fi 주소를 확인하지 못했습니다. 프린터 IP를 직접 입력하세요.');e.code='NO_LOCAL_ADDRESS';throw e;}
 const prefix=me.split('.').slice(0,3).join('.'),hosts=Array.from({length:254},(_,i)=>prefix+'.'+(i+1)).filter(ip=>ip!==me),found=[];let done=0;
 const worker=async()=>{while(hosts.length&&!signal?.aborted){const ip=hosts.shift();try{found.push(await probe(ip,{ca,timeout:1500}));}catch{}onProgress(++done/254);}};
 await Promise.all(Array.from({length:24},worker));return found.sort((a,b)=>a.ip.localeCompare(b.ip,undefined,{numeric:true}));
}
const api={listen,probe,scan,parseNotify,privateIPv4,localAddress};root.DirectDiscovery=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
