const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http');
const {clientId}=require('../bridge/pairings.cjs');
test('direct HTTP action requires same owner, lease and CSRF, starts without PIN, and returns live telemetry',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-direct-http-')),port=15901,origin='http://127.0.0.1:'+port,token='a'.repeat(64),owner=clientId(token),id='a'.repeat(24),sha=require('node:crypto').createHash('sha256').update('test file').digest('hex');
 fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({operatorPin:'123456',printers:[{id:'mini-01',name:'Test mini',ip:'192.168.1.99',serial:'TESTMINI001'}]}));
 fs.writeFileSync(path.join(dir,'pairings.json'),JSON.stringify([{id:owner,name:'test',printerId:'mini-01',revision:1}]));
 const folder=path.join(dir,'jobs',id);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'print.gcode.3mf'),'test file');fs.writeFileSync(path.join(folder,'job.json'),JSON.stringify({id,name:'Test',clientId:owner,printerId:'mini-01',printerSerial:'TESTMINI001',pairingRevision:1,state:'ready',sha256:sha,slice:{source:'browser',layers:10,paths:[]}}));
 const child=cp.spawn(process.execPath,['--require',path.join(__dirname,'helpers/mock-fleet.cjs'),'bridge/server.cjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,CLICK_RUNTIME:dir,CLICK_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
 const request=(route,body,headers={})=>new Promise((resolve,reject)=>{const req=http.request(origin+route,{method:body?'POST':'GET',headers:{Origin:origin,'X-Client-Token':token,...(body?{'Content-Type':'application/json'}:{}),...headers}},res=>{let text='';res.on('data',v=>text+=v);res.on('end',()=>resolve({status:res.statusCode,json:JSON.parse(text)}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),8000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});});
  const boot=(await request('/api/bootstrap')).json,headers={'X-Click-Token':boot.csrf},body={ready:true,sha256:sha},route='/api/jobs/'+id+'/print';
  assert.equal((await request(route,body)).status,403);assert.equal((await request(route,body,{...headers,Origin:'https://evil.test'})).status,403);
  assert.equal((await request(route,body,{...headers,'X-Client-Token':'b'.repeat(64)})).status,404);
  const result=await request(route,body,headers);assert.equal(result.status,202,JSON.stringify(result.json));assert.equal(result.json.mode,'direct');assert.equal(result.json.ticket,undefined);
  assert.equal((await request(route,body,headers)).status,202);
  const current=(await request('/api/jobs/'+id)).json;assert.ok(['sent','accepted'].includes(current.state));assert.equal(current.telemetry.fresh,true);assert.equal(current.telemetry.bedTarget,65);assert.equal(current.telemetry.bedTemperature,35);
  const starts=fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse).filter(x=>x.type==='start_command');assert.equal(starts.length,1);
  assert.equal((await request('/api/jobs/'+id+'/stop',{}, {...headers,'X-Client-Token':'b'.repeat(64)})).status,404);
  assert.equal((await request('/api/jobs/'+id+'/stop',{},headers)).status,202);
 }finally{child.kill();if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));}
});
