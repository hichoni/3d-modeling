const fs=require('node:fs');
const crypto=require('node:crypto');
const {printerDefinitions}=require('./printers.cjs');

// Only the loopback operator may call these through server.cjs. Never return credentials.
function connectionSettings(printers,fleet){
 return {printers:printers.map(p=>({id:p.id,name:p.name,ip:p.ip||'',serial:p.serial||'',hasAccessCode:!!p.accessCode,...fleet.state(p.id)}))};
}
function waitForStatus(mqtt,timeout=6000){
 if(mqtt.online&&mqtt.lastReportAt&&Object.keys(mqtt.state).length)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const done=error=>{clearTimeout(timer);mqtt.removeListener('report',report);mqtt.removeListener('fault',fault);error?reject(error):resolve();};
  const report=r=>{if(r.print&&mqtt.online)done();},fault=()=>done(Error('상태 수신 중 연결이 끊겼습니다.'));
  const timer=setTimeout(()=>done(Error('인증됐지만 실시간 상태를 받지 못했습니다. 프린터의 개발자 모드를 확인하고 다시 연결하세요.')),timeout);
  mqtt.on('report',report);mqtt.on('fault',fault);
  try{mqtt.refresh();}catch{fault();}
 });
}
async function saveConnection({body,config,printers,fleet,cfgPath}){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('프린터 연결 설정을 확인하세요.');
 const p=fleet.item(body.printerId);
 if(p.configuring||p.connecting||fleet.busy(body.printerId))throw Error('연결 또는 출력 상태 확인 중입니다. 잠시 뒤 다시 시도하세요.');
 const ip=typeof body.ip==='string'?body.ip.trim():'';
 const serial=typeof body.serial==='string'?body.serial.trim():'';
 const entered=typeof body.accessCode==='string'?body.accessCode.trim():'';
 if(!ip||!serial)throw Error('프린터 IP와 일련번호를 입력하세요.');
 if(entered&&!/^[a-zA-Z0-9]{8}$/.test(entered))throw Error('프린터에 표시된 LAN 액세스 코드 8자리를 입력하세요.');
 const accessCode=entered||(serial===p.config.serial?p.config.accessCode:'');
 if(!accessCode)throw Error('프린터에 표시된 현재 LAN 액세스 코드를 입력하세요.');
 const next=printers.map(item=>item.id===body.printerId?{...item,ip,serial,accessCode}:{...item});
 printerDefinitions({printers:next});
 const updated={...config,printers:next},temp=cfgPath+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
 try{fs.writeFileSync(temp,JSON.stringify(updated,null,2),{flag:'wx',mode:0o600});fs.renameSync(temp,cfgPath);}
 catch{try{fs.unlinkSync(temp);}catch{}throw Error('연결 설정을 저장하지 못했습니다. 출력 PC의 저장 권한을 확인하세요.');}
 Object.assign(config,updated);
 Object.assign(p.config,next.find(item=>item.id===body.printerId));
 p.mqtt?.close();p.mqtt=null;p.device=null;p.error='';
 p.configuring=true;
 try{
  await fleet.connect(body.printerId);
  await waitForStatus(p.mqtt);
  return {saved:true,connected:true,statusReceived:true,printerId:body.printerId};
 }catch(e){
  // Transport errors can contain implementation details. Only return the curated messages.
  const detail=e.message.startsWith('인증됐지만')?e.message:p.error||'실시간 상태를 확인하지 못했습니다. 다시 연결하세요.';
  throw Error('설정은 저장했지만 연결을 완료하지 못했어요. '+detail);
 }finally{p.configuring=false;}
}
module.exports={connectionSettings,saveConnection,waitForStatus};
