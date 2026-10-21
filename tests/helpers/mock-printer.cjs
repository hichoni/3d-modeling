// Test-only A1 mini LAN endpoint: TLS MQTT broker + implicit FTPS. No real printer, heater or motion.
// FTPS data channels must resume the control TLS session, as on the printer (vsftpd require_ssl_reuse).
const tls=require('node:tls'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const fixture=name=>fs.readFileSync(path.join(__dirname,'../fixtures/direct-tls',name),'utf8');
function u16(n){const b=Buffer.alloc(2);b.writeUInt16BE(n);return b;}
function utf(s){const b=Buffer.from(s);return Buffer.concat([u16(b.length),b]);}
function frame(header,data=Buffer.alloc(0)){let n=data.length;const length=[];do{let b=n%128;n=Math.floor(n/128);length.push(b|(n?128:0));}while(n);return Buffer.concat([Buffer.from([header,...length]),data]);}
class MockPrinter extends EventEmitter{
 constructor({serial='TESTSERIAL01',accessCode='12345678',host='127.0.0.1',mqttPort=0,ftpsPort=0,printSeconds=6,filament={tray_type:'PLA',tray_color:'78C451FF'},model='N1',storReply=null,dataRate=0,sizeLag=0}={}){
  super();Object.assign(this,{serial,accessCode,host,mqttPort,ftpsPort,printSeconds,filament,model,storReply,dataRate,sizeLag});this.files=new Map();this.commands=[];this.clients=new Set();this.sessions=new Map();this.ticketKeys=crypto.randomBytes(48);
  this.state={gcode_state:'IDLE',mc_percent:0,mc_remaining_time:0,layer_num:0,total_layer_num:0,sdcard:true,print_error:0,hms:[],nozzle_diameter:'0.4',nozzle_temper:24,nozzle_target_temper:0,bed_temper:23,bed_target_temper:0,spd_lvl:2,wifi_signal:'-48dBm',stg_cur:-1,vt_tray:{id:'254',...filament,nozzle_temp_min:'190',nozzle_temp_max:'240'},ams:{tray_now:'254',ams:[]},lights_report:[{node:'chamber_light',mode:'off'}]};
 }
 tlsOptions(){return {key:fixture('rsa-device.key.pem'),cert:fixture('rsa-device.pem'),minVersion:'TLSv1.2',maxVersion:'TLSv1.2',ticketKeys:this.ticketKeys};}
 async start(){
  this.sockets=new Set();const track=s=>{this.sockets.add(s);s.on('close',()=>this.sockets.delete(s));};
  this.mqtt=tls.createServer(this.tlsOptions(),s=>{track(s);this.mqttClient(s);});
  this.ftps=tls.createServer(this.tlsOptions(),s=>{track(s);this.ftpsClient(s);});
  for(const server of [this.mqtt,this.ftps]){server.on('newSession',(id,data,cb)=>{this.sessions.set(id.toString('hex'),data);cb();});server.on('resumeSession',(id,cb)=>cb(null,this.sessions.get(id.toString('hex'))||null));}
  await new Promise(r=>this.mqtt.listen(this.mqttPort,this.host,r));await new Promise(r=>this.ftps.listen(this.ftpsPort,this.host,r));
  this.mqttPort=this.mqtt.address().port;this.ftpsPort=this.ftps.address().port;this.timer=setInterval(()=>this.tick(),250);return this;
 }
 device(ca=fixture('rsa-ca.pem')){return {ip:this.host,serial:this.serial,password:this.accessCode,ca,mqttPort:this.mqttPort,ftpsPort:this.ftpsPort};}
 report(delta){const body=Buffer.from(JSON.stringify({print:{command:'push_status',msg:delta?1:0,sequence_id:'0',...(delta||this.state)}}));for(const c of this.clients)c.write(frame(0x30,Buffer.concat([utf('device/'+this.serial+'/report'),body])));}
 tick(){
  if(!this.began)return;const t=(Date.now()-this.began)/1000,s=this.state;
  if(t<1)Object.assign(s,{gcode_state:'PREPARE',stg_cur:2,bed_target_temper:65,nozzle_target_temper:220,bed_temper:40,nozzle_temper:120});
  else if(t<this.printSeconds)Object.assign(s,{gcode_state:'RUNNING',stg_cur:0,bed_temper:65,nozzle_temper:220,layer_num:Math.max(1,Math.floor(t/this.printSeconds*s.total_layer_num)),mc_percent:Math.floor(t/this.printSeconds*100),mc_remaining_time:Math.ceil((this.printSeconds-t)/60)});
  else{Object.assign(s,{gcode_state:'FINISH',stg_cur:-1,layer_num:s.total_layer_num,mc_percent:100,mc_remaining_time:0,bed_target_temper:0,nozzle_target_temper:0});this.began=null;}
  this.report({gcode_state:s.gcode_state,mc_percent:s.mc_percent,layer_num:s.layer_num,nozzle_temper:s.nozzle_temper,bed_temper:s.bed_temper,stg_cur:s.stg_cur});
 }
 command(p){
  this.commands.push(p);this.emit('command',p);const print=p.print;
  if(p.pushing?.command==='pushall')return this.report();
  if(p.info?.command==='get_version')return this.clients.forEach(c=>c.write(frame(0x30,Buffer.concat([utf('device/'+this.serial+'/report'),Buffer.from(JSON.stringify({info:{command:'get_version',sequence_id:p.info.sequence_id,module:[{name:'ota',sw_ver:'01.07.00.00',sn:this.serial,product_name:'Bambu Lab A1 mini'}]}}))]))));
  if(!print)return;
  if(print.command==='project_file'){const name=String(print.url||'').replace(/^(ftp|file):\/\/(\/sdcard\/)?/,''),file=this.files.get(name);
   if(!file||this.state.gcode_state==='RUNNING'){this.clients.forEach(c=>c.write(frame(0x30,Buffer.concat([utf('device/'+this.serial+'/report'),Buffer.from(JSON.stringify({print:{command:'project_file',sequence_id:print.sequence_id,result:'fail',reason:'file not found'}}))]))));return;}
   Object.assign(this.state,{subtask_id:print.subtask_id,subtask_name:print.subtask_name,gcode_file:name,total_layer_num:12,layer_num:0,mc_percent:0});this.began=Date.now();this.tick();}
  else if(print.command==='stop'){this.began=null;Object.assign(this.state,{gcode_state:'FAILED',print_error:50348044});this.report();}
  else if(print.command==='pause'){this.paused=this.began;this.began=null;this.state.gcode_state='PAUSE';this.report();}
  else if(print.command==='resume'&&this.paused){this.began=this.paused;this.paused=null;this.tick();}
  else if(print.command==='print_speed')this.state.spd_lvl=Number(print.param);
 }
 mqttClient(s){
  let incoming=Buffer.alloc(0);s.on('error',()=>{});s.on('close',()=>this.clients.delete(s));
  s.on('data',chunk=>{incoming=Buffer.concat([incoming,chunk]);
   while(incoming.length>=2){let n=0,m=1,i=1,b;do{if(i>=incoming.length)return;b=incoming[i++];n+=(b&127)*m;m*=128;}while(b&128);if(incoming.length<i+n)return;const h=incoming[0],body=incoming.subarray(i,i+n);incoming=incoming.subarray(i+n);
    const type=h>>4;
    if(type===1){let o=10;const field=()=>{const l=body.readUInt16BE(o),v=body.subarray(o+2,o+2+l).toString();o+=2+l;return v;};field();const user=field(),pass=field();const ok=user==='bblp'&&pass===this.accessCode;s.write(frame(0x20,Buffer.from([0,ok?0:5])));if(!ok)s.end();}
    else if(type===8){const id=body.readUInt16BE(0),topic=body.subarray(4,4+body.readUInt16BE(2)).toString();s.write(frame(0x90,Buffer.concat([u16(id),Buffer.from([topic==='device/'+this.serial+'/report'?0:128])])));this.clients.add(s);}
    else if(type===3){const tl=body.readUInt16BE(0),topic=body.subarray(2,2+tl).toString();let o=2+tl;if(h&6)o+=2;if(topic==='device/'+this.serial+'/request')try{this.command(JSON.parse(body.subarray(o)));}catch{}}
    else if(type===12)s.write(frame(0xd0));else if(type===14)s.end();
   }});
 }
 ftpsClient(s){
  let user=false,auth=false,pending='',dataServer=null,upload=null;s.on('error',()=>{});const say=t=>s.write(t+'\r\n');say('220 Bambu FTP ready');
  s.on('data',b=>{pending+=b;let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i).trim();pending=pending.slice(i+1);const [cmd,...rest]=line.split(' '),arg=rest.join(' ');
   if(cmd==='USER'){user=arg==='bblp';say('331 Password required');}
   else if(cmd==='PASS'){auth=user&&arg===this.accessCode;say(auth?'230 Login successful':'530 Login incorrect');}
   else if(!auth)say('530 Please login');
   else if(cmd==='TYPE')say('200 Switching to Binary mode.');else if(cmd==='PBSZ')say('200 PBSZ set to 0.');else if(cmd==='PROT')say('200 PROT now Private.');
   else if(cmd==='PASV'){dataServer?.close();dataServer=tls.createServer(this.tlsOptions(),d=>{d.on('error',()=>{});if(!d.isSessionReused()){d.destroy();say('522 SSL connection failed: session reuse required');return;}const parts=[];d.on('data',c=>{parts.push(c);if(this.dataRate){d.pause();setTimeout(()=>d.resume(),c.length/this.dataRate*1000);}});d.on('end',()=>{upload?.(Buffer.concat(parts));d.end();});});
    dataServer.on('resumeSession',(id,cb)=>cb(null,this.sessions.get(id.toString('hex'))||null));
    dataServer.listen(0,this.host,()=>{const p=dataServer.address().port;say(`227 Entering Passive Mode (${this.host.replace(/\./g,',')},${p>>8},${p&255}).`);});}
   else if(cmd==='STOR'&&this.storReply)say(this.storReply);
   else if(cmd==='STOR'){const name=arg;say('150 Ok to send data.');upload=data=>{this.files.set(name,data);this.emit('upload',name,data);say('226 Transfer complete.');dataServer?.close();upload=null;};}
   else if(cmd==='SIZE'){const f=this.files.get(arg);say(f?'213 '+(this.sizeLag-->0?Math.floor(f.length/2):f.length):'550 Could not get file size.');}
   else if(cmd==='QUIT'){say('221 Goodbye.');s.end();}
   else say('502 Command not implemented.');
  }});
  s.on('close',()=>dataServer?.close());
 }
 async stop(){clearInterval(this.timer);for(const c of this.sockets)c.destroy();await Promise.all([this.mqtt,this.ftps].map(x=>new Promise(r=>x.close(()=>r()))));}
}
module.exports={MockPrinter};
