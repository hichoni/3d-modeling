// Explicit node --require preload for isolated HTTP/UI tests only. Never packaged.
// No sockets, discovery, heaters or printer transports are used by this fixture.
const {EventEmitter}=require('node:events');
const fleetPath=require.resolve('../../bridge/fleet.cjs'),{Fleet}=require(fleetPath);
class MockMqtt extends EventEmitter{
 constructor(){super();this.state={gcode_state:'IDLE',sdcard:true,print_error:0,nozzle_diameter:'0.4',bed_temper:24,bed_target_temper:0,nozzle_temper:25,nozzle_target_temper:0,vt_tray:{id:'254',tray_type:'PLA',tray_color:'78C451FF',nozzle_temp_min:'190',nozzle_temp_max:'240'},ams:{tray_now:'254',ams:[]}};}
 async connect(){this.online=true;this.tick();this.timer=setInterval(()=>this.tick(),500);}
 tick(){
  this.lastReportAt=Date.now();if(this.began){const elapsed=Date.now()-this.began;
   this.state.bed_temper=elapsed<5000?35:65;this.state.bed_target_temper=65;this.state.nozzle_temper=elapsed<5000?25:elapsed<10000?150:220;this.state.nozzle_target_temper=elapsed<5000?0:220;
   Object.assign(this.state,elapsed<14000?{gcode_state:'PREPARE',layer_num:0,mc_percent:0}:elapsed<36000?{gcode_state:'RUNNING',layer_num:Math.min(10,1+Math.floor((elapsed-14000)/2200)),mc_percent:Math.min(99,Math.floor((elapsed-14000)/220))}:{gcode_state:'FINISH',layer_num:10,mc_percent:100,bed_target_temper:0,nozzle_target_temper:0});
  }this.emit('report',{print:{}});
 }
 refresh(){this.tick();}
 publish({print}){if(print.command==='project_file'){this.state.subtask_id=print.subtask_id;this.state.subtask_name=print.subtask_name;this.state.total_layer_num=10;this.began=Date.now();this.tick();}else if(print.command==='stop'){this.began=null;this.state.gcode_state='FAILED';this.tick();}}
 close(){clearInterval(this.timer);this.online=false;}
}
class MockFtps{async connect(){}async upload(){}close(){}}
class MockFleet extends Fleet{
 constructor(printers,options){super(printers,{...options,MqttClass:MockMqtt,FtpsClass:MockFtps,verify:async()=>{}});}
 device(){return {ip:'test-only',serial:'TESTMINI001',password:'test-only'};}
}
require.cache[fleetPath].exports={Fleet:MockFleet};

// Discovery results are also fixtures; the test UI must not open UDP sockets.
const discoveryPath=require.resolve('../../bridge/discovery.cjs');require.cache[discoveryPath].exports={...require(discoveryPath),discoverMinis:async()=>[{ip:'192.168.1.99',serial:'TESTMINI001',model:'A1 mini',lanOnly:true}]};
