const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
const {Fleet}=require('../bridge/fleet.cjs');
const {directPrint,stopOwnJob}=require('../bridge/direct-print.cjs');
const lessons=require('../src/print-lesson.js');
class Mqtt extends EventEmitter{
 constructor(){super();this.state={gcode_state:'IDLE',sdcard:true,print_error:0,nozzle_diameter:'0.4',bed_temper:23,bed_target_temper:0,nozzle_temper:25,nozzle_target_temper:0};this.sent=[];}
 async connect(){this.online=true;this.lastReportAt=Date.now();}refresh(){}close(){}publish(value){this.sent.push(value);}
}
function fixture(t,FtpsClass=class{async connect(){}async upload(){}close(){}}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-direct-')),config={id:'mini-01',name:'Test mini',ip:'192.168.1.9',serial:'TESTMINI',accessCode:'test'};
 const fleet=new Fleet([config],{jobRoot:dir,save:()=>{},MqttClass:Mqtt,FtpsClass,verify:async()=>{}});t.after(()=>fleet.close());
 let sequence=0;function job(){const id=(++sequence).toString(16).padStart(24,'0'),folder=path.join(dir,id),bytes=Buffer.from('isolated test file '+id);fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'print.gcode.3mf'),bytes);return {id,clientId:'owner',printerId:config.id,printerSerial:config.serial,pairingRevision:1,state:'ready',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),slice:{source:'browser'}};}
 const pairings={matches:j=>j.pairingRevision===1};
 const start=(j,body={ready:true,sha256:j.sha256},owner='owner')=>directPrint({job:j,owner,pairings,fleet,body,save:()=>{}});
 return {fleet,job,start,pairings,p:()=>fleet.item(config.id)};
}
test('one click starts own browser job without a ticket or operator PIN; repeat clicks submit once',async t=>{
 let uploaded=0;const f=fixture(t,class{async connect(){}async upload(){uploaded++;}close(){}});await f.fleet.connect('mini-01');const j=f.job(),pending=f.start(j);
 assert.equal(j.state,'uploading');assert.equal(j.mode,'direct');assert.equal(j.ticket,undefined);assert.equal(f.start(j),null);await pending;
 assert.equal(j.state,'sent');assert.equal(f.start(j),null);assert.equal(uploaded,1);assert.equal(f.p().mqtt.sent.length,1);
 const print=f.p().mqtt.sent[0].print;assert.equal(print.bed_leveling,true);assert.equal(print.flow_cali,true);assert.equal(print.use_ams,false);
 const other=f.job();assert.throws(()=>f.start(other),/이전 출력/);assert.equal(other.state,'ready');
 Object.assign(f.p().mqtt.state,{subtask_id:j.printId,gcode_state:'RUNNING',layer_num:1,mc_percent:10});f.p().mqtt.emit('report',{print:{}});assert.equal(j.state,'printing');
 assert.throws(()=>stopOwnJob({job:j,owner:'other',pairings:f.pairings,fleet:f.fleet}),/이 기기/);
 stopOwnJob({job:j,owner:'owner',pairings:f.pairings,fleet:f.fleet});assert.equal(f.p().mqtt.sent[1].print.command,'stop');
});
test('direct start preserves owner, pairing, hash, readiness and hardware checks',async t=>{
 const f=fixture(t);await f.fleet.connect('mini-01');const j=f.job();
 assert.throws(()=>f.start(j,undefined,'other'),/이 기기/);assert.throws(()=>f.start(j,{}),/준비/);assert.throws(()=>f.start(j,{ready:true,sha256:'wrong'}),/준비/);
 j.pairingRevision=2;assert.throws(()=>f.start(j),/선택/);j.pairingRevision=1;
 j.printerSerial='CHANGED';assert.throws(()=>f.start(j),/설정/);j.printerSerial='TESTMINI';
 for(const patch of [{gcode_state:'RUNNING'},{sdcard:false},{print_error:3},{nozzle_diameter:'0.6'}]){
  const before={...f.p().mqtt.state};Object.assign(f.p().mqtt.state,patch);assert.throws(()=>f.start(j));assert.equal(j.state,'ready');f.p().mqtt.state=before;
 }
 f.p().mqtt.lastReportAt=0;assert.throws(()=>f.start(j),/최신/);assert.equal(j.state,'ready');assert.equal(f.p().mqtt.sent.length,0);
});
test('all four calibration combinations reach the actual start payload and cannot change mid-transfer',async t=>{
 for(const bedLeveling of [false,true])for(const flowCalibration of [false,true]){
  const f=fixture(t);await f.fleet.connect('mini-01');const j=f.job(),options={bedLeveling,flowCalibration},body={ready:true,sha256:j.sha256,printOptions:options},pending=f.start(j,body);
  assert.deepEqual(j.printOptions,{bedLeveling,flowCalibration});assert.equal(f.start(j,body),null);assert.throws(()=>f.start(j,{...body,printOptions:{bedLeveling:!bedLeveling,flowCalibration}}),/바꿀 수/);
  options.bedLeveling=!bedLeveling;await pending;const p=f.p().mqtt.sent[0].print;assert.equal(p.bed_leveling,bedLeveling);assert.equal(p.flow_cali,flowCalibration);assert.equal(p.use_ams,false);
 }
});
test('non-PLA metadata blocks before file transfer, and a material change during upload blocks the start command',async t=>{
 const f=fixture(t);await f.fleet.connect('mini-01');const j=f.job();f.p().mqtt.state.vt_tray={tray_type:'PETG'};assert.throws(()=>f.start(j),/PLA/);assert.equal(j.state,'ready');assert.equal(f.p().mqtt.sent.length,0);
 let g;g=fixture(t,class{async connect(){}async upload(){g.p().mqtt.state.vt_tray={tray_type:'ABS'};}close(){}});await g.fleet.connect('mini-01');const k=g.job();await assert.rejects(g.start(k));assert.equal(k.state,'failed');assert.equal(g.p().mqtt.sent.length,0);
});
test('transfer failure and unknown command outcome never trigger an automatic retry',async t=>{
 const f=fixture(t,class{async connect(){throw Error('test failure');}close(){}});await f.fleet.connect('mini-01');const j=f.job();await assert.rejects(f.start(j));assert.equal(j.state,'failed');assert.throws(()=>f.start(j),/이미/);assert.equal(f.p().mqtt.sent.length,0);
 const g=fixture(t);await g.fleet.connect('mini-01');const k=g.job();await g.start(k);k.state='uncertain';assert.equal(g.start(k),null);assert.equal(g.p().mqtt.sent.length,1);
});
test('public telemetry contains finite current readings, and stale values become unknown',async t=>{
 const f=fixture(t);await f.fleet.connect('mini-01');const s=f.fleet.state('mini-01');assert.equal(s.bedTemperature,23);assert.equal(s.nozzleTemperature,25);assert.equal(s.nozzleTarget,0);assert.equal(s.layer,null);assert.ok(!JSON.stringify(s).includes('accessCode'));assert.ok(!JSON.stringify(s).includes('TESTMINI'));
 f.p().mqtt.state.nozzle_temper='not a number';assert.equal(f.fleet.state('mini-01').nozzleTemperature,null);f.p().mqtt.lastReportAt=0;const stale=f.fleet.state('mini-01');assert.equal(stale.fresh,false);assert.equal(stale.bedTemperature,null);assert.equal(stale.bedTarget,null);
});
test('tutorial follows observed heating, layers, pause, loss of connection and completion',()=>{
 const job={state:'accepted'},t={fresh:true,bedTemperature:30,bedTarget:65,nozzleTemperature:25,nozzleTarget:0};
 assert.equal(lessons.phase(null,t),'idle');assert.equal(lessons.phase(job,t),'bed');t.bedTemperature=65;t.nozzleTarget=220;assert.equal(lessons.phase(job,t),'nozzle');t.nozzleTemperature=220;assert.equal(lessons.phase(job,t),'prepare');
 job.state='printing';job.layer=1;assert.equal(lessons.phase(job,t),'printing');assert.equal(lessons.phase(job,{fresh:false}),'offline');job.state='paused';assert.equal(lessons.phase(job,t),'paused');job.state='uncertain';assert.equal(lessons.phase(job,t),'uncertain');job.state='complete';assert.equal(lessons.phase(job,t),'cooling');t.nozzleTemperature=27;t.bedTemperature=28;assert.equal(lessons.phase(job,t),'complete');
 assert.equal(lessons.temperature(null),'—');assert.equal(lessons.temperature(NaN),'—');assert.equal(lessons.temperature(64.6),'65°');
});
