const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const net=require('node:net');
const {Mqtt,Ftps}=require('./transport.cjs');
const {verifyMini}=require('./discovery.cjs');
const {makeAccess}=require('./access.cjs');
const {serveDownload}=require('./downloads.cjs');
const {validateSTL,sliceSTL,checkReady,checkStart,matchesJob,attention}=require('./core.cjs');
const root=path.resolve(__dirname,'..'),runtime=process.env.CLICK_RUNTIME?path.resolve(process.env.CLICK_RUNTIME):path.join(root,'runtime');fs.mkdirSync(runtime,{recursive:true});
const cfgPath=path.join(runtime,'config.json');let config=fs.existsSync(cfgPath)?JSON.parse(fs.readFileSync(cfgPath,'utf8')):{};
if(!/^\d{6,12}$/.test(config.operatorPin||'')){config.operatorPin=String(crypto.randomInt(100000,1000000));fs.writeFileSync(cfgPath,JSON.stringify(config,null,2));}
const port=Number(process.env.CLICK_PORT||config.port||5188);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
const access=makeAccess(config,port),origin=access.origin,csrf=crypto.randomBytes(32).toString('hex'),sessions=new Map(),jobs=new Map();let mqtt=null,device=null,lastError='',connecting=false,active=null,slicing=false,attempts=[];
const sliceQueue=[];let uploads=0;
const jobRoot=path.join(runtime,'jobs');fs.mkdirSync(jobRoot,{recursive:true});
for(const entry of fs.readdirSync(jobRoot)){if(!/^[a-f0-9]{24}$/.test(entry))continue;try{const j=JSON.parse(fs.readFileSync(path.join(jobRoot,entry,'job.json'),'utf8'));if(['slice_wait','slicing'].includes(j.state)){j.state='failed';j.error='공방이 종료되어 슬라이싱이 중단됐습니다.';}if(['uploading','sent','accepted','printing','paused'].includes(j.state)){j.state='uncertain';j.attention='공방이 재시작됐습니다. 이전 출력을 본체에서 확인하세요. 자동 재전송하지 않습니다.';}jobs.set(j.id,j);}catch{}}
function save(j){const dir=path.join(jobRoot,j.id);fs.mkdirSync(dir,{recursive:true});const temp=path.join(dir,'job.tmp');fs.writeFileSync(temp,JSON.stringify(j));fs.renameSync(temp,path.join(dir,'job.json'));}
function drainSlices(){if(slicing||!sliceQueue.length)return;const j=sliceQueue.shift();slicing=true;j.state='slicing';save(j);sliceSTL(path.join(jobRoot,j.id),config).then(result=>{Object.assign(j,result,{state:'ready'});save(j);}).catch(e=>{j.state='failed';j.error=e.message;save(j);}).finally(()=>{slicing=false;drainSlices();});}
function log(type,detail={}){fs.appendFileSync(path.join(runtime,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),type,...detail})+'\n');}
function summary(j,withPaths=false){const {id,name,state,ticket,createdAt,sha256,progress,layer,error,attention:note,bytes}=j;const slice=j.slice?{...j.slice}:undefined;if(slice&&!withPaths)delete slice.paths;return {id,name,state,ticket,createdAt,sha256,progress,layer,error,attention:note,bytes,slice};}
function getDevice(){const p=config.printer;if(!p?.ip||!p?.serial)throw Error('runtime/config.json에 프린터 IP와 일련번호를 설정하세요.');if(net.isIP(p.ip)!==4||!(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(p.ip)))throw Error('사설 IPv4 프린터 주소가 필요합니다.');if(!/^[a-zA-Z0-9_-]{5,40}$/.test(p.serial))throw Error('프린터 일련번호가 올바르지 않습니다.');let password=p.accessCode;
 if(!password&&process.env.APPDATA){try{const text=fs.readFileSync(path.join(process.env.APPDATA,'BambuStudio','BambuStudio.conf'),'utf8');const c=JSON.parse(text.split(/\r?\n/).filter(s=>!/^\s*#/.test(s)).join('\n'));password=c.user_access_code?.[p.serial]||c.access_code?.[p.serial];}catch{}}
 if(!password||/[\r\n]/.test(password))throw Error('Bambu Studio에 프린터를 등록하거나 비공개 config.json에 accessCode를 입력하세요.');return {ip:p.ip,serial:p.serial,password,ca:fs.readFileSync(path.join(__dirname,'bambu-ca.pem'))};}
async function connect(){if(connecting)throw Error('연결 중입니다.');if(active&&!['complete','failed','uncertain'].includes(active.state))throw Error('출력 상태 확인 중에는 연결을 재시작하지 않습니다.');connecting=true;try{const next=getDevice();await verifyMini(next);mqtt?.close();device=next;mqtt=new Mqtt(device);mqtt.on('fault',()=>{lastError='프린터 연결이 끊겼습니다. LAN 모드·IP·접근 코드를 확인하세요.';});mqtt.on('report',onReport);await mqtt.connect();mqtt.refresh();lastError='';}finally{connecting=false;}}
function onReport(report){if(!active)return;const s=mqtt.state,j=active;const correlated=matchesJob(s,j);
 if(report.print?.command==='project_file'&&String(report.print.sequence_id)===j.printId&&report.print.result==='fail'){j.state='failed';j.attention='프린터가 시작 요청을 거절했습니다. 본체를 확인하세요.';save(j);return;}
 if(!correlated)return;if(!['sent','accepted','printing','paused'].includes(j.state))return;
 if(['PREPARE','RUNNING'].includes(s.gcode_state))j.seenRunning=true;
 if(s.gcode_state==='FINISH'&&j.seenRunning)j.state='complete';else if(s.gcode_state==='FAILED')j.state='failed';else if(s.gcode_state==='PAUSE')j.state='paused';else if(s.gcode_state==='RUNNING'&&Number(s.layer_num)>0)j.state='printing';else j.state='accepted';
 j.progress=Number(s.mc_percent)||0;j.layer=Number(s.layer_num)||0;j.attention=attention(s);save(j);
}
function auth(req){const expiry=sessions.get(req.headers['x-operator-token']);if(!access.isOperator(req)||!expiry||expiry<Date.now()){const error=Error('출력 PC의 운영자 화면에서 잠금을 해제하세요.');error.status=401;throw error;}}
function reply(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});res.end(JSON.stringify(value));}
async function readBody(req,max=8192){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>max){const e=Error('요청이 너무 큽니다.');e.status=413;throw e;}chunks.push(c);}return Buffer.concat(chunks);}
async function start(j,body){
 checkStart(j,body,mqtt,active);
 const file=fs.readFileSync(path.join(jobRoot,j.id,'print.gcode.3mf'));if(crypto.createHash('sha256').update(file).digest('hex')!==j.sha256)throw Error('슬라이싱 파일이 변경됐습니다.');
 j.state='uploading';active=j;save(j);const ftp=new Ftps(device);
 try{await ftp.connect();await ftp.upload('click_'+j.id+'.3mf',file);checkReady(mqtt);j.printId=String(Date.now());j.startAttempted=true;j.state='sent';save(j);log('start_command',{job:j.id,sha256:j.sha256});const remote='click_'+j.id+'.3mf';mqtt.publish({print:{sequence_id:j.printId,command:'project_file',param:'Metadata/plate_1.gcode',url:'ftp://'+remote,file:remote,md5:'',bed_type:'textured_plate',timelapse:false,bed_leveling:true,flow_cali:true,vibration_cali:true,layer_inspect:false,use_ams:false,ams_mapping:[-1],subtask_name:'Click_'+j.id,profile_id:'0',project_id:'0',subtask_id:j.printId,task_id:'0'}});
  setTimeout(()=>{if(j.state==='sent'){j.state='uncertain';j.attention='시작 응답을 확인하지 못했습니다. 재전송하지 말고 프린터 본체를 확인하세요.';save(j);}},30000);
 }catch(e){j.state=j.startAttempted?'uncertain':'failed';j.error=j.startAttempted?'시작 결과를 본체에서 확인하세요.':'파일 전송 실패. 연결과 SD 카드를 확인하세요.';save(j);throw Error(j.error);}finally{ftp.close();}
}
function canStop(){return active&&mqtt?.online&&Date.now()-mqtt.lastReportAt<15000&&['sent','accepted','printing','paused'].includes(active.state)&&matchesJob(mqtt.state,active);}
const server=http.createServer(async(req,res)=>{try{
 if(!access.hosts.has(req.headers.host))return reply(res,403,{error:'설정된 공방 주소로 접속하세요.'});
 const url=new URL(req.url,origin),route=url.pathname;
 if(serveDownload(req,res,root))return;
 if(route.startsWith('/api/')&&!access.cors(req,res))return reply(res,403,{error:'허용된 부스 사이트에서 연결하세요.'});
 if(req.method==='OPTIONS'&&route.startsWith('/api/')){if(!access.allowedOrigin(req.headers.origin))return reply(res,403,{error:'부스 사이트를 확인하세요.'});res.writeHead(204);return res.end();}
 if(req.method==='GET'&&(route==='/'||route==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'"});return fs.createReadStream(path.join(root,'index.html')).pipe(res);}
 if(req.method==='GET'&&route==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(route.startsWith('/api/')&&!access.participant(req))return reply(res,403,{error:'운영자가 공유한 부스 링크로 접속하세요.'});
 if(req.method==='GET'&&route==='/api/bootstrap')return reply(res,200,{app:'click-workshop',csrf,version:3,operator:access.isOperator(req),booth:access.booth,boothOrigin:access.lanOrigin});
 if(req.method==='GET'&&route==='/api/booth-links'){auth(req);return reply(res,200,{enabled:access.booth,links:access.links()});}
 if(req.method==='GET'&&route==='/api/operator'){auth(req);return reply(res,200,{printer:{online:!!mqtt?.online,fresh:!!mqtt&&Date.now()-mqtt.lastReportAt<15000,state:mqtt?.state.gcode_state,attention:attention(mqtt?.state)},error:lastError,jobs:[...jobs.values()].filter(j=>j.ticket).sort((a,b)=>b.ticket-a.ticket).map(j=>summary(j)),canStop:!!canStop()});}
 const match=/^\/api\/jobs\/([a-f0-9]{24})(?:\/(queue|start|cancel|resolve|file))?$/.exec(route);const j=match?jobs.get(match[1]):null;
 if(match&&!j)return reply(res,404,{error:'작업을 찾을 수 없습니다.'});
 if(req.method==='GET'&&match&&!match[2])return reply(res,200,summary(j,true));
 if(req.method==='GET'&&match?.[2]==='file'){auth(req);if(!j.slice)throw Error('슬라이싱 결과가 없습니다.');res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Disposition':'attachment; filename="click.gcode.3mf"'});return fs.createReadStream(path.join(jobRoot,j.id,'print.gcode.3mf')).pipe(res);}
 if(req.method!=='POST')return reply(res,404,{error:'Not found'});
 if(!access.allowedOrigin(req.headers.origin)||req.headers['x-click-token']!==csrf)return reply(res,403,{error:'공방 연결 세션이 필요합니다.'});
 if(route==='/api/slice'){
  if(sliceQueue.length+(slicing?1:0)+uploads>=12)throw Error('계산 대기 중인 작품이 많아요. 잠시 뒤 다시 눌러주세요.');if(jobs.size+uploads>=200)throw Error('작업 보관함이 가득 찼습니다. 운영자가 runtime/jobs를 백업하고 정리하세요.');if(req.headers['content-type']!=='application/octet-stream')throw Error('바이너리 STL이 필요합니다.');uploads++;
  let bytes,info;try{bytes=await readBody(req,6*1024*1024);info=validateSTL(bytes);}finally{uploads--;}
  let name='나의 작품';try{name=decodeURIComponent(req.headers['x-model-name']||'').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ]/g,'').slice(0,16)||name;}catch{}
  const id=crypto.randomBytes(12).toString('hex'),job={id,name,state:'slice_wait',createdAt:new Date().toISOString(),dimensions:info};const dir=path.join(jobRoot,id);jobs.set(id,job);save(job);fs.writeFileSync(path.join(dir,'model.stl'),bytes);sliceQueue.push(job);reply(res,202,summary(job));drainSlices();return;
 }
 if(req.headers['content-type']!=='application/json')return reply(res,415,{error:'JSON required'});const body=JSON.parse((await readBody(req)).toString()||'{}');
 if(route==='/api/unlock'){if(!access.isOperator(req))return reply(res,403,{error:'운영자 잠금 해제는 출력 PC에서만 가능합니다.'});attempts=attempts.filter(t=>Date.now()-t<60000);if(attempts.length>=5)return reply(res,429,{error:'잠시 후 다시 시도하세요.'});attempts.push(Date.now());const supplied=Buffer.from(String(body.pin||'')),expected=Buffer.from(config.operatorPin);if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return reply(res,401,{error:'운영자 PIN을 확인하세요.'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+30*60000);return reply(res,200,{token});}
 if(match?.[2]==='queue'){if(j.ticket)return reply(res,200,summary(j,true));if(j.state!=='ready')throw Error('먼저 슬라이싱을 완료하세요.');j.ticket=Math.max(0,...[...jobs.values()].map(x=>x.ticket||0))+1;j.state='queued';save(j);return reply(res,200,summary(j,true));}
 auth(req);
 if(route==='/api/connect'){await connect();return reply(res,200,{connected:true});}
 if(match?.[2]==='start'){checkStart(j,body,mqtt,active);const pending=start(j,body);reply(res,202,{accepted:true});pending.catch(e=>{lastError=e.message;});return;}
 if(match?.[2]==='cancel'){if(j.state!=='queued')throw Error('대기 중인 작업만 취소할 수 있습니다.');j.state='cancelled';save(j);return reply(res,200,summary(j));}
 if(match?.[2]==='resolve'){if(j.state!=='uncertain')throw Error('확인이 필요한 작업만 정리할 수 있습니다.');checkReady(mqtt);if(body.bedClear!==true||body.plaReady!==true)throw Error('본체와 빈 베드를 직접 확인하세요.');j.state='cancelled';j.attention='운영자가 현장에서 확인하고 작업을 닫았습니다.';save(j);return reply(res,200,summary(j));}
 if(route==='/api/stop'){if(!canStop())throw Error('현재 공방 작업과 프린터 상태가 일치하지 않습니다. 본체에서 중지하세요.');mqtt.publish({print:{sequence_id:String(Date.now()),command:'stop',param:''}});log('stop_requested',{job:active.id});return reply(res,202,{sent:true});}
 return reply(res,404,{error:'Not found'});
 }catch(e){if(!res.headersSent)reply(res,e.status||409,{error:e.message});else res.end();}});
server.requestTimeout=20000;server.headersTimeout=10000;
const refresh=setInterval(()=>{if(mqtt?.online)try{mqtt.refresh();}catch{}for(const [token,expiry] of sessions)if(expiry<Date.now())sessions.delete(token);},10000);
server.listen(port,access.bind,()=>{const links=access.links();if(links)fs.writeFileSync(path.join(runtime,'booth-links.json'),JSON.stringify(links,null,2));console.log('상상을 클릭하다! '+origin+'\n운영자 PIN: '+config.operatorPin+'\n'+(access.booth?'부스 접속: 운영자 화면에서 참가자 링크를 복사하세요.':'개별 PC 모드. 크롬북 부스 연결은 setup.cjs --booth로 설정하세요.')+'\n학교 프린터 정보와 출력 파일은 runtime/에만 저장합니다.');if(config.printer?.ip)connect().catch(e=>{lastError=e.message;console.log('프린터 연결 대기: 비공개 설정을 확인하세요.');});});
function close(){clearInterval(refresh);mqtt?.close();server.close(()=>process.exit(0));}process.on('SIGINT',close);process.on('SIGTERM',close);
