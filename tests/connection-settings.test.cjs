const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {EventEmitter}=require('node:events');
const {Fleet}=require('../bridge/fleet.cjs');
const {connectionSettings,saveConnection,waitForStatus}=require('../bridge/connection-settings.cjs');
class StatusMqtt extends EventEmitter{
 constructor(device){super();this.device=device;this.state={};this.online=false;}
 async connect(){this.online=true;this.lastReportAt=Date.now();this.state={gcode_state:'IDLE'};}
 refresh(){this.refreshes=(this.refreshes||0)+1;}
 close(){this.online=false;}
 publish(){throw Error('Connection tests must not send print commands');}
}
function fixture(MqttClass=StatusMqtt){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-connection-')),cfgPath=path.join(dir,'config.json');
 const printers=[{id:'mini-01',name:'Test mini',ip:'192.168.1.10',serial:'TESTMINI01',accessCode:'OldCode1'},{id:'mini-02',name:'Other mini',ip:'192.168.1.11',serial:'TESTMINI02',accessCode:'OtherCd2'}];
 const config={operatorPin:'234567',booth:{enabled:false},printers};fs.writeFileSync(cfgPath,JSON.stringify(config));
 const fleet=new Fleet(printers,{MqttClass,verify:async()=>{},save:()=>{},FtpsClass:class{constructor(){throw Error('No file upload allowed');}}});
 return {config,printers,fleet,cfgPath,body:{printerId:'mini-01',ip:'192.168.1.10',serial:'TESTMINI01',accessCode:'NewCode3'}};
}
test('web connection saves one mini atomically, reconnects, observes status and never returns its code',async()=>{
 const f=fixture();try{
  const result=await saveConnection(f);assert.equal(result.connected,true);assert.equal(result.statusReceived,true);
  const saved=JSON.parse(fs.readFileSync(f.cfgPath));assert.equal(saved.printers[0].accessCode,'NewCode3');assert.equal(saved.printers[1].accessCode,'OtherCd2');assert.equal(saved.operatorPin,'234567');assert.equal(saved.booth.enabled,false);
  assert.equal(f.fleet.item('mini-01').device.password,'NewCode3');assert.equal(f.fleet.item('mini-02').mqtt,null);
  const publicText=JSON.stringify({...result,...connectionSettings(f.printers,f.fleet)});assert.ok(!publicText.includes('NewCode3'));assert.ok(!publicText.includes('OtherCd2'));assert.ok(!publicText.includes('234567'));
  assert.equal(connectionSettings(f.printers,f.fleet).printers[0].hasAccessCode,true);
  f.body.accessCode='';await saveConnection(f);assert.equal(f.fleet.item('mini-01').device.password,'NewCode3');
 }finally{f.fleet.close();}
});
test('invalid, duplicate, busy or concurrent connection changes do not alter saved settings',async()=>{
 const f=fixture(),before=fs.readFileSync(f.cfgPath,'utf8');try{
  for(const change of [{ip:'8.8.8.8'},{ip:'192.168.1.11'},{serial:'TESTMINI02'},{accessCode:'bad'},{accessCode:'bad\r\nxx'},{serial:'CHANGED',accessCode:''}])await assert.rejects(saveConnection({...f,body:{...f.body,...change}}));
  for(const state of ['connecting','configuring']){f.fleet.item('mini-01')[state]=true;await assert.rejects(saveConnection(f));f.fleet.item('mini-01')[state]=false;}
  f.fleet.item('mini-01').active={state:'uncertain'};await assert.rejects(saveConnection(f));
  assert.equal(fs.readFileSync(f.cfgPath,'utf8'),before);assert.equal(f.printers[0].accessCode,'OldCode1');
 }finally{f.fleet.close();}
});
test('authentication failure retains saved code for correction and returns a useful message without secrets',async()=>{
 class Refused extends StatusMqtt{async connect(){throw Error('MQTT authentication refused: 5');}}
 const f=fixture(Refused);try{
  await assert.rejects(saveConnection(f),e=>/설정은 저장/.test(e.message)&&/액세스 코드 인증이 거절/.test(e.message)&&!e.message.includes('NewCode3'));
  assert.equal(JSON.parse(fs.readFileSync(f.cfgPath)).printers[0].accessCode,'NewCode3');assert.equal(f.printers[0].accessCode,'NewCode3');assert.equal(f.fleet.state('mini-01').online,false);assert.equal(f.fleet.item('mini-01').configuring,false);
 }finally{f.fleet.close();}
});
test('failed disk replacement preserves in-memory credentials and cleans up the temporary file',async()=>{
 const f=fixture(),blocked=path.join(path.dirname(f.cfgPath),'directory');fs.mkdirSync(blocked);try{
  await assert.rejects(saveConnection({...f,cfgPath:blocked}),/저장하지 못/);assert.equal(f.printers[0].accessCode,'OldCode1');assert.equal(f.fleet.item('mini-01').mqtt,null);assert.equal(fs.readdirSync(path.dirname(f.cfgPath)).some(x=>x.endsWith('.tmp')),false);
 }finally{f.fleet.close();}
});
test('connection success requires an actual printer report and releases all listeners on timeout',async()=>{
 const mqtt=new StatusMqtt({});mqtt.online=true;const pending=waitForStatus(mqtt,1000);assert.equal(mqtt.listenerCount('report'),1);mqtt.emit('report',{system:{}});assert.equal(mqtt.listenerCount('report'),1);mqtt.emit('report',{print:{gcode_state:'IDLE'}});await pending;assert.equal(mqtt.listenerCount('report'),0);
 await assert.rejects(waitForStatus(mqtt,10),/실시간 상태를 받지 못/);assert.equal(mqtt.listenerCount('fault'),0);assert.equal(mqtt.listenerCount('report'),0);
});
