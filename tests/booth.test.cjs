const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const cp=require('node:child_process');const http=require('node:http');
const {makeAccess}=require('../bridge/access.cjs');
const key='b'.repeat(64),pin='345678',port=15889,hub='http://192.168.60.9:'+port,pages='https://hichoni.github.io';
function req(headers={},remote='192.168.60.10'){return {headers,socket:{remoteAddress:remote}};}
test('booth keys alone cannot grant central operator access and foreign origins are rejected',()=>{
 const a=makeAccess({booth:{enabled:true,host:'192.168.60.9',key}},port);
 assert.equal(a.bind,'0.0.0.0');assert.ok(a.hosts.has('192.168.60.9:'+port));assert.equal(a.hosts.has('evil.test:'+port),false);
 const remote=req({host:'192.168.60.9:'+port,origin:pages,'x-booth-key':key});assert.equal(a.participant(remote),true);assert.equal(a.isOperator(remote),false);
 assert.equal(a.participant(req({host:'192.168.60.9:'+port})),false);
 assert.equal(a.isOperator(req({host:'127.0.0.1:'+port},'192.168.60.10')),false);
 assert.equal(a.isOperator(req({host:'127.0.0.1:'+port,origin:pages},'127.0.0.1')),false);
 const local=req({host:'127.0.0.1:'+port},'127.0.0.1');assert.equal(a.isOperator(local),true);assert.equal(a.participant(local),true);
 assert.equal(a.allowedOrigin(pages),true);assert.equal(a.allowedOrigin(hub),true);assert.equal(a.allowedOrigin('https://evil.test'),false);
 const headers={};assert.equal(a.cors(remote,{setHeader:(k,v)=>headers[k]=v}),true);assert.equal(headers['Access-Control-Allow-Origin'],pages);assert.ok(headers['Access-Control-Allow-Headers'].includes('X-Client-Token'));assert.ok(headers['Access-Control-Allow-Headers'].includes('X-Operator-Token'));
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

test('AIERA domain has participant CORS only in booth mode, without granting operator access',()=>{
 const source='https://3d.aiera.co.kr',a=makeAccess({booth:{enabled:true,host:'192.168.60.9',key}},port);
 const participant=req({host:'192.168.60.9:'+port,origin:source,'x-booth-key':key});
 const headers={};assert.equal(a.allowedOrigin(source),true);assert.equal(a.cors(participant,{setHeader:(k,v)=>headers[k]=v}),true);
 assert.equal(headers['Access-Control-Allow-Origin'],source);assert.equal(a.participant(participant),true);assert.equal(a.isOperator(participant),false);
 for(const other of ['http://3d.aiera.co.kr','https://other.aiera.co.kr','https://3d.aiera.co.kr.evil.test','https://3d.aiera.co.kr:444']){
  assert.equal(a.allowedOrigin(other),false);assert.equal(a.cors(req({origin:other}),{setHeader(){throw Error('unexpected CORS grant');}}),false);
 }
 const local=makeAccess({},port);assert.equal(local.allowedOrigin(source),false);assert.equal(local.cors(participant,{setHeader(){throw Error('unexpected CORS grant');}}),false);
});
function request(route,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const r=http.request('http://127.0.0.1:'+port+route,{method,headers},s=>{let text='';s.on('data',x=>text+=x);s.on('end',()=>resolve({status:s.statusCode,headers:s.headers,text,json:()=>JSON.parse(text)}));});r.on('error',reject);r.end(body);});}
test('browser connection attaches the booth key and keeps loopback operator mode on return',async()=>{
 const dom=new Map(),get=id=>{if(!dom.has(id)){const classes=new Set();dom.set(id,{textContent:'',hidden:false,value:'',open:false,title:'',classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)}});}return dom.get(id);};
 const memory=new Map(),storage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)||null,removeItem:k=>memory.delete(k)};
 const calls=[];const c=vm.createContext({URL,URLSearchParams,crypto:require('node:crypto').webcrypto,$:get,local:null,job:null,jobTimer:null,workshopStats:{connected:()=>{}},operatorToken:'',S:{text:'하늘'},location:{href:'http://127.0.0.1:5188/',hostname:'127.0.0.1',origin:'http://127.0.0.1:5188',pathname:'/'},localStorage:storage,sessionStorage:storage,lock:()=>{},renderSlice:()=>{},renderTicket:()=>{},clearInterval:()=>{},fetch:async(url,options)=>{calls.push({url,options});return {json:async()=>({})};}});
 vm.runInContext(fs.readFileSync('src/hub-update.js','utf8')+fs.readFileSync('src/connection.js','utf8'),c);
 c.api=async()=>({app:'click-workshop',version:7,csrf:'request-token',operator:false});
 const link=makeAccess({booth:{enabled:true,host:'192.168.60.9',key}},port).links().pages,target=c.parseBoothLink(link);
 c.api=async()=>({app:'click-workshop',version:6});assert.equal(await c.connectWorkshop(target,{save:true}),false);c.api=async()=>({app:'click-workshop'});assert.equal(await c.connectWorkshop(target,{save:true}),false);c.api=async()=>({app:'click-workshop',version:7,csrf:'request-token',operator:false});assert.equal(await c.connectWorkshop(target,{save:true}),true);assert.equal(get('operatorLocal').hidden,true);assert.match(get('boothBtn').textContent,/연결됨/);
 // An older booth PC program (v7) still connects; the settings show how to update it and the ⚙ button carries a dot.
 assert.equal(get('hubUpdate').hidden,false);assert.match(get('hubUpdateVersion').textContent,/v7 · 최신 v10/);assert.ok(get('operatorBtn').classList.contains('needs-update'));
 c.local={...c.local,version:10};c.syncConnection();assert.equal(get('hubUpdate').hidden,true);assert.ok(!get('operatorBtn').classList.contains('needs-update'));c.local={...c.local,version:7};
 assert.ok(calls.some(x=>x.url===c.HubUpdate.LATEST_URL&&x.options.credentials==='omit'),'connected to a booth PC, the page checks the published version');calls.length=0;
 await c.backendFetch('/api/slice',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:'data'});assert.equal(calls[0].url,hub+'/api/slice');assert.equal(calls[0].options.headers['X-Booth-Key'],key);assert.equal(calls[0].options.headers['X-Click-Token'],'request-token');assert.equal(calls[0].options.targetAddressSpace,'local');
 c.api=async()=>({app:'click-workshop',version:7,csrf:'other',operator:true});await c.discoverLocal();assert.equal(get('operatorLocal').hidden,false);assert.equal(vm.runInContext('boothTarget',c),null);
});
test('two Chromebooks pair independently and scoped PINs cannot operate the other mini',async()=>{
 const {clientId}=require('../bridge/pairings.cjs'),clientA='a'.repeat(64),clientB='d'.repeat(64),deviceA=clientId(clientA),deviceB=clientId(clientB),first='c'.repeat(24),second='e'.repeat(24);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-booth-'));fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({operatorPin:pin,booth:{enabled:true,host:'192.168.60.9',key},printers:[{id:'mini-01',name:'미니 01'},{id:'mini-02',name:'미니 02',operatorPin:'456789'}],slicerPath:path.join(dir,'missing.exe')}));
 fs.writeFileSync(path.join(dir,'pairings.json'),JSON.stringify([{id:deviceA,name:'크롬북 01',printerId:'mini-01',revision:1},{id:deviceB,name:'크롬북 02',printerId:'mini-02',revision:1}]));
 for(const [id,owner,printerId]of [[first,deviceA,'mini-01'],[second,deviceB,'mini-02']]){const folder=path.join(dir,'jobs',id);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'job.json'),JSON.stringify({id,name:'별',clientId:owner,printerId,pairingRevision:1,state:'ready',slice:{seconds:300,weightG:.4,layers:10,paths:[]},sha256:'hash'}));}
 const child=cp.spawn(process.execPath,['bridge/server.cjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,CLICK_PORT:String(port),CLICK_RUNTIME:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Startup timeout')),8000);child.stdout.once('data',()=>{clearTimeout(t);resolve();});child.once('exit',()=>{clearTimeout(t);reject(Error('Exited'));});});
  const guest={Host:'192.168.60.9:'+port,Origin:pages,'X-Booth-Key':key,'X-Client-Token':clientA},guestB={...guest,'X-Client-Token':clientB};
  const pre=await request('/api/bootstrap',{method:'OPTIONS',headers:{Host:guest.Host,Origin:pages,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'x-booth-key,x-client-token,x-operator-token'}});assert.equal(pre.status,204);assert.equal(pre.headers['access-control-allow-origin'],pages);
  assert.equal((await request('/api/bootstrap',{headers:{Host:guest.Host,Origin:pages}})).status,403);assert.equal((await request('/api/bootstrap',{headers:{...guest,Origin:'https://evil.test'}})).status,403);
  const boot=(await request('/api/bootstrap',{headers:guest})).json();assert.equal(boot.operator,false);assert.equal(boot.pairing.printerId,'mini-01');assert.ok(!JSON.stringify(boot).includes(key));assert.ok(!JSON.stringify(boot).includes('operatorPin'));
  assert.equal((await request('/api/bootstrap',{headers:guestB})).json().pairing.printerId,'mini-02');
  const post={...guest,'X-Click-Token':boot.csrf,'Content-Type':'application/json'},postB={...post,'X-Client-Token':clientB};
  assert.equal((await request('/api/connection-settings',{headers:guest})).status,403);
  assert.equal((await request('/api/connection-settings',{method:'POST',headers:post,body:'{}'})).status,403);
  assert.equal((await request('/api/pair',{method:'POST',headers:postB,body:JSON.stringify({printerId:'mini-01'})})).status,409);
  assert.equal((await request('/api/jobs/'+second,{headers:guest})).status,404);
  for(const [headers,id]of [[post,first],[postB,second]]){const queued=await request('/api/jobs/'+id+'/queue',{method:'POST',headers,body:'{}'});assert.equal(queued.status,200);assert.equal(queued.json().state,'queued');}
  const loginA=(await request('/api/unlock',{method:'POST',headers:post,body:JSON.stringify({pin})})).json();assert.ok(loginA.token);assert.equal(loginA.printerId,'mini-01');
  assert.equal((await request('/api/unlock',{method:'POST',headers:postB,body:JSON.stringify({pin})})).status,401);
  const loginB=(await request('/api/unlock',{method:'POST',headers:postB,body:'{"pin":"456789"}'})).json();assert.ok(loginB.token);
  const opA=(await request('/api/operator',{headers:{...guest,'X-Operator-Token':loginA.token}})).json();assert.equal(opA.jobs.length,1);assert.equal(opA.printer.id,'mini-01');assert.equal(opA.admin,false);
  assert.equal((await request('/api/operator',{headers:{...guestB,'X-Operator-Token':loginA.token}})).status,401);
  assert.equal((await request('/api/booth-links',{headers:{...guest,'X-Operator-Token':loginA.token}})).status,403);
  assert.equal((await request('/api/jobs/'+second+'/start',{method:'POST',headers:{...post,'X-Operator-Token':loginA.token},body:'{}'})).status,404);
  const localHeaders={Origin:'http://127.0.0.1:'+port,'X-Click-Token':boot.csrf,'Content-Type':'application/json'};
  const admin=(await request('/api/unlock',{method:'POST',headers:localHeaders,body:JSON.stringify({pin})})).json();assert.ok(admin.token);
  const all=(await request('/api/operator',{headers:{'X-Operator-Token':admin.token}})).json();assert.equal(all.jobs.length,2);assert.equal(all.printers.length,2);assert.equal(all.admin,true);
  const shared=(await request('/api/booth-links',{headers:{'X-Operator-Token':admin.token}})).json();assert.ok(shared.links.pages.includes('#booth='));
  assert.equal((await request('/api/unpair',{method:'POST',headers:post,body:'{}'})).status,409);
  assert.equal((await request('/api/unpair',{method:'POST',headers:post,body:'{"discardPending":true}'})).status,200);
  assert.equal((await request('/api/operator',{headers:{...guest,'X-Operator-Token':loginA.token}})).status,401);
  assert.equal((await request('/api/pair',{method:'POST',headers:postB,body:'{"printerId":"mini-01","discardPending":true}'})).status,200);
  assert.equal((await request('/api/jobs/'+second+'/queue',{method:'POST',headers:postB,body:'{}'})).status,409);
  assert.equal((await request('/runtime/config.json',{headers:guest})).status,404);
 }finally{child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}
});
