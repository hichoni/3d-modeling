// A1 mini LAN protocol in the browser: MQTT 3.1.1 (8883) for status/commands and implicit FTPS (990) for files.
// Same wire behavior as bridge/transport.cjs, carried over DirectSockets + DirectTLS instead of Node tls.
(function(root){
const enc=new TextEncoder(),dec=new TextDecoder();
const Sockets=()=>root.DirectSockets,TLS=()=>root.DirectTLS;
function linkError(code,message){const e=Error(message);e.code=code;return e;}
const u16=n=>Uint8Array.of(n>>8&255,n&255);
function concat(...parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
const utf=s=>{const b=enc.encode(s);return concat(u16(b.length),b);};
function frame(header,data=new Uint8Array(0)){let n=data.length;const length=[];do{let b=n%128;n=Math.floor(n/128);length.push(b|(n?128:0));}while(n);return concat(Uint8Array.of(header,...length),data);}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
async function secure(device,port,{session,timeout=10000}={}){
 const transport=await Sockets().openTcp(device.ip,port,{timeout});let timer;
 try{return await Promise.race([TLS().connect(transport,{serverName:device.serial,ca:TLS().parsePem(device.ca),session}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(linkError('TLS_TIMEOUT','프린터의 보안 연결 응답이 없습니다.')),timeout);})]);}
 catch(e){try{await transport.close();}catch{}throw e;}finally{clearTimeout(timer);}
}
class Emitter{constructor(){this.handlers={};}on(name,fn){(this.handlers[name]||=[]).push(fn);return this;}emit(name,...args){for(const fn of this.handlers[name]||[])try{fn(...args);}catch(e){console.error(e);}}}

class Mqtt extends Emitter{
 constructor(device){super();this.device=device;this.nextId=1;this.online=false;this.lastReportAt=0;this.state={};this.info={};}
 connect(){return new Promise(async(resolve,reject)=>{
  let settled=false;const timer=setTimeout(()=>fail(linkError('MQTT_TIMEOUT','프린터 상태 연결 시간이 초과됐습니다.')),12000);
  const fail=e=>{clearTimeout(timer);if(!settled){settled=true;reject(e);}const was=this.online;this.close();if(was)this.emit('fault',e.code||e.message);};
  try{this.conn=await secure(this.device,this.device.mqttPort||8883);}catch(e){return fail(e);}
  await this.conn.write(frame(0x10,concat(utf('MQTT'),Uint8Array.of(4,0xc2,0,30),utf('click-'+hex(crypto.getRandomValues(new Uint8Array(8)))),utf('bblp'),utf(this.device.password)))).catch(fail);
  let incoming=new Uint8Array(0);
  (async()=>{try{for(;;){const chunk=await this.conn.read();if(!chunk)throw linkError('MQTT_CLOSED','프린터 상태 연결이 끊겼습니다.');incoming=concat(incoming,chunk);if(incoming.length>4*1024*1024)throw linkError('MQTT_SIZE','프린터 응답이 너무 큽니다.');
   while(incoming.length>=2){
    let n=0,m=1,i=1,b;do{if(i>=incoming.length)break;b=incoming[i++];n+=(b&127)*m;m*=128;if(i>5)throw linkError('MQTT_FRAME','프린터 응답 형식이 올바르지 않습니다.');}while(b&128);
    if(b&128||incoming.length<i+n)break;const header=incoming[0],body=incoming.subarray(i,i+n);incoming=incoming.slice(i+n);
    if(header>>4===2){if(body[1]!==0)throw linkError('MQTT_AUTH_'+body[1],body[1]===4||body[1]===5?'액세스 코드 인증이 거절됐습니다. 프린터 화면의 8자리 코드를 다시 확인하세요.':'프린터가 연결을 거절했습니다. ('+body[1]+')');
     await this.conn.write(frame(0x82,concat(u16(1),utf('device/'+this.device.serial+'/report'),Uint8Array.of(0))));}
    else if(header>>4===9){if(body[2]===128)throw linkError('MQTT_SUBSCRIBE','프린터 상태 구독이 거절됐습니다.');this.online=true;clearTimeout(timer);settled=true;this.nextId=2;this.ping=setInterval(()=>{if(this.online)this.conn.write(frame(0xc0)).catch(()=>{});},10000);resolve();}
    else if(header>>4===3){if(body.length<2)continue;let offset=2+(body[0]<<8|body[1]);if(header&6){await this.conn.write(frame(0x40,body.subarray(offset,offset+2)));offset+=2;}
     try{const report=JSON.parse(dec.decode(body.subarray(offset)));this.lastReportAt=Date.now();if(report.print)Object.assign(this.state,report.print);if(report.info)this.info=report.info;this.emit('report',report);}catch{}}
   }}}catch(e){fail(e);}})();
 });}
 publish(payload){
  if(!this.online)throw linkError('MQTT_OFFLINE','프린터와 연결되지 않았습니다.');
  const id=this.nextId++;if(this.nextId>65535)this.nextId=2;
  return this.conn.write(frame(0x32,concat(utf('device/'+this.device.serial+'/request'),u16(id),enc.encode(JSON.stringify(payload)))));
 }
 refresh(){return this.publish({pushing:{sequence_id:String(this.nextId),command:'pushall'}});}
 close(){clearInterval(this.ping);const was=this.online;this.online=false;if(this.conn){const c=this.conn;this.conn=null;(was?c.write(frame(0xe0)).catch(()=>{}):Promise.resolve()).finally(()=>c.close());}}
}

class Ftps{
 constructor(device){this.device=device;this.replies=[];this.waiters=[];this.error=null;this.pending='';}
 async connect(){
  this.control=await secure(this.device,this.device.ftpsPort||990);
  (async()=>{try{for(;;){const b=await this.control.read();if(!b)throw linkError('FTPS_CLOSED','파일 전송 연결이 닫혔습니다.');this.lines(dec.decode(b));}}catch(e){this.fail(e);}})();
  this.expect(await this.read(),220);
  const user=await this.command('USER bblp');if(user.code===331)this.expect(await this.command('PASS '+this.device.password),230);else this.expect(user,230);
  this.expect(await this.command('TYPE I'),200);this.expect(await this.command('PBSZ 0'),200);this.expect(await this.command('PROT P'),200);
 }
 lines(text){this.pending+=text;if(this.pending.length>65536)return this.fail(linkError('FTPS_SIZE','파일 전송 응답이 너무 큽니다.'));let i;
  while((i=this.pending.indexOf('\n'))>=0){const line=this.pending.slice(0,i).trim();this.pending=this.pending.slice(i+1);const m=/^(\d{3})([- ]|$)/.exec(line);if(!m)continue;
   if(m[2]==='-'){this.multi=m[1];continue;}if(this.multi&&this.multi!==m[1])continue;this.multi=null;
   const reply={code:Number(m[1]),text:line},w=this.waiters.shift();if(w)w.resolve(reply);else this.replies.push(reply);}
 }
 fail(e){if(this.error)return;this.error=e;for(const w of this.waiters.splice(0))w.reject(e);}
 read(timeout=15000){if(this.replies.length)return Promise.resolve(this.replies.shift());if(this.error)return Promise.reject(this.error);return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{this.waiters=this.waiters.filter(x=>x!==waiter);reject(linkError('FTPS_TIMEOUT','파일 전송 응답 시간이 초과됐습니다.'));},timeout);
  const waiter={resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}};this.waiters.push(waiter);});}
 async command(s){await this.control.write(enc.encode(s+'\r\n'));return this.read();}
 expect(r,code){if(r.code!==code)throw linkError('FTPS_'+r.code,'프린터 파일 전송이 거절됐습니다. SD 카드를 확인하세요. ('+r.code+')');return r;}
 async upload(name,data,onProgress=()=>{}){
  if(!/^[a-z0-9_-]+\.3mf$/.test(name))throw linkError('FTPS_NAME','파일 이름이 올바르지 않습니다.');
  const pasv=this.expect(await this.command('PASV'),227),m=/\((\d+,\d+,\d+,\d+),(\d+),(\d+)\)/.exec(pasv.text);if(!m)throw linkError('FTPS_PASV','프린터의 파일 전송 주소를 읽지 못했습니다.');
  const raw=await Sockets().openTcp(this.device.ip,Number(m[2])*256+Number(m[3]),{timeout:15000});let channel=null;
  try{
   this.expect(await this.command('STOR '+name),150);
   // The printer's FTPS server accepts a data channel only when it resumes the control channel's TLS session.
   channel=await TLS().connect(raw,{serverName:this.device.serial,ca:TLS().parsePem(this.device.ca),session:this.control.getSession()});
   const final=this.read(120000);final.catch(()=>{});
   for(let o=0;o<data.length;o+=65536){await channel.write(data.subarray(o,o+65536));onProgress(Math.min(1,(o+65536)/data.length));}
   await channel.close();channel=null;this.expect(await final,226);
   const size=this.expect(await this.command('SIZE '+name),213);if(Number(size.text.slice(3).trim())!==data.length)throw linkError('FTPS_SIZE_MISMATCH','업로드한 파일 크기가 다릅니다. 다시 시도하세요.');
   return {bytes:data.length,tlsVerified:true};
  }finally{if(channel)await channel.close();else await raw.close();}
 }
 async close(){if(!this.control)return;const c=this.control;this.control=null;try{await c.write(enc.encode('QUIT\r\n'));}catch{}await c.close();}
}
const api={Mqtt,Ftps,secure};root.DirectPrinterLink=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
