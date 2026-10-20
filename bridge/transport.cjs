const tls=require('node:tls');
const net=require('node:net');
const {EventEmitter}=require('node:events');
const {randomBytes}=require('node:crypto');
function u16(n){const b=Buffer.alloc(2);b.writeUInt16BE(n);return b;}
function utf(s){const b=Buffer.from(s);return Buffer.concat([u16(b.length),b]);}
function frame(header,data=Buffer.alloc(0)){let n=data.length;const length=[];do{let b=n%128;n=Math.floor(n/128);length.push(b|(n?128:0));}while(n);return Buffer.concat([Buffer.from([header,...length]),data]);}
function tlsOptions(device,port){return {host:device.ip,port,servername:device.serial,ca:device.ca,rejectUnauthorized:true,maxVersion:'TLSv1.2'};}
class Mqtt extends EventEmitter {
 constructor(device){super();this.device=device;this.nextId=1;this.online=false;this.lastReportAt=0;this.state={};}
 async connect(){
  return new Promise((resolve,reject)=>{
   let settled=false;const timer=setTimeout(()=>fail(new Error('MQTT connect timeout')),12000);
   const fail=e=>{if(!settled){settled=true;clearTimeout(timer);reject(e);}this.close();this.emit('fault',e.code||e.message);};
   this.socket=tls.connect(tlsOptions(this.device,8883));let incoming=Buffer.alloc(0);
   this.socket.on('error',fail);
   this.socket.on('close',()=>{this.online=false;clearInterval(this.ping);});
   this.socket.on('secureConnect',()=>this.socket.write(frame(0x10,Buffer.concat([utf('MQTT'),Buffer.from([4,0xc2,0,30]),utf('saegim-'+randomBytes(8).toString('hex')),utf('bblp'),utf(this.device.password)]))));
   this.socket.on('data',chunk=>{
    incoming=Buffer.concat([incoming,chunk]);if(incoming.length>2*1024*1024)return fail(new Error('MQTT packet too large'));
    while(incoming.length>=2){
     let n=0,m=1,i=1,b;do{if(i>=incoming.length)return;b=incoming[i++];n+=(b&127)*m;m*=128;if(i>5)return fail(new Error('Malformed MQTT length'));}while(b&128);
     if(incoming.length<i+n)return;const header=incoming[0],body=incoming.subarray(i,i+n);incoming=incoming.subarray(i+n);
     if(header>>4===2){
      if(body[1]!==0)return fail(new Error('MQTT authentication refused: '+body[1]));
      this.socket.write(frame(0x82,Buffer.concat([u16(1),utf('device/'+this.device.serial+'/report'),Buffer.from([0])])));
     }else if(header>>4===9){
      if(body[2]===128)return fail(new Error('MQTT subscription refused'));
      this.online=true;clearTimeout(timer);settled=true;this.nextId=2;
      this.ping=setInterval(()=>{if(this.online)this.socket.write(frame(0xc0));},10000);resolve();
     }else if(header>>4===3){
      if(body.length<2)continue;let offset=2+body.readUInt16BE(0);if((header&6)!==0){this.socket.write(frame(0x40,body.subarray(offset,offset+2)));offset+=2;}
      try{const report=JSON.parse(body.subarray(offset));this.lastReportAt=Date.now();if(report.print)Object.assign(this.state,report.print);this.emit('report',report);}catch{}
     }
    }
   });
  });
 }
 publish(payload){
  if(!this.online||this.socket.destroyed)throw Error('MQTT offline');
  const id=this.nextId++;if(this.nextId>65535)this.nextId=2;
  this.socket.write(frame(0x32,Buffer.concat([utf('device/'+this.device.serial+'/request'),u16(id),Buffer.from(JSON.stringify(payload))])));
 }
 refresh(){this.publish({pushing:{sequence_id:String(this.nextId),command:'pushall'}});}
 close(){clearInterval(this.ping);this.online=false;if(this.socket&&!this.socket.destroyed){this.socket.end(frame(0xe0));this.socket.destroy();}}
}
class Ftps {
 constructor(device){this.device=device;this.replies=[];this.waiters=[];this.error=null;}
 async connect(){
  this.socket=tls.connect(tlsOptions(this.device,990));let pending='',multi=null;
  this.socket.on('error',e=>this.fail(e));this.socket.on('close',()=>this.fail(new Error('FTPS closed')));
  this.socket.on('data',b=>{pending+=b.toString();if(pending.length>65536){this.fail(new Error('FTPS reply too large'));return;}
   let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i).trim();pending=pending.slice(i+1);const match=/^(\d{3})([- ]|$)/.exec(line);if(!match)continue;
    if(match[2]==='-'){multi=match[1];continue;}if(multi&&multi!==match[1])continue;multi=null;
    const reply={code:Number(match[1]),text:line};const waiter=this.waiters.shift();if(waiter)waiter.resolve(reply);else this.replies.push(reply);
   }
  });
  this.expect(await this.read(),220);
  const user=await this.command('USER bblp');if(user.code===331)this.expect(await this.command('PASS '+this.device.password),230);else this.expect(user,230);
  this.expect(await this.command('TYPE I'),200);this.expect(await this.command('PBSZ 0'),200);this.expect(await this.command('PROT P'),200);
 }
 fail(e){if(this.error)return;this.error=e;for(const w of this.waiters.splice(0))w.reject(e);}
 read(timeout=15000){if(this.replies.length)return Promise.resolve(this.replies.shift());if(this.error)return Promise.reject(this.error);return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{this.waiters=this.waiters.filter(x=>x!==waiter);reject(new Error('FTPS reply timeout'));},timeout);
  const waiter={resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}};this.waiters.push(waiter);
 });}
 command(s){this.socket.write(s+'\r\n');return this.read();}
 expect(r,code){if(r.code!==code)throw new Error('FTPS expected '+code+', got '+r.code);return r;}
 async upload(name,data){
  if(!/^[a-z0-9_-]+\.3mf$/.test(name))throw Error('Unsafe remote filename');
  const pasv=this.expect(await this.command('PASV'),227);const m=/\((\d+,\d+,\d+,\d+),(\d+),(\d+)\)/.exec(pasv.text);if(!m)throw Error('Invalid passive reply');
  const port=Number(m[2])*256+Number(m[3]);
  const raw=net.createConnection({host:this.device.ip,port});
  await new Promise((resolve,reject)=>{raw.once('connect',resolve);raw.once('error',reject);raw.setTimeout(15000,()=>raw.destroy(new Error('FTPS data connect timeout')));});
  try{
   this.expect(await this.command('STOR '+name),150);
   const dataTls=tls.connect({...tlsOptions(this.device,port),socket:raw,session:this.socket.getSession()});
   await new Promise((resolve,reject)=>{dataTls.once('secureConnect',resolve);dataTls.once('error',reject);});
   const final=this.read(60000);
   const transfer=new Promise((resolve,reject)=>{dataTls.once('error',reject);dataTls.once('close',resolve);dataTls.setTimeout(30000,()=>dataTls.destroy(new Error('FTPS upload timeout')));dataTls.end(data);});
   const [reply]=await Promise.all([final,transfer]);this.expect(reply,226);
   const size=this.expect(await this.command('SIZE '+name),213);const count=Number(size.text.slice(3).trim());if(count!==data.length)throw Error('Uploaded size mismatch');
   return {bytes:count,tlsVerified:true};
  }finally{raw.destroy();}
 }
 close(){if(this.socket&&!this.socket.destroyed){this.socket.write('QUIT\r\n');this.socket.destroy();}}
}
module.exports={Mqtt,Ftps};
