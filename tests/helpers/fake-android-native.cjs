// Test-only stand-in for the Android app's native socket bridge (android/app/src/main/java/.../SocketBridge.java):
// the same JSON messages and the same address/port rules, backed by node:net and node:dgram.
const net=require('node:net'),dgram=require('node:dgram'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const GROUP='239.255.255.250';
function createNative(deliver,{allowLoopback=false}={}){
 const sockets=new Map(),ftps=new Map();let nextSid=1;
 const ip4=ip=>{const p=String(ip).split('.');return p.length===4&&p.every(x=>/^\d{1,3}$/.test(x)&&+x<=255);};
 const privateIPv4=ip=>ip4(ip)&&(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)||allowLoopback&&/^127\./.test(ip));
 const allowTcp=(host,port)=>privateIPv4(host)&&Number.isInteger(port)&&([8883,990,6000].includes(port)||port>=1024&&port<=65535&&(ftps.get(host)||0)>0);
 const b64=b=>Buffer.from(b).toString('base64');
 const send=o=>deliver(JSON.stringify(o));
 function release(sid){const e=sockets.get(sid);if(!e)return;sockets.delete(sid);if(e.port===990)ftps.set(e.host,Math.max(0,(ftps.get(e.host)||1)-1));}
 function handle(text){
  let m;try{m=JSON.parse(text);}catch{return;}const reply=o=>send({...o,id:m.id}),no=(error,name='NotAllowedError')=>reply({ok:false,name,error});
  // A new page says hello before opening anything; connections left by the previous page close.
  if(m.op==='hello'){closeAll();return reply({ok:true,version:'test'});}
  if(m.op==='tcp'){
   if(!allowTcp(m.host,m.port))return no('이 주소·포트는 프린터 연결에 쓰지 않습니다.');
   const s=net.connect({host:m.host,port:m.port,noDelay:!!m.noDelay}),sid=nextSid++;let open=false;
   s.setTimeout(10000,()=>{if(!open)s.destroy(Error('timeout'));});
   s.once('connect',()=>{open=true;s.setTimeout(0);sockets.set(sid,{kind:'tcp',s,host:m.host,port:m.port});if(m.port===990)ftps.set(m.host,(ftps.get(m.host)||0)+1);
    reply({ok:true,sid,info:{localAddress:s.localAddress,localPort:s.localPort,remoteAddress:s.remoteAddress,remotePort:s.remotePort}});});
   s.on('data',b=>send({ev:'data',sid,data:b64(b)}));
   s.on('end',()=>send({ev:'end',sid}));
   s.on('error',e=>{if(!open)return no('이 주소의 프린터에 연결하지 못했습니다.','NetworkError');send({ev:'error',sid,message:e.message});});
   s.on('close',()=>release(sid));return;
  }
  const e=sockets.get(m.sid);
  if(m.op==='write'){if(e?.kind!=='tcp')return no('연결이 닫혔습니다.','NetworkError');return e.s.write(Buffer.from(m.data||'','base64'),err=>err?no(err.message,'NetworkError'):reply({ok:true}));}
  if(m.op==='shutdown'){if(e?.kind==='tcp')e.s.end();return reply({ok:true});}
  if(m.op==='close'){if(e){if(e.kind==='tcp')e.s.end(()=>e.s.destroy());else try{e.s.close();}catch{}release(m.sid);}return reply({ok:true});}
  if(m.op==='udp'){
   const o=m.options||{},sid=nextSid++;
   if(o.localPort!==undefined){if(o.localAddress!=='0.0.0.0'||![2021,1990].includes(o.localPort))return no('이 UDP 사용은 프린터 검색에 쓰지 않습니다.');
    const s=dgram.createSocket({type:'udp4',reuseAddr:true});s.on('message',(b,r)=>send({ev:'udp',sid,data:b64(b),host:r.address,port:r.port}));s.on('error',()=>{});
    s.bind(o.localPort,()=>{sockets.set(sid,{kind:'udp',s});reply({ok:true,sid,multicast:true,info:{localAddress:'0.0.0.0',localPort:o.localPort}});});return;}
   if(!privateIPv4(o.remoteAddress)||![9,2021,1990].includes(o.remotePort))return no('이 UDP 사용은 프린터 검색에 쓰지 않습니다.');
   const s=dgram.createSocket('udp4');s.on('error',()=>{});
   s.connect(o.remotePort,o.remoteAddress,err=>{if(err)return no('네트워크 주소를 확인하지 못했습니다.','NetworkError');const a=s.address();sockets.set(sid,{kind:'udp',s});reply({ok:true,sid,multicast:false,info:{localAddress:a.address,localPort:a.port,remoteAddress:o.remoteAddress,remotePort:o.remotePort}});});return;
  }
  if(m.op==='send'){if(e?.kind!=='udp'||!(m.host===GROUP||privateIPv4(m.host))||![2021,1990].includes(m.port))return no('이 UDP 사용은 프린터 검색에 쓰지 않습니다.');e.s.send(Buffer.from(m.data||'','base64'),m.port,m.host,()=>reply({ok:true}));return;}
  if(m.op==='join'||m.op==='leave'){if(e?.kind!=='udp'||m.group!==GROUP)return no('멀티캐스트 그룹을 사용할 수 없습니다.');try{e.s[m.op==='join'?'addMembership':'dropMembership'](GROUP);}catch{}return reply({ok:true});}
  if(m.op==='save'){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-save-')),file=path.join(dir,path.basename(String(m.name||'file')));fs.writeFileSync(file,Buffer.from(m.data||'','base64'));return reply({ok:true,path:file});}
  reply({ok:false,error:'지원하지 않는 요청입니다.'});
 }
 function closeAll(){for(const [sid,e] of sockets){try{e.kind==='tcp'?e.s.destroy():e.s.close();}catch{}release(sid);}}
 return {handle,closeAll};
}
module.exports={createNative};
