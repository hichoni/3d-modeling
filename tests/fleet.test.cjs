const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const crypto=require('node:crypto');const {EventEmitter}=require('node:events');
const {Pairings,clientId}=require('../bridge/pairings.cjs');const {Fleet}=require('../bridge/fleet.cjs');const {printerDefinitions}=require('../bridge/printers.cjs');
const printers=[{id:'mini-01',name:'미니 01',ip:'192.168.1.10',serial:'TESTMINI001',accessCode:'test'},{id:'mini-02',name:'미니 02',ip:'192.168.1.11',serial:'TESTMINI002',accessCode:'test'}];
test('duplicate physical printers cannot be assigned two independent identities',()=>{assert.equal(printerDefinitions({printers}).length,2);for(const key of ['id','ip','serial'])assert.throws(()=>printerDefinitions({printers:[printers[0],{...printers[1],[key]:printers[0][key]}]}));assert.throws(()=>printerDefinitions({printers:[{...printers[0],ip:'8.8.8.8'}]}));});
test('1:1 leases survive restart, reject busy swaps, cancel old pending jobs and invalidate revisions',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-pair-')),file=path.join(dir,'pairings.json'),a=clientId('a'.repeat(64)),b=clientId('b'.repeat(64));let busy=false,pending=[];const store=new Pairings(file,printers,{busy:()=>busy,pending:id=>pending.filter(j=>j.clientId===id&&j.state==='queued'),cancel:j=>j.state='cancelled'});
 const first=store.pair(a,'mini-01','크롬북 01');assert.throws(()=>store.pair(b,'mini-01','다른 기기'));store.pair(b,'mini-02','크롬북 02');assert.equal(new Pairings(file,printers).owner('mini-01').id,a);
 const job={clientId:a,printerId:'mini-01',pairingRevision:first.revision,state:'queued'};pending=[job];assert.equal(store.matches(job),true);assert.throws(()=>store.release(a));busy=true;assert.throws(()=>store.release(a,true));busy=false;store.release(a,true);assert.equal(job.state,'cancelled');assert.equal(store.matches(job),false);store.release(b,true);store.pair(a,'mini-02','이동한 크롬북');assert.equal(store.get(a).printerId,'mini-02');assert.equal(store.matches(job),false);
});
class FakeMqtt extends EventEmitter{constructor(d){super();this.device=d;this.state={gcode_state:'IDLE',sdcard:true,print_error:0,nozzle_diameter:'0.4'};this.sent=[];}async connect(){this.online=true;this.lastReportAt=Date.now();}refresh(){}publish(p){this.sent.push(p);}close(){this.online=false;}}
class FakeFtps{constructor(d){this.device=d;}async connect(){}async upload(name,bytes){this.uploaded={name,bytes:bytes.length};}close(){}}
test('two minis start independently, receive only their own job and report separately',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-fleet-')),fleet=new Fleet(printers,{jobRoot:dir,save:()=>{},MqttClass:FakeMqtt,FtpsClass:FakeFtps,verify:async()=>{}});
 function job(id,printer){const folder=path.join(dir,id);fs.mkdirSync(folder,{recursive:true});const data=Buffer.from('test sliced content '+id);fs.writeFileSync(path.join(folder,'print.gcode.3mf'),data);return {id,printerId:printer.id,printerSerial:printer.serial,state:'queued',sha256:crypto.createHash('sha256').update(data).digest('hex')};}
 try{
  await Promise.all(printers.map(p=>fleet.connect(p.id)));const one=job('a'.repeat(24),printers[0]),two=job('b'.repeat(24),printers[1]);const body=j=>({sha256:j.sha256,bedClear:true,plaReady:true});
  await fleet.start(one,body(one));assert.equal(fleet.item('mini-02').mqtt.sent.length,0);await fleet.start(two,body(two));
  assert.equal(fleet.item('mini-01').mqtt.sent.length,1);assert.equal(fleet.item('mini-02').mqtt.sent.length,1);assert.match(fleet.item('mini-01').mqtt.sent[0].print.file,new RegExp(one.id));assert.match(fleet.item('mini-02').mqtt.sent[0].print.file,new RegExp(two.id));
  assert.throws(()=>fleet.check(one,body(one)));const wrongSerial=job('c'.repeat(24),printers[0]);wrongSerial.printerSerial='CHANGED';assert.throws(()=>fleet.check(wrongSerial,body(wrongSerial)));
  // Reproduce the A1 mini firmware's observed int32 saturation of large task IDs.
  const firmwareId=value=>String(Math.min(0x7fffffff,Number(value)));
  for(const j of [one,two]){assert.ok(Number(j.printId)>0&&Number(j.printId)<0x7fffffff);assert.equal(firmwareId(j.printId),j.printId);}
  Object.assign(fleet.item('mini-01').mqtt.state,{subtask_id:firmwareId(one.printId),gcode_state:'RUNNING',layer_num:1,mc_percent:22});fleet.item('mini-01').mqtt.emit('report',{print:{}});assert.equal(one.state,'printing');assert.equal(two.state,'sent');assert.equal(fleet.canStop('mini-02'),false);
  Object.assign(fleet.item('mini-02').mqtt.state,{subtask_id:firmwareId(two.printId),gcode_state:'RUNNING',layer_num:2,mc_percent:33});fleet.item('mini-02').mqtt.emit('report',{print:{}});assert.equal(two.state,'printing');assert.equal(fleet.canStop('mini-02'),true);fleet.stop('mini-02');assert.equal(fleet.item('mini-01').mqtt.sent.length,1);assert.equal(fleet.item('mini-02').mqtt.sent[1].print.command,'stop');
  Object.assign(fleet.item('mini-01').mqtt.state,{gcode_state:'FINISH',mc_percent:90});fleet.item('mini-01').mqtt.emit('report',{print:{}});assert.equal(one.state,'complete');assert.equal(one.progress,100);assert.equal(two.state,'printing');assert.equal(fleet.busy('mini-01'),false);assert.equal(fleet.busy('mini-02'),true);
 }finally{fleet.close();}
});
