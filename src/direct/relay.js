// The relay, running inside the Chromebook app. It answers the same /api routes as bridge/server.cjs so the
// existing Studio and booth screens work unchanged, but talks to the paired A1 mini itself over Direct Sockets.
// One Chromebook ↔ one A1 mini: credentials stay in this app's isolated storage and never leave the device.
(function(root){
const STORE='click-direct-v1',JOBS='click-direct-jobs-v1',STATS='click-direct-statistics-v1',MAX_PRINTERS=8,ACTIVE=['uploading','sent','accepted','printing','paused'];
const J=()=>root.PrintJob,Link=()=>root.DirectPrinterLink,Find=()=>root.DirectDiscovery,Counts=()=>root.WorkshopCounts||(typeof WorkshopCounts!=='undefined'?WorkshopCounts:typeof require==='function'?require('../statistics-core.js'):null);
const STAGES={0:'출력 중',1:'자동 베드 레벨링',2:'베드 예열',3:'진동 보정',4:'필라멘트 교체',5:'일시 정지(M400)',6:'필라멘트 소진으로 정지',7:'노즐 가열',8:'동적 유량 보정',9:'베드 표면 스캔',10:'첫 층 검사',11:'빌드 플레이트 확인',13:'툴헤드 원점 복귀',14:'노즐 끝 청소',15:'압출기 온도 확인',16:'사용자 일시 정지',20:'노즐 온도 이상으로 정지',21:'베드 온도 이상으로 정지',22:'필라멘트 빼는 중',23:'스텝 손실로 정지',24:'필라멘트 넣는 중',25:'모터 소음 보정',35:'노즐 막힘으로 정지',47:'자동 베드 레벨링 1단계',48:'자동 베드 레벨링 2단계',50:'베드 온도 조정',51:'보정 선 출력',54:'베드 목표 온도 대기',69:'노즐 식히는 중',76:'출력 전 예비 압출'};
const SPEEDS={1:'조용히',2:'표준',3:'스포츠',4:'최고 속도'};
let store=load(),statistics=null;const links=new Map(),jobs=new Map(),files=new Map();let timer=null,searching=false;

function load(){try{const s=JSON.parse(localStorage.getItem(STORE));if(s&&Array.isArray(s.printers))return s;}catch{}return {printers:[],pairing:null,deviceName:'이 크롬북'};}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(store));}catch{}}
function loadStats(){try{const s=JSON.parse(localStorage.getItem(STATS));if(s?.version===1)return s;}catch{}return Counts()?.empty()||{version:1,experiences:{},prints:{}};}
function saveStats(){try{localStorage.setItem(STATS,JSON.stringify(statistics));}catch{}}
function saveJob(j){
 if(j.state==='complete'&&!statistics.prints[j.id]){statistics.prints[j.id]={at:j.completedAt||new Date().toISOString(),source:'printer_report'};saveStats();}
 try{const list=[...jobs.values()].filter(x=>ACTIVE.includes(x.state)||x.state==='uncertain'||x===j).slice(-20).map(x=>({...x}));localStorage.setItem(JOBS,JSON.stringify(list));}catch{}
}
function restoreJobs(){try{for(const j of JSON.parse(localStorage.getItem(JOBS))||[]){if(!/^[a-f0-9]{24}$/.test(j.id))continue;if(['ready','queued'].includes(j.state)){j.state='cancelled';j.attention='앱을 다시 열어 준비한 파일이 사라졌습니다. 다시 준비해주세요.';}jobs.set(j.id,j);if(ACTIVE.includes(j.state)||j.state==='uncertain')link(j.printerId).active=j;}}catch{}}
function fail(message,status=409){const e=Error(message);e.status=status;return e;}
const hex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
function printer(id){const p=store.printers.find(x=>x.id===id);if(!p)throw fail('등록된 프린터를 찾지 못했습니다.',404);return p;}
function link(id){if(!links.has(id))links.set(id,{mqtt:null,error:'',connecting:null,active:null,lastPush:0,lastFull:0});return links.get(id);}
function device(p){return {ip:p.ip,serial:p.serial,password:p.accessCode,ca:root.BAMBU_CA_PEM};}
function nextId(){for(let i=1;i<=99;i++){const id='mini-'+String(i).padStart(2,'0');if(!store.printers.some(p=>p.id===id))return id;}return null;}
function fresh(l){return !!l?.mqtt?.online&&Date.now()-l.mqtt.lastReportAt<15000;}
function connectionError(e){if(/^MQTT_AUTH_[45]$/.test(e.code||''))return '액세스 코드 인증이 거절됐습니다. 프린터 화면(설정 → LAN Only)의 현재 8자리 코드를 다시 입력하세요.';if(/^TLS_(NAME_MISMATCH|UNTRUSTED)$/.test(e.code||''))return e.message;if(e.code==='NO_DIRECT_SOCKETS')return e.message;if(e.code==='TLS_CERT_EXPIRED')return e.message;return '이 미니와 연결하지 못했습니다. 같은 Wi-Fi·전원·LAN Only·개발자 모드·IP를 확인하세요.';}

// --- Status, as the relay's fleet.state() plus what Bambu Studio's device panel shows. ---
function hms(s,serial){return (Array.isArray(s.hms)?s.hms:[]).slice(0,8).map(h=>{const a=Number(h.attr)>>>0,c=Number(h.code)>>>0,long=(a.toString(16).padStart(8,'0')+c.toString(16).padStart(8,'0')).toUpperCase();return {code:'HMS_'+long.match(/.{4}/g).join('_'),severity:['','fatal','serious','common','info'][c>>>16]||'info',url:'https://e.bambulab.com/index.php?e='+long+'&d='+encodeURIComponent(serial)+'&s=device_hms&lang=ko'};});}
function developerMode(s){if(typeof s.fun!=='string'||!/^[0-9a-fA-F]+$/.test(s.fun))return null;return (BigInt('0x'+s.fun)&0x20000000n)===0n;}
function telemetry(id){
 const p=store.printers.find(x=>x.id===id)||{id,name:id},l=link(id),s=l.mqtt?.state||{},ok=fresh(l),num=k=>ok&&s[k]!==null&&s[k]!==''&&s[k]!==undefined&&Number.isFinite(Number(s[k]))?Number(s[k]):null,stage=num('stg_cur');
 const light=(Array.isArray(s.lights_report)?s.lights_report:[]).find(x=>x.node==='chamber_light')?.mode;
 return {id,name:p.name,online:!!l.mqtt?.online,fresh:ok,filament:J().filament(s,ok),state:s.gcode_state,progress:s.mc_percent,error:l.error,attention:J().attention(s),busy:busy(id),canStop:!!canStop(id),
  nozzleTemperature:num('nozzle_temper'),nozzleTarget:num('nozzle_target_temper'),bedTemperature:num('bed_temper'),bedTarget:num('bed_target_temper'),layer:num('layer_num'),totalLayers:num('total_layer_num'),stage,
  direct:true,stageLabel:stage!==null&&stage>=0&&stage!==255?STAGES[stage]||'준비 단계 '+stage:'',remainingMinutes:num('mc_remaining_time'),speedLevel:num('spd_lvl'),speedLabel:SPEEDS[num('spd_lvl')]||'',light:light||null,
  wifi:ok&&typeof s.wifi_signal==='string'?s.wifi_signal.slice(0,12):null,hms:ok?hms(s,p.serial||''):[],printError:ok&&Number(s.print_error)>0?(Number(s.print_error)>>>0).toString(16).toUpperCase().padStart(8,'0').replace(/^(.{4})/,'$1_'):null,
  developerMode:ok?developerMode(s):null,otherJob:ok&&['PREPARE','RUNNING','PAUSE'].includes(s.gcode_state)&&!(l.active&&J().matchesJob(s,l.active))?String(s.subtask_name||'').slice(0,40):null,canPause:ok&&s.gcode_state==='RUNNING'&&!!l.active&&J().matchesJob(s,l.active),canResume:ok&&s.gcode_state==='PAUSE'&&!!l.active&&J().matchesJob(s,l.active)};
}
function busy(id){const l=link(id);return !!(l.active&&!['complete','failed','cancelled'].includes(l.active.state))||['PREPARE','RUNNING','PAUSE'].includes(l.mqtt?.state.gcode_state);}
function canStop(id){const l=link(id);return l.active&&fresh(l)&&['sent','accepted','printing','paused'].includes(l.active.state)&&J().matchesJob(l.mqtt.state,l.active);}
function pairing(){const p=store.pairing;return {id:'this-device',name:store.deviceName||'이 크롬북',printerId:p?.printerId||null,revision:p?.revision||0,pendingJobs:[...jobs.values()].filter(j=>['ready','queued'].includes(j.state)).length};}
function publicPrinters(){const mine=store.pairing?.printerId;return store.printers.map(p=>{const s=telemetry(p.id);return {...s,paired:mine===p.id,mine:mine===p.id,available:!s.busy||mine===p.id};});}
function connectionSettings(){
 const list=store.printers.map(p=>({id:p.id,name:p.name,ip:p.ip,serial:p.serial,hasAccessCode:!!p.accessCode,...telemetry(p.id)})),id=nextId();
 if(id&&store.printers.length<MAX_PRINTERS)list.push({id,name:'새 A1 mini 등록',ip:'',serial:'',hasAccessCode:false,online:false,fresh:false,blank:true});
 return {printers:list,direct:true};
}
function summary(j,withPaths=false){const {id,name,state,mode,ticket,createdAt,completedAt,sha256,progress,layer,error,attention,bytes,printerId,clientId,pairingRevision,printOptions,upload}=j;const slice=j.slice?{...j.slice}:undefined;if(slice&&!withPaths)delete slice.paths;return {id,name,state,mode,ticket,createdAt,completedAt,sha256,progress,layer,error,attention,bytes,printerId,clientId,pairingRevision,printOptions,upload,printerName:store.printers.find(p=>p.id===printerId)?.name||printerId,telemetry:store.printers.some(p=>p.id===printerId)?telemetry(printerId):null,slice};}

// --- Printer connection (fleet.connect + waitForStatus) ---
async function connect(id){
 const p=printer(id),l=link(id);if(l.connecting)return l.connecting;
 if(l.mqtt?.online&&fresh(l)&&l.device&&['ip','serial','password'].every(k=>l.device[k]===device(p)[k])){l.error='';return;}
 if(l.active&&ACTIVE.includes(l.active.state)&&l.mqtt?.online)throw fail('출력 상태 확인 중에는 연결을 재시작하지 않습니다.');
 l.connecting=(async()=>{try{
  l.mqtt?.close();const d=device(p),mqtt=new (Link().Mqtt)(d);l.device=d;l.mqtt=mqtt;
  mqtt.on('fault',()=>{if(l.mqtt===mqtt)l.error='이 미니와 연결이 끊겼습니다. 같은 Wi-Fi·전원을 확인하세요. 자동으로 다시 연결합니다.';});mqtt.on('report',r=>report(id,r));
  await mqtt.connect();await waitForStatus(mqtt);l.lastPush=l.lastFull=Date.now();l.error='';
  try{await mqtt.publish({info:{sequence_id:'20000',command:'get_version'}});}catch{}
 }catch(e){l.mqtt?.close();l.error=e.message.startsWith('인증됐지만')?e.message:connectionError(e);throw fail(l.error);}finally{l.connecting=null;}})();
 return l.connecting;
}
function waitForStatus(mqtt,timeout=6000){
 return new Promise((resolve,reject)=>{let done=false;const t=setTimeout(()=>finish(fail('인증됐지만 실시간 상태를 받지 못했습니다. 프린터의 개발자 모드를 확인하고 다시 연결하세요.')),timeout);
  const finish=e=>{if(done)return;done=true;clearTimeout(t);e?reject(e):resolve();};
  mqtt.on('report',r=>{if(r.print&&mqtt.online)finish();});mqtt.on('fault',()=>finish(fail('상태 수신 중 연결이 끊겼습니다.')));
  mqtt.refresh().catch(()=>finish(fail('상태 요청을 보내지 못했습니다.')));});
}
function report(id,r){
 const l=link(id),j=l.active;if(!j||!l.mqtt)return;const s=l.mqtt.state;
 if(r.print?.command==='project_file'&&String(r.print.sequence_id)===j.printId&&r.print.result==='fail'){const why=[r.print.reason,r.print.err_code&&'err '+r.print.err_code].filter(Boolean).join(' · ').replace(/[^\x20-\x7e가-힣]/g,'').slice(0,80);j.state='failed';j.attention='이 미니가 시작 요청을 거절했습니다. 본체를 확인하세요.'+(why?' ['+why+']':'');saveJob(j);return;}
 if(!['sent','accepted','printing','paused','uncertain'].includes(j.state))return;
 if(!J().matchesJob(s,j)){if(j.state==='uncertain'||!r.print||s.subtask_id===undefined)return;if(['PREPARE','RUNNING','PAUSE'].includes(s.gcode_state)&&j.seenRunning){j.state='uncertain';j.attention='다른 출력이 시작됐습니다. 이 미니의 본체를 확인하세요.';saveJob(j);}return;}
 if(['PREPARE','RUNNING'].includes(s.gcode_state))j.seenRunning=true;
 if(s.gcode_state==='FINISH'&&j.seenRunning)j.state='complete';else if(s.gcode_state==='FAILED')j.state='failed';else if(s.gcode_state==='PAUSE')j.state='paused';else if(s.gcode_state==='RUNNING'&&Number(s.layer_num)>0)j.state='printing';else if(['PREPARE','RUNNING'].includes(s.gcode_state))j.state='accepted';
 if(j.state==='complete'&&!j.completedAt)j.completedAt=new Date().toISOString();j.progress=j.state==='complete'?100:Number(s.mc_percent)||0;j.layer=Number(s.layer_num)||0;j.attention=J().attention(s);
 if(j.state==='failed'&&Number(s.print_error)>0)j.attention=(j.attention||'프린터가 출력을 멈췄습니다.')+' [오류 '+Number(s.print_error).toString(16).toUpperCase().padStart(8,'0')+']';saveJob(j);
}
// Bambu Studio sends pushall at most every few seconds and as a 5-minute keepalive; A1/P1 otherwise report deltas only.
function tick(){
 for(const [id,l] of links){
  if(!store.printers.some(p=>p.id===id))continue;
  if(l.mqtt?.online){const quiet=Date.now()-l.mqtt.lastReportAt>8000,stale=Date.now()-l.lastFull>300000,tracking=!!l.active&&[...ACTIVE,'uncertain'].includes(l.active.state);
   // While a job runs, ask for a full report every 10 s (as the relay does) so subtask/job matching stays current.
   if((quiet&&Date.now()-l.lastPush>5000)||(tracking&&Date.now()-l.lastPush>10000)||stale){l.lastPush=Date.now();if(stale)l.lastFull=Date.now();l.mqtt.refresh().catch(()=>{});}}
  else if(!l.connecting&&id===store.pairing?.printerId&&Date.now()-(l.retryAt||0)>15000){l.retryAt=Date.now();connect(id).catch(()=>{});}
 }
}

// --- Jobs (direct-print.cjs + fleet.start) ---
function ownJob(j){if(!j)throw fail('이 기기의 작업을 찾을 수 없습니다.',404);if(j.printerId!==store.pairing?.printerId||j.pairingRevision!==store.pairing?.revision)throw fail('프린터 선택이 바뀌었습니다. 작품을 다시 준비해주세요.');}
async function createJob(body,studio){
 const pair=store.pairing;if(!pair?.printerId)throw fail('먼저 이 크롬북과 사용할 A1 mini를 연결해주세요.');const p=printer(pair.printerId);
 if(jobs.size>=60)for(const [id,j] of jobs)if(!ACTIVE.includes(j.state)&&j.state!=='uncertain'){jobs.delete(id);files.delete(id);if(jobs.size<50)break;}
 const result=await J().prepareJob(body,{studio,machine:root.A1_MINI_MACHINE});
 if(store.pairing?.printerId!==pair.printerId||store.pairing.revision!==pair.revision)throw fail('매칭이 변경됐습니다. 새 미니를 확인하고 다시 준비해주세요.');
 const id=hex(12),name=String(body.name||'나의 작품').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ]/g,'').slice(0,16)||'나의 작품';
 for(const old of jobs.values())if(['ready','queued'].includes(old.state)&&!old.startAttempted){old.state='cancelled';files.delete(old.id);}
 const j={id,name,state:'ready',createdAt:new Date().toISOString(),dimensions:result.dimensions,bytes:result.bytes.length,sha256:result.sha256,slice:result.slice,clientId:'this-device',printerId:p.id,printerSerial:p.serial,pairingRevision:pair.revision};
 jobs.set(id,j);files.set(id,result.bytes);saveJob(j);return j;
}
function startJob(j,body){
 ownJob(j);const l=link(j.printerId),options=J().printOptions(body.printOptions);
 if(body.ready!==true||body.sha256!==j.sha256)throw fail('빈 베드·텍스처 PEI·0.4mm 노즐·외부 PLA를 준비한 뒤 눌러주세요.');
 if(j.mode==='direct'&&l.active===j&&[...ACTIVE,'uncertain'].includes(j.state)){if(JSON.stringify(J().printOptions(j.printOptions))!==JSON.stringify(options))throw fail('시작한 출력의 보정 설정은 바꿀 수 없습니다.');return;}
 if(!['ready','queued'].includes(j.state)||j.startAttempted)throw fail('이미 처리한 작업입니다. 현재 출력 상태를 확인해주세요.');
 const p=printer(j.printerId),bytes=files.get(j.id);if(!bytes)throw fail('출력 파일이 없습니다. 다시 준비해주세요.');if(j.printerSerial!==p.serial)throw fail('이 작품을 준비한 뒤 프린터 설정이 바뀌었습니다. 다시 준비해주세요.');
 const previous=j.state;j.state='queued';
 try{J().checkStart(j,{sha256:j.sha256,bedClear:true,plaReady:true},l.mqtt,l.active);J().checkFilament(l.mqtt.state);}catch(e){j.state=previous;throw fail(e.message);}
 j.mode='direct';j.printOptions={...options};j.state='uploading';j.upload=0;l.active=j;saveJob(j);
 (async()=>{const ftp=new (Link().Ftps)(l.device);
  let stage='connect';
  try{await ftp.connect();stage='upload';const remote='click_'+j.id+'.3mf';for(let attempt=1;;attempt++){try{await ftp.upload(remote,bytes,f=>{j.upload=Math.round(f*100);});break;}catch(e){if(e.code!=='FTPS_SIZE_MISMATCH'||attempt>=3)throw e;j.upload=0;}}
   // A1 mini often goes quiet during a long upload; fetch a fresh report before the final check instead of failing on stale state.
   stage='ready';if(Date.now()-l.mqtt.lastReportAt>5000){l.lastPush=Date.now();await waitForStatus(l.mqtt,10000).catch(()=>{});}
   J().checkReady(l.mqtt);J().checkFilament(l.mqtt.state);stage='start';
   // Firmware reports subtask_id as a signed 32-bit integer; millisecond timestamps overflow.
   j.printId=String(1+Math.floor(Math.random()*0x7ffffffe));j.startAttempted=true;j.state='sent';saveJob(j);l.lastPush=0;
   await l.mqtt.publish({print:{sequence_id:j.printId,command:'project_file',param:'Metadata/plate_1.gcode',url:'ftp://'+remote,file:remote,md5:'',bed_type:'textured_plate',timelapse:false,bed_leveling:options.bedLeveling,flow_cali:options.flowCalibration,vibration_cali:true,layer_inspect:false,use_ams:false,ams_mapping:[-1],subtask_name:'Click_'+j.id,profile_id:'0',project_id:'0',subtask_id:j.printId,task_id:'0'}});
   setTimeout(()=>{if(j.state==='sent'){j.state='uncertain';j.attention='시작 응답을 확인하지 못했습니다. 이 미니의 본체를 확인하세요.';saveJob(j);}},30000);
  }catch(e){j.state=j.startAttempted?'uncertain':'failed';
   // Keep the underlying step and code visible so a failure on a real printer can be told apart (TLS, FTPS reply, stale status…).
   const code=e?.code||'',detail=code?code+(e.ftpReply?' '+e.ftpReply:''):'';
   j.error=j.startAttempted?'시작 결과를 이 미니의 본체에서 확인하세요.':stage==='ready'?'파일은 보냈지만 출력 전 확인에서 멈췄어요: '+e.message:'이 미니로 파일 전송 실패: '+(e.message||'알 수 없는 오류');
   j.failure={stage,code:detail.slice(0,120)};if(detail)j.error+=' ['+({connect:'연결',upload:'전송',ready:'확인',start:'시작'}[stage])+' · '+detail.slice(0,80)+']';
   j.attention=j.error;l.error=j.error;saveJob(j);console.warn('Click direct print failed',stage,code,e);}
  finally{await ftp.close().catch(()=>{});}})();
}
// Printer controls Bambu Studio offers for the current job: pause/resume/stop, speed level, toolhead light.
async function control(body){
 const id=store.pairing?.printerId;if(!id)throw fail('연결된 프린터가 없습니다.');const l=link(id),s=telemetry(id);if(!s.fresh)throw fail('프린터의 최신 상태를 확인할 수 없습니다.');
 const seq=String(20000+Math.floor(Math.random()*10000));
 if(body.action==='pause'){if(!s.canPause)throw fail('이 기기에서 시작한 출력 중에만 일시 정지할 수 있습니다.');await l.mqtt.publish({print:{sequence_id:seq,command:'pause',param:''}});}
 else if(body.action==='resume'){if(!s.canResume)throw fail('일시 정지된 이 기기의 출력만 재개할 수 있습니다.');await l.mqtt.publish({print:{sequence_id:seq,command:'resume',param:''}});}
 else if(body.action==='speed'){const v=Number(body.value);if(![1,2,3,4].includes(v))throw fail('속도 단계를 확인하세요.');if(!s.canPause&&!s.canResume)throw fail('이 기기에서 시작한 출력 중에만 속도를 바꿀 수 있습니다.');await l.mqtt.publish({print:{sequence_id:seq,command:'print_speed',param:String(v)}});}
 else if(body.action==='light'){const mode=body.value==='on'?'on':'off';await l.mqtt.publish({system:{sequence_id:seq,command:'ledctrl',led_node:'chamber_light',led_mode:mode,led_on_time:500,led_off_time:500,loop_times:0,interval_time:0}});}
 else throw fail('지원하지 않는 프린터 조작입니다.');
 l.mqtt.refresh().catch(()=>{});return {sent:true,action:body.action};
}

async function discover(body){
 if(searching)throw fail('이미 프린터를 찾고 있습니다. 잠시 기다려주세요.');searching=true;
 try{
  if(body?.mode==='probe')return {printers:[await Find().probe(String(body.ip||'').trim(),{ca:root.BAMBU_CA_PEM})],method:'probe'};
  let printers=[],method='ssdp';try{printers=await Find().listen({timeoutMs:6000});}catch{}
  if(!printers.some(p=>p.supported)||body?.mode==='scan'){method='scan';const scanned=await Find().scan({ca:root.BAMBU_CA_PEM});for(const p of scanned)if(!printers.some(x=>x.serial===p.serial))printers.push(p);}
  return {printers:printers.filter(p=>p.supported),others:printers.filter(p=>!p.supported).map(p=>p.model),method};
 }catch(e){throw fail(e.message);}finally{searching=false;}
}
async function saveConnection(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw fail('프린터 연결 설정을 확인하세요.');
 const id=String(body.printerId||''),existing=store.printers.find(p=>p.id===id);if(!existing&&id!==nextId())throw fail('등록할 프린터 칸을 다시 선택하세요.');
 if(existing&&(busy(id)||link(id).connecting))throw fail('연결 또는 출력 상태 확인 중입니다. 잠시 뒤 다시 시도하세요.');
 if(body.remove===true){if(!existing)throw fail('삭제할 프린터가 없습니다.');link(id).mqtt?.close();links.delete(id);store.printers=store.printers.filter(p=>p.id!==id);if(store.pairing?.printerId===id)store.pairing=null;persist();return {removed:true,printerId:id};}
 const ip=typeof body.ip==='string'?body.ip.trim():'',serial=typeof body.serial==='string'?body.serial.trim():'',entered=typeof body.accessCode==='string'?body.accessCode.trim():'';
 if(!Find().privateIPv4(ip)||!/^[a-zA-Z0-9_-]{5,40}$/.test(serial))throw fail('같은 Wi-Fi의 프린터 IP와 일련번호를 확인하세요.');
 if(store.printers.some(p=>p.id!==id&&(p.ip===ip||p.serial===serial)))throw fail('이미 다른 칸에 등록된 프린터입니다.');
 if(entered&&!/^[a-zA-Z0-9]{8}$/.test(entered))throw fail('프린터에 표시된 LAN 액세스 코드 8자리를 입력하세요.');
 const accessCode=entered||(existing&&serial===existing.serial?existing.accessCode:'');if(!accessCode)throw fail('프린터에 표시된 현재 LAN 액세스 코드를 입력하세요.');
 const name=existing?.name&&existing.serial===serial?existing.name:'A1 mini '+serial.slice(-4),record={id,name,ip,serial,accessCode};
 store.printers=existing?store.printers.map(p=>p.id===id?record:p):[...store.printers,record];persist();
 const l=link(id);l.mqtt?.close();l.mqtt=null;l.device=null;l.error='';
 try{await connect(id);}catch(e){throw fail('설정은 저장했지만 연결을 완료하지 못했어요. '+e.message);}
 // One Chromebook ↔ one printer: the first working printer becomes this Chromebook's printer automatically.
 if(!store.pairing?.printerId)pair({printerId:id});
 return {saved:true,connected:true,statusReceived:true,printerId:id,paired:store.pairing?.printerId===id};
}
function pair(body,release=false){
 const current=store.pairing;if(current?.printerId&&busy(current.printerId)&&(release||body.printerId!==current.printerId))throw fail('출력 중에는 프린터를 바꿀 수 없습니다.');
 if(!release){const p=printer(body.printerId);if(busy(p.id)&&current?.printerId!==p.id)throw fail('이 미니는 지금 출력 중입니다. 끝난 뒤 선택하세요.');}
 if(typeof body.name==='string'&&body.name.trim())store.deviceName=body.name.replace(/[\x00-\x1f]/g,'').trim().slice(0,24);
 if(release||current?.printerId!==body.printerId){for(const j of jobs.values())if(['ready','queued'].includes(j.state)){j.state='cancelled';j.attention='프린터 매칭 변경으로 준비한 작업을 취소했습니다.';files.delete(j.id);}
  store.pairing=release?null:{printerId:body.printerId,revision:(current?.revision||0)+1};persist();}
 if(store.pairing?.printerId)connect(store.pairing.printerId).catch(()=>{});
 return {pairing:pairing(),printers:publicPrinters()};
}
async function recordExperiences(body){
 const list=body?.experiences;if(!Array.isArray(list)||list.length<1||list.length>50)throw fail('체험 기록은 한 번에 1~50개씩 보내주세요.');
 for(const e of list){if(!/^[a-f0-9]{64}$/.test(e?.id||'')||!Number.isFinite(Date.parse(e.at)))throw fail('체험 시작 기록을 확인하세요.');const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(e.id))),b=>b.toString(16).padStart(2,'0')).join('');if(!statistics.experiences[key])statistics.experiences[key]={at:new Date(e.at).toISOString()};}
 saveStats();return Counts().summary(statistics);
}

async function handle(method,route,body){
 const url=new URL(route,'http://direct.invalid'),path=url.pathname;
 if(method==='GET'&&path==='/api/bootstrap')return {app:'click-workshop',csrf:'direct',version:8,stlStudio:true,printerDiscovery:true,setupGuide:true,direct:true,statistics:Counts().summary(statistics),studioAvailable:false,operator:true,booth:false,pairing:pairing(),printers:publicPrinters()};
 if(method==='GET'&&path==='/api/printers')return {pairing:pairing(),printers:publicPrinters()};
 if(method==='GET'&&path==='/api/statistics')return Counts().summary(statistics);
 if(method==='GET'&&path==='/api/connection-settings')return connectionSettings();
 if(method==='GET'&&path==='/api/booth-links')return {enabled:false,links:null};
 const m=/^\/api\/jobs\/([a-f0-9]{24})(?:\/(print|stop|discard|download))?$/.exec(path),j=m?jobs.get(m[1]):null;
 if(m&&!j)throw fail('이 기기의 작업을 찾을 수 없습니다.',404);
 if(method==='GET'&&m&&!m[2])return summary(j,true);
 if(method==='GET'&&m?.[2]==='download'){const bytes=files.get(j.id);if(!bytes)throw fail('파일이 없습니다. 다시 준비해주세요.');return new Blob([bytes],{type:'application/octet-stream'});}
 if(method!=='POST')throw fail('Not found',404);
 if(path==='/api/studio-jobs'||path==='/api/browser-jobs')return summary(await createJob(body,path==='/api/studio-jobs'),true);
 if(path==='/api/discover-printers')return discover(body);
 if(path==='/api/connection-settings'){const result=await saveConnection(body);return {...result,printers:publicPrinters(),pairing:pairing()};}
 if(path==='/api/pair')return pair(body);
 if(path==='/api/unpair')return pair(body||{},true);
 if(path==='/api/printer-control')return control(body||{});
 if(path==='/api/experiences')return recordExperiences(body);
 if(m?.[2]==='print'){startJob(j,body||{});return summary(j,true);}
 if(m?.[2]==='stop'){ownJob(j);if(link(j.printerId).active!==j||!canStop(j.printerId))throw fail('현재 출력과 일치하지 않습니다. 프린터 본체를 확인하세요.');await link(j.printerId).mqtt.publish({print:{sequence_id:String(20000+Math.floor(Math.random()*10000)),command:'stop',param:''}});return {sent:true,printerId:j.printerId};}
 if(m?.[2]==='discard'){if(!['ready','queued'].includes(j.state)||j.startAttempted)throw fail('출력 중이거나 처리한 작업은 취소할 수 없습니다.');j.state='cancelled';files.delete(j.id);saveJob(j);return summary(j);}
 if(['/api/unlock','/api/operator','/api/connect','/api/stop','/api/release-pairing','/api/slice'].includes(path)||m)throw fail('이 크롬북 앱은 프린터와 직접 연결되어 운영자 PIN·출력 PC 기능이 필요하지 않습니다.',404);
 throw fail('Not found',404);
}
// fetch()-compatible entry point used by StudioAPI and the booth connection when the app runs installed.
async function fetchRoute(route,options={}){
 start();const method=(options.method||'GET').toUpperCase();let body;
 try{if(options.body!==undefined&&options.body!==null)body=JSON.parse(options.body);}catch{return new Response(JSON.stringify({error:'요청 형식이 올바르지 않습니다.'}),{status:400,headers:{'Content-Type':'application/json'}});}
 try{const result=await handle(method,route,body);if(result instanceof Blob)return new Response(result,{status:200});return new Response(JSON.stringify(result),{status:route.endsWith('/print')?202:200,headers:{'Content-Type':'application/json'}});}
 catch(e){return new Response(JSON.stringify({error:e.status?e.message:'요청을 처리하지 못했습니다. '+(e.message||'')}),{status:e.status||409,headers:{'Content-Type':'application/json'}});}
}
let started=false;
function start(){if(started)return;started=true;statistics=loadStats();restoreJobs();if(store.pairing?.printerId&&store.printers.some(p=>p.id===store.pairing.printerId))connect(store.pairing.printerId).catch(()=>{});timer=setInterval(tick,2500);}
function enabled(){if(!root.DirectSockets?.available())return false;try{return new URLSearchParams(root.location?.search||'').get('relay')!=='1';}catch{return true;}}
function reset(){clearInterval(timer);for(const l of links.values())l.mqtt?.close();links.clear();jobs.clear();files.clear();started=false;store=load();statistics=null;}
const api={enabled,fetch:fetchRoute,handle,start,reset,telemetry,get store(){return store;}};root.DirectRelay=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
