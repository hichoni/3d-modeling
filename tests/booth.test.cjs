const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const cp=require('node:child_process');const http=require('node:http');
const {makeAccess}=require('../bridge/access.cjs');
const key='b'.repeat(64),pin='345678',port=15889,hub='http://192.168.60.9:'+port,pages='https://hichoni.github.io';
function req(headers={},remote='192.168.60.10'){return {headers,socket:{remoteAddress:remote}};}
test('participant links never authorize operator access and reject foreign origins/hosts',()=>{
 const a=makeAccess({booth:{enabled:true,host:'192.168.60.9',key}},port);
 assert.equal(a.bind,'0.0.0.0');assert.ok(a.hosts.has('192.168.60.9:'+port));assert.equal(a.hosts.has('evil.test:'+port),false);
 const remote=req({host:'192.168.60.9:'+port,origin:pages,'x-booth-key':key});assert.equal(a.participant(remote),true);assert.equal(a.isOperator(remote),false);
 assert.equal(a.participant(req({host:'192.168.60.9:'+port})),false);
 assert.equal(a.isOperator(req({host:'127.0.0.1:'+port},'192.168.60.10')),false);
 assert.equal(a.isOperator(req({host:'127.0.0.1:'+port,origin:pages},'127.0.0.1')),false);
 const local=req({host:'127.0.0.1:'+port},'127.0.0.1');assert.equal(a.isOperator(local),true);assert.equal(a.participant(local),true);
 assert.equal(a.allowedOrigin(pages),true);assert.equal(a.allowedOrigin(hub),true);assert.equal(a.allowedOrigin('https://evil.test'),false);
 const headers={};assert.equal(a.cors(remote,{setHeader:(k,v)=>headers[k]=v}),true);assert.equal(headers['Access-Control-Allow-Origin'],pages);assert.ok(!headers['Access-Control-Allow-Headers'].includes('Operator'));
 assert.throws(()=>makeAccess({booth:{enabled:true,host:'8.8.8.8',key}},port));assert.throws(()=>makeAccess({booth:{enabled:true,host:'192.168.1.1',key:'short'}},port));
 assert.ok(a.links().pages.startsWith(pages+'/3d-modeling/#'));assert.equal(new URL(a.links().pages).search,'');assert.ok(!a.links().pages.includes(pin));
});
test('browser parses only private booth endpoints with a complete participant key',()=>{
 const c=vm.createContext({URL,URLSearchParams});vm.runInContext(fs.readFileSync('src/connection.js','utf8'),c);
 const link=makeAccess({booth:{enabled:true,host:'192.168.60.9',key}},port).links().pages;const parsed=c.parseBoothLink(link);assert.equal(parsed.base,hub);assert.equal(parsed.key,key);
 assert.equal(c.parseBoothLink(pages+'/3d-modeling/'),null);
 for(const base of ['http://8.8.8.8:5188','javascript:alert(1)','http://user:password@192.168.1.2','http://192.168.1.2/path','http://192.168.1.2/?foo=bar'])assert.throws(()=>c.parseBoothLink(pages+'/#'+new URLSearchParams({booth:base,key})));
 assert.throws(()=>c.parseBoothLink(pages+'/#'+new URLSearchParams({booth:hub,key:'bad'})));
});
function request(route,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const r=http.request('http://127.0.0.1:'+port+route,{method,headers},s=>{let text='';s.on('data',x=>text+=x);s.on('end',()=>resolve({status:s.statusCode,headers:s.headers,text,json:()=>JSON.parse(text)}));});r.on('error',reject);r.end(body);});}
test('browser connection attaches the booth key and keeps loopback operator mode on return',async()=>{
 const dom=new Map(),get=id=>{if(!dom.has(id))dom.set(id,{textContent:'',hidden:false,value:'',open:false});return dom.get(id);};
 const memory=new Map(),storage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)||null,removeItem:k=>memory.delete(k)};
 const calls=[];const c=vm.createContext({URL,URLSearchParams,$:get,local:null,job:null,jobTimer:null,operatorToken:'',S:{text:'하늘'},location:{href:'http://127.0.0.1:5188/',hostname:'127.0.0.1',origin:'http://127.0.0.1:5188',pathname:'/'},localStorage:storage,sessionStorage:storage,lock:()=>{},renderSlice:()=>{},renderTicket:()=>{},clearInterval:()=>{},fetch:async(url,options)=>{calls.push({url,options});return {json:async()=>({})};}});
 vm.runInContext(fs.readFileSync('src/connection.js','utf8'),c);
 c.api=async()=>({app:'click-workshop',csrf:'request-token',operator:false});
 const link=makeAccess({booth:{enabled:true,host:'192.168.60.9',key}},port).links().pages,target=c.parseBoothLink(link);
 assert.equal(await c.connectWorkshop(target,{save:true}),true);assert.equal(get('operatorLocal').hidden,true);assert.match(get('boothBtn').textContent,/연결됨/);
 await c.backendFetch('/api/slice',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:'data'});assert.equal(calls[0].url,hub+'/api/slice');assert.equal(calls[0].options.headers['X-Booth-Key'],key);assert.equal(calls[0].options.headers['X-Click-Token'],'request-token');assert.equal(calls[0].options.targetAddressSpace,'local');
 c.api=async()=>({app:'click-workshop',csrf:'other',operator:true});await c.discoverLocal();assert.equal(get('operatorLocal').hidden,false);assert.equal(vm.runInContext('boothTarget',c),null);
});
test('booth HTTP supports Pages preflight, pairing and shared queue while operators stay local',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-booth-'));fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({operatorPin:pin,booth:{enabled:true,host:'192.168.60.9',key},slicerPath:path.join(dir,'missing.exe')}));
 // A completed slice fixture tests participant queueing without starting a slicer or printer.
 const id='c'.repeat(24),jobDir=path.join(dir,'jobs',id);fs.mkdirSync(jobDir,{recursive:true});fs.writeFileSync(path.join(jobDir,'job.json'),JSON.stringify({id,name:'별',state:'ready',slice:{seconds:300,weightG:.4,layers:10,paths:[]},sha256:'hash'}));
 const child=cp.spawn(process.execPath,['bridge/server.cjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,CLICK_PORT:String(port),CLICK_RUNTIME:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Startup timeout')),8000);child.stdout.once('data',()=>{clearTimeout(t);resolve();});child.once('exit',()=>{clearTimeout(t);reject(Error('Exited'));});});
  const guest={Host:'192.168.60.9:'+port,Origin:pages,'X-Booth-Key':key};
  const pre=await request('/api/bootstrap',{method:'OPTIONS',headers:{Host:guest.Host,Origin:pages,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'x-booth-key'}});assert.equal(pre.status,204);assert.equal(pre.headers['access-control-allow-origin'],pages);
  assert.equal((await request('/api/bootstrap',{headers:{Host:guest.Host,Origin:pages}})).status,403);
  assert.equal((await request('/api/bootstrap',{headers:{...guest,Origin:'https://evil.test'}})).status,403);
  const boot=(await request('/api/bootstrap',{headers:guest})).json();assert.equal(boot.operator,false);assert.equal(boot.booth,true);assert.ok(!JSON.stringify(boot).includes(key));
  const post={...guest,'X-Click-Token':boot.csrf,'Content-Type':'application/json'};
  assert.equal((await request('/api/unlock',{method:'POST',headers:post,body:JSON.stringify({pin})})).status,403);
  const queued=(await request('/api/jobs/'+id+'/queue',{method:'POST',headers:post,body:'{}'}));assert.equal(queued.status,200);assert.equal(queued.json().ticket,1);assert.equal(queued.json().state,'queued');
  const localHeaders={Origin:'http://127.0.0.1:'+port,'X-Click-Token':boot.csrf,'Content-Type':'application/json'};
  const token=(await request('/api/unlock',{method:'POST',headers:localHeaders,body:JSON.stringify({pin})})).json().token;assert.ok(token);
  assert.equal((await request('/api/operator',{headers:{...guest,'X-Operator-Token':token}})).status,401);
  assert.equal((await request('/api/booth-links',{headers:{...guest,'X-Operator-Token':token}})).status,401);
  assert.equal((await request('/api/jobs/'+id+'/start',{method:'POST',headers:{...post,'X-Operator-Token':token},body:'{}'})).status,401);
  const operator=(await request('/api/operator',{headers:{'X-Operator-Token':token}})).json();assert.equal(operator.jobs[0].ticket,1);
  const shared=(await request('/api/booth-links',{headers:{'X-Operator-Token':token}})).json();assert.ok(shared.links.pages.includes('#booth='));
  assert.equal((await request('/runtime/config.json',{headers:guest})).status,404);
 }finally{child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}
});
