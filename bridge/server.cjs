const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {makeAccess,equalSecret}=require('./access.cjs');const {serveDownload}=require('./downloads.cjs');const {validateSTL,sliceSTL}=require('./core.cjs');const {printerDefinitions}=require('./printers.cjs');const {Pairings,clientId}=require('./pairings.cjs');const {Fleet}=require('./fleet.cjs');
const {prepareBrowserJob,prepareStudioJob}=require('./browser-job.cjs');
const {connectionSettings,saveConnection}=require('./connection-settings.cjs');
const {discoverMinis}=require('./discovery.cjs');let printerSearch=null;
const {directPrint,stopOwnJob}=require('./direct-print.cjs');
const {Statistics}=require('./statistics.cjs');
const root=path.resolve(__dirname,'..'),runtime=process.env.CLICK_RUNTIME?path.resolve(process.env.CLICK_RUNTIME):path.join(root,'runtime');fs.mkdirSync(runtime,{recursive:true});
const statistics=new Statistics(path.join(runtime,'statistics.json'));
const cfgPath=path.join(runtime,'config.json'),config=fs.existsSync(cfgPath)?JSON.parse(fs.readFileSync(cfgPath,'utf8')):{};
if(!/^\d{6,12}$/.test(config.operatorPin||'')){config.operatorPin=String(crypto.randomInt(100000,1000000));fs.writeFileSync(cfgPath,JSON.stringify(config,null,2));}
const port=Number(process.env.CLICK_PORT||config.port||5188);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
const access=makeAccess(config,port),origin=access.origin,csrf=crypto.randomBytes(32).toString('hex'),printers=printerDefinitions(config),sessions=new Map(),jobs=new Map(),attempts=new Map(),sliceQueue=[];let slicing=false,uploads=0;
const jobRoot=path.join(runtime,'jobs');fs.mkdirSync(jobRoot,{recursive:true});
function save(j){const dir=path.join(jobRoot,j.id);fs.mkdirSync(dir,{recursive:true});const temp=path.join(dir,'job.tmp');fs.writeFileSync(temp,JSON.stringify(j));fs.renameSync(temp,path.join(dir,'job.json'));if(j.state==='complete')try{statistics.complete(j);}catch{log('statistics_save_failed');}}
function log(type,detail={}){fs.appendFileSync(path.join(runtime,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),type,...detail})+'\n');}
const fleet=new Fleet(printers,{jobRoot,save,log});
for(const entry of fs.readdirSync(jobRoot)){if(!/^[a-f0-9]{24}$/.test(entry))continue;try{const j=JSON.parse(fs.readFileSync(path.join(jobRoot,entry,'job.json'),'utf8'));if(['slice_wait','slicing'].includes(j.state)){j.state='failed';j.error='공방이 종료되어 슬라이싱이 중단됐습니다.';}if(['uploading','sent','accepted','printing','paused'].includes(j.state)){j.state='uncertain';j.attention='공방이 재시작됐습니다. 이 미니의 본체를 확인하세요. 자동 재전송하지 않습니다.';}if(!j.printerId&&['ready','queued'].includes(j.state)){j.state='cancelled';j.attention='1:1 프린터 매칭 후 다시 접수해주세요.';}jobs.set(j.id,j);if(j.state==='uncertain'&&fleet.items.has(j.printerId))fleet.item(j.printerId).active=j;}catch{}}
statistics.reconcile([...jobs.values()].map(j=>j.state==='complete'?{...j,completedRecordAt:fs.statSync(path.join(jobRoot,j.id,'job.json')).mtime.toISOString()}:j));
const pairings=new Pairings(path.join(runtime,'pairings.json'),printers,{busy:id=>fleet.busy(id),pending:id=>[...jobs.values()].filter(j=>j.clientId===id&&['slice_wait','slicing','ready','queued'].includes(j.state)),cancel:j=>{j.state='cancelled';j.attention='프린터 매칭 변경으로 기존 미출력 접수를 취소했습니다.';save(j);}});
function device(req){return clientId(req.headers['x-client-token']);}
function currentPair(req){return pairings.publicDevice(device(req));}
function pairingRequired(req){const d=currentPair(req);if(!d?.printerId)throw Error('먼저 이 크롬북과 사용할 미니를 매칭해주세요.');return d;}
function auth(req,job){const s=sessions.get(req.headers['x-operator-token']),local=access.isOperator(req),d=currentPair(req);
 if(!s||s.expiry<Date.now()||s.admin&&!local||!s.admin&&(!d||s.clientId!==d.id||s.printerId!==d.printerId||s.revision!==d.revision)||job&&!s.admin&&(job.clientId!==s.clientId||job.printerId!==s.printerId)){const e=Error('이 기기에 매칭된 미니의 운영자 PIN으로 잠금을 해제하세요.');e.status=401;throw e;}return s;
}
function admin(req){const scope=auth(req);if(!scope.admin){const e=Error('전체 매칭 관리는 부스 PC에서 할 수 있습니다.');e.status=403;throw e;}return scope;}
function summary(j,withPaths=false){const {id,name,state,mode,ticket,createdAt,completedAt,sha256,progress,layer,error,attention:note,bytes,printerId,clientId:owner,pairingRevision,printOptions}=j;const slice=j.slice?{...j.slice}:undefined;if(slice&&!withPaths)delete slice.paths;return {id,name,state,mode,ticket,createdAt,completedAt,sha256,progress,layer,error,attention:note,bytes,printerId,clientId:owner,pairingRevision,printOptions,printerName:fleet.items.get(printerId)?.config.name||printerId,telemetry:fleet.items.has(printerId)?fleet.state(printerId):null,slice};}
function publicPrinters(id,all=false){return printers.map(p=>{const s=fleet.state(p.id),owner=pairings.owner(p.id);return {...s,paired:!!owner,mine:owner?.id===id,available:(!owner||owner.id===id)&&!s.busy,...(all?{pairedDevice:owner?{id:owner.id,name:owner.name}:null}:{})};});}
function drainSlices(){if(slicing||!sliceQueue.length)return;const j=sliceQueue.shift();slicing=true;j.state='slicing';save(j);sliceSTL(path.join(jobRoot,j.id),config).then(result=>{Object.assign(j,result,{state:'ready'});save(j);}).catch(e=>{j.state='failed';j.error=e.message;save(j);}).finally(()=>{slicing=false;drainSlices();});}
function reply(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});res.end(JSON.stringify(value));}
async function readBody(req,max=8192){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>max){const e=Error('요청이 너무 큽니다.');e.status=413;throw e;}chunks.push(c);}return Buffer.concat(chunks);}
const server=http.createServer(async(req,res)=>{try{
 if(!access.hosts.has(req.headers.host))return reply(res,403,{error:'설정된 공방 주소로 접속하세요.'});const url=new URL(req.url,origin),route=url.pathname;if(serveDownload(req,res,root))return;
 if(route.startsWith('/api/')&&!access.cors(req,res))return reply(res,403,{error:'허용된 부스 사이트에서 연결하세요.'});
 if(req.method==='OPTIONS'&&route.startsWith('/api/')){if(!access.allowedOrigin(req.headers.origin))return reply(res,403,{error:'부스 사이트를 확인하세요.'});res.writeHead(204);return res.end();}
 if(req.method==='GET'&&['/','/index.html','/studio.html'].includes(route)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'"});return fs.createReadStream(path.join(root,route==='/studio.html'?'studio.html':'index.html')).pipe(res);}
 if(req.method==='GET'&&route==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(route.startsWith('/api/')&&!access.participant(req))return reply(res,403,{error:'운영자가 공유한 부스 링크로 접속하세요.'});
 if(req.method==='GET'&&route==='/api/bootstrap')return reply(res,200,{app:'click-workshop',csrf,version:8,stlStudio:true,printerDiscovery:true,statistics:statistics.summary(),studioAvailable:fs.existsSync(config.slicerPath||'C:/Program Files/Bambu Studio/bambu-studio.exe'),desktopInstance:process.env.CLICK_DESKTOP_INSTANCE||undefined,operator:access.isOperator(req),booth:access.booth,boothOrigin:access.lanOrigin,pairing:currentPair(req),printers:publicPrinters(device(req))});
 if(req.method==='GET'&&route==='/api/statistics')return reply(res,200,statistics.summary());
 if(req.method==='GET'&&route==='/api/printers')return reply(res,200,{pairing:currentPair(req),printers:publicPrinters(device(req))});
 if(req.method==='GET'&&route==='/api/connection-settings'){
  if(!access.isOperator(req))return reply(res,403,{error:'프린터 연결 설정은 출력 PC에서 열어주세요.'});
  return reply(res,200,connectionSettings(printers,fleet));
 }
 if(req.method==='GET'&&route==='/api/booth-links'){admin(req);return reply(res,200,{enabled:access.booth,links:access.links()});}
 if(req.method==='GET'&&route==='/api/operator'){const s=auth(req),list=publicPrinters(device(req),s.admin).filter(p=>s.admin||p.id===s.printerId);const selected=list.find(p=>p.id===url.searchParams.get('printer'))||list[0];return reply(res,200,{admin:s.admin,printers:list,printer:selected,error:selected?.error||'',jobs:[...jobs.values()].filter(j=>(j.ticket||j.mode==='direct')&&(s.admin||j.printerId===s.printerId&&j.clientId===s.clientId)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(j=>summary(j)),canStop:selected?.canStop||false});}
 const match=/^\/api\/jobs\/([a-f0-9]{24})(?:\/(queue|print|stop|start|cancel|resolve|file|download|discard))?$/.exec(route),j=match?jobs.get(match[1]):null;
 if(match&&(!j||!access.isOperator(req)&&j.clientId!==device(req)))return reply(res,404,{error:'이 기기의 작업을 찾을 수 없습니다.'});
 if(req.method==='GET'&&match&&!match[2])return reply(res,200,summary(j,true));
 if(req.method==='GET'&&match?.[2]==='download'){if(j.clientId!==device(req))return reply(res,404,{error:'이 기기의 파일을 찾을 수 없습니다.'});if(!j.slice)throw Error('슬라이싱 파일이 없습니다.');res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Disposition':'attachment; filename="studio.gcode.3mf"'});return fs.createReadStream(path.join(jobRoot,j.id,'print.gcode.3mf')).pipe(res);}
 if(req.method==='GET'&&match?.[2]==='file'){auth(req,j);if(!j.slice)throw Error('슬라이싱 결과가 없습니다.');res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Disposition':'attachment; filename="click.gcode.3mf"'});return fs.createReadStream(path.join(jobRoot,j.id,'print.gcode.3mf')).pipe(res);}
 if(req.method!=='POST')return reply(res,404,{error:'Not found'});if(!access.allowedOrigin(req.headers.origin)||req.headers['x-click-token']!==csrf)return reply(res,403,{error:'공방 연결 세션이 필요합니다.'});
 if(route==='/api/browser-jobs'||route==='/api/studio-jobs'){
  const d=pairingRequired(req);if(jobs.size+uploads>=200||uploads>=6)throw Error('접수 중인 작품이 많아요. 잠시 뒤 다시 시도해주세요.');if(req.headers['content-type']!=='application/json')throw Error('JSON required');
  uploads++;try{const studio=route==='/api/studio-jobs',body=JSON.parse((await readBody(req,(studio?34:11)*1024*1024)).toString()),result=(studio?prepareStudioJob:prepareBrowserJob)(body),now=currentPair(req);
   if(!now||now.revision!==d.revision||now.printerId!==d.printerId)throw Error('매칭이 변경됐습니다. 새 미니를 확인하고 다시 접수해주세요.');
   const id=crypto.randomBytes(12).toString('hex'),name=String(body.name||'나의 작품').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ]/g,'').slice(0,16)||'나의 작품';
   const j={id,name,state:'ready',createdAt:new Date().toISOString(),dimensions:result.dimensions,bytes:result.bytes.length,sha256:result.sha256,slice:result.slice,clientId:d.id,printerId:d.printerId,printerSerial:fleet.item(d.printerId).config.serial,pairingRevision:d.revision};
   const dir=path.join(jobRoot,id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'model.stl'),result.stl);fs.writeFileSync(path.join(dir,'print.gcode.3mf'),result.bytes);save(j);jobs.set(id,j);return reply(res,201,summary(j,true));
  }finally{uploads--;}
 }
 if(route==='/api/slice'){
  const d=pairingRequired(req);if(sliceQueue.length+(slicing?1:0)+uploads>=12)throw Error('계산 대기 중인 작품이 많아요. 잠시 뒤 다시 눌러주세요.');if(jobs.size+uploads>=200)throw Error('작업 보관함이 가득 찼습니다. 운영자가 runtime/jobs를 백업하고 정리하세요.');if(req.headers['content-type']!=='application/octet-stream')throw Error('바이너리 STL이 필요합니다.');uploads++;let bytes,info;try{bytes=await readBody(req,6*1024*1024);info=validateSTL(bytes);}finally{uploads--;}
  const now=currentPair(req);if(!now||now.revision!==d.revision||now.printerId!==d.printerId)throw Error('매칭이 변경됐습니다. 새 미니를 확인하고 다시 계산해주세요.');
  let name='나의 작품';try{name=decodeURIComponent(req.headers['x-model-name']||'').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ]/g,'').slice(0,16)||name;}catch{}
  const id=crypto.randomBytes(12).toString('hex'),job={id,name,state:'slice_wait',createdAt:new Date().toISOString(),dimensions:info,clientId:d.id,printerId:d.printerId,printerSerial:fleet.item(d.printerId).config.serial,pairingRevision:d.revision};const dir=path.join(jobRoot,id);jobs.set(id,job);save(job);fs.writeFileSync(path.join(dir,'model.stl'),bytes);sliceQueue.push(job);reply(res,202,summary(job));drainSlices();return;
 }
 if(req.headers['content-type']!=='application/json')return reply(res,415,{error:'JSON required'});const body=JSON.parse((await readBody(req)).toString()||'{}');
 if(route==='/api/experiences')return reply(res,200,statistics.record(device(req),body.experiences));
 if(route==='/api/discover-printers'){
  if(!access.isOperator(req))return reply(res,403,{error:'프린터 검색은 출력 PC에서 실행해주세요.'});
  if(printerSearch)throw Error('이미 프린터를 찾고 있습니다. 잠시 기다려주세요.');
  try{printerSearch=discoverMinis();return reply(res,200,{printers:await printerSearch});}finally{printerSearch=null;}
 }
 if(route==='/api/connection-settings'){
  if(!access.isOperator(req))return reply(res,403,{error:'프린터 연결 설정은 출력 PC에서 열어주세요.'});
  const result=await saveConnection({body,config,printers,fleet,cfgPath});
  return reply(res,200,{...result,printers:publicPrinters(device(req))});
 }
 if(route==='/api/pair')return reply(res,200,{pairing:pairings.pair(device(req),body.printerId,body.name,body.discardPending===true),printers:publicPrinters(device(req))});
 if(route==='/api/unpair')return reply(res,200,{pairing:pairings.release(device(req),body.discardPending===true),printers:publicPrinters(device(req))});
 if(route==='/api/unlock'){
  const isAdmin=access.isOperator(req),d=isAdmin?null:pairingRequired(req),p=d?fleet.item(d.printerId).config:null,limitKey=isAdmin?'admin':d.id;const recent=(attempts.get(limitKey)||[]).filter(t=>Date.now()-t<60000);if(recent.length>=5)return reply(res,429,{error:'잠시 후 다시 시도하세요.'});recent.push(Date.now());attempts.set(limitKey,recent);
  if(!equalSecret(body.pin,p?.operatorPin||config.operatorPin))return reply(res,401,{error:'운영자 PIN을 확인하세요.'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{expiry:Date.now()+30*60000,admin:isAdmin,...(d?{clientId:d.id,printerId:d.printerId,revision:d.revision}:{})});return reply(res,200,{token,admin:isAdmin,printerId:d?.printerId});
 }
 if(match?.[2]==='queue'){if(!pairings.matches(j))throw Error('매칭이 변경된 작품입니다. 새 미니에서 다시 접수해주세요.');if(j.ticket)return reply(res,200,summary(j,true));if(j.state!=='ready')throw Error('먼저 슬라이싱을 완료하세요.');j.ticket=Math.max(0,...[...jobs.values()].map(x=>x.ticket||0))+1;j.state='queued';save(j);return reply(res,200,summary(j,true));}
 if(match?.[2]==='discard'){if(j.clientId!==device(req))return reply(res,404,{error:'이 기기의 작업을 찾을 수 없습니다.'});if(!['ready','queued'].includes(j.state)||j.startAttempted)throw Error('출력 중이거나 처리한 작업은 취소할 수 없습니다.');j.state='cancelled';save(j);return reply(res,200,summary(j));}
 if(match?.[2]==='print'){
  const pending=directPrint({job:j,owner:device(req),pairings,fleet,body,save});
  reply(res,202,summary(j,true));pending?.catch(e=>{fleet.item(j.printerId).error=e.message;});return;
 }
 if(match?.[2]==='stop'){stopOwnJob({job:j,owner:device(req),pairings,fleet});return reply(res,202,{sent:true,printerId:j.printerId});}
 const scope=auth(req,j);
 if(route==='/api/release-pairing'){admin(req);if(!pairings.get(body.clientId))throw Error('해제할 매칭이 없습니다.');pairings.release(body.clientId,body.discardPending===true);return reply(res,200,{released:true});}
 const printerId=scope.admin?(body.printerId||j?.printerId):scope.printerId;if(!printerId)throw Error('대상 미니를 선택하세요.');
 if(route==='/api/connect'){await fleet.connect(printerId);return reply(res,200,{connected:true,printerId});}
 if(match?.[2]==='start'){if(!pairings.matches(j))throw Error('현재 1:1 매칭과 작업의 대상 미니가 다릅니다.');fleet.check(j,body);const pending=fleet.start(j,body);reply(res,202,{accepted:true,printerId:j.printerId});pending.catch(e=>{fleet.item(j.printerId).error=e.message;});return;}
 if(match?.[2]==='cancel'){if(j.state!=='queued')throw Error('대기 중인 작업만 취소할 수 있습니다.');j.state='cancelled';save(j);return reply(res,200,summary(j));}
 if(match?.[2]==='resolve'){if(j.state!=='uncertain')throw Error('확인이 필요한 작업만 정리할 수 있습니다.');fleet.ready(j.printerId);if(body.bedClear!==true||body.plaReady!==true)throw Error('이 미니의 본체와 빈 베드를 직접 확인하세요.');j.state='cancelled';j.attention='운영자가 이 미니를 확인하고 작업을 닫았습니다.';save(j);return reply(res,200,summary(j));}
 if(route==='/api/stop'){fleet.stop(printerId);return reply(res,202,{sent:true,printerId});}
 return reply(res,404,{error:'Not found'});
 }catch(e){if(!res.headersSent)reply(res,e.status||409,{error:e.message});else res.end();}});
server.requestTimeout=120000;server.headersTimeout=10000;
const refresh=setInterval(()=>{fleet.refresh();for(const [token,s]of sessions)if(s.expiry<Date.now())sessions.delete(token);},10000);
server.listen(port,access.bind,()=>{const links=access.links();if(links)fs.writeFileSync(path.join(runtime,'booth-links.json'),JSON.stringify(links,null,2));console.log('상상을 클릭하다! '+origin+'\n운영자 PIN: '+(process.env.CLICK_DESKTOP_INSTANCE?'운영자 앱에서 확인':config.operatorPin)+'\n등록된 미니: '+printers.map(p=>p.name).join(', ')+'\n참가자는 부스 링크에서 현장 매칭을 선택합니다. 프린터 정보와 작업은 runtime/에만 저장합니다.');for(const p of printers)if(p.ip)fleet.connect(p.id).catch(()=>{});});
function close(){clearInterval(refresh);fleet.close();server.close(()=>process.exit(0));}process.on('SIGINT',close);process.on('SIGTERM',close);

require('./desktop.cjs').desktopControl({input:process.stdin,output:process.stdout,nonce:process.env.CLICK_DESKTOP_CONTROL,busy:()=>uploads>0||slicing||sliceQueue.length>0||printers.some(p=>fleet.busy(p.id)),close});
