// A printer the Chromebook app lost touch with must stay editable: before this, a stale "printing" report or an unresolved
// job kept it busy, so its IP/code could not be changed or removed and only reinstalling the app reconnected it.
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const memory=new Map();globalThis.localStorage={getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.BAMBU_CA_PEM='test-ca';
class FakeMqtt extends EventEmitter{
 constructor(device){super();this.device=device;this.state={};this.online=false;this.lastReportAt=0;FakeMqtt.last=this;}
 async connect(){this.online=true;}
 async refresh(){this.lastReportAt=Date.now();this.emit('report',{print:{}});}
 async publish(){}
 close(){this.online=false;}
 report(state){Object.assign(this.state,state);this.lastReportAt=Date.now();this.emit('report',{print:{}});}
}
globalThis.DirectPrinterLink={Mqtt:FakeMqtt,Ftps:class{}};
require('../src/print-job.js');require('../src/direct/discovery.js');require('../src/direct/relay.js');
const relay=globalThis.DirectRelay,STORE='click-direct-v1',JOBS='click-direct-jobs-v1';
const PRINTER={id:'mini-01',name:'A1 mini 6789',ip:'192.168.0.2',serial:'01S00C123456789',accessCode:'abcd1234'};
const settle=()=>new Promise(r=>setTimeout(r,20));
function boot(jobs=[]){memory.clear();memory.set(STORE,JSON.stringify({printers:[PRINTER],pairing:{printerId:'mini-01',revision:1},deviceName:'테스트'}));memory.set(JOBS,JSON.stringify(jobs));relay.reset();relay.start();return settle();}
const busy=()=>relay.telemetry('mini-01').busy;
const save=body=>relay.handle('POST','/api/connection-settings',{printerId:'mini-01',ip:PRINTER.ip,serial:PRINTER.serial,...body});
const job=(extra)=>({id:'a'.repeat(24),name:'수민',state:'uncertain',printId:'111',printerId:'mini-01',printerSerial:PRINTER.serial,clientId:'this-device',pairingRevision:1,startAttempted:true,createdAt:new Date(Date.now()-600000).toISOString(),...extra});
test.afterEach(()=>relay.reset());

test('a printer that dropped off mid-print can still be edited and removed',async()=>{
 await boot();
 FakeMqtt.last.report({gcode_state:'RUNNING'});
 assert.equal(busy(),true);
 await assert.rejects(save({ip:'192.168.0.7'}),/출력 중/);
 FakeMqtt.last.close();
 assert.equal(busy(),false,'the last report before the connection dropped no longer locks the printer');
 const saved=await save({ip:'192.168.0.7'});
 assert.equal(saved.saved,true);
 assert.equal(relay.store.printers[0].ip,'192.168.0.7');
 assert.equal((await save({remove:true})).removed,true);
 assert.equal(relay.store.printers.length,0);
});

test('a job the printer is no longer running is closed once the printer reports itself idle',async()=>{
 await boot([job({sentAt:Date.now()-600000})]);
 assert.equal(busy(),true);
 FakeMqtt.last.report({gcode_state:'IDLE',subtask_id:'999'});
 const j=await relay.handle('GET','/api/jobs/'+'a'.repeat(24));
 assert.equal(j.state,'failed');
 assert.match(j.attention,/본체에서 확인/);
 assert.equal(busy(),false);
});

test('a just-sent job is not closed by an idle report from before it started',async()=>{
 await boot([job({state:'sent',sentAt:Date.now()})]);
 FakeMqtt.last.report({gcode_state:'IDLE',subtask_id:'999'});
 assert.equal((await relay.handle('GET','/api/jobs/'+'a'.repeat(24))).state,'sent');
 assert.equal(busy(),true);
});

test('a finished job completes after a restart even without having seen it run',async()=>{
 await boot([job({state:'printing'})]);
 FakeMqtt.last.report({gcode_state:'FINISH',subtask_id:'111',mc_percent:100});
 assert.equal((await relay.handle('GET','/api/jobs/'+'a'.repeat(24))).state,'complete');
 assert.equal(busy(),false);
});

test('an upload interrupted by closing the app is not treated as still running',async()=>{
 await boot([job({state:'uploading',startAttempted:false,printId:undefined})]);
 const j=await relay.handle('GET','/api/jobs/'+'a'.repeat(24));
 assert.equal(j.state,'failed');
 assert.equal(busy(),false);
});
