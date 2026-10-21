const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require('./helpers/direct-sockets.cjs').install();
require('../src/direct/sockets.js');require('../src/direct/tls.js');
const {Mqtt,Ftps}=require('../src/direct/printer-link.js'),{MockPrinter}=require('./helpers/mock-printer.cjs');
const wait=(fn,ms=8000)=>new Promise((resolve,reject)=>{const t0=Date.now(),i=setInterval(()=>{if(fn()){clearInterval(i);resolve();}else if(Date.now()-t0>ms){clearInterval(i);reject(Error('timeout'));}},20);});

test('MQTT authenticates with the access code, subscribes and receives full reports',async t=>{
 const printer=await new MockPrinter().start();t.after(()=>printer.stop());
 const mqtt=new Mqtt(printer.device());await mqtt.connect();t.after(()=>mqtt.close());
 await mqtt.refresh();await wait(()=>mqtt.state.gcode_state==='IDLE');
 assert.equal(mqtt.state.vt_tray.tray_type,'PLA');assert.ok(mqtt.lastReportAt>0);
 await mqtt.publish({print:{sequence_id:'9',command:'print_speed',param:'3'}});await wait(()=>printer.state.spd_lvl===3);
});

test('MQTT reports a refused access code without exposing it',async t=>{
 const printer=await new MockPrinter().start();t.after(()=>printer.stop());
 const mqtt=new Mqtt({...printer.device(),password:'00000000'});
 await assert.rejects(mqtt.connect(),e=>e.code==='MQTT_AUTH_5'&&!e.message.includes('00000000'));
});

test('FTPS uploads over a resumed TLS data channel and verifies the size',async t=>{
 const printer=await new MockPrinter().start();t.after(()=>printer.stop());
 const ftp=new Ftps(printer.device());await ftp.connect();t.after(()=>ftp.close());
 const data=crypto.randomBytes(400000),progress=[];
 assert.deepEqual(await ftp.upload('click_test.3mf',new Uint8Array(data),p=>progress.push(p)),{bytes:data.length,tlsVerified:true});
 assert.ok(printer.files.get('click_test.3mf').equals(data));assert.equal(progress.at(-1),1);
 await assert.rejects(ftp.upload('../escape.3mf',new Uint8Array(1)),e=>e.code==='FTPS_NAME');
});

test('upload then project_file runs to FINISH on the mock printer',async t=>{
 const printer=await new MockPrinter({printSeconds:1.5}).start();t.after(()=>printer.stop());
 const mqtt=new Mqtt(printer.device());await mqtt.connect();t.after(()=>mqtt.close());
 const ftp=new Ftps(printer.device());await ftp.connect();await ftp.upload('click_job.3mf',new Uint8Array([1,2,3]));await ftp.close();
 const states=new Set();mqtt.on('report',()=>states.add(mqtt.state.gcode_state));
 await mqtt.publish({print:{sequence_id:'77',command:'project_file',param:'Metadata/plate_1.gcode',url:'ftp://click_job.3mf',file:'click_job.3mf',subtask_id:'77'}});
 await wait(()=>mqtt.state.gcode_state==='FINISH');assert.ok(states.has('RUNNING'));await mqtt.refresh();await wait(()=>mqtt.state.subtask_id==='77');
});
