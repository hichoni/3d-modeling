const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const cp=require('node:child_process');const http=require('node:http');
const port=15888,origin='http://127.0.0.1:'+port;
function request(route,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const req=http.request(origin+route,{method,headers},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,text,json:()=>JSON.parse(text)}));});req.on('error',reject);req.end(body);});}
test('local bridge protects private files, operator actions and malformed STL requests',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-test-'));fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({operatorPin:'234567',slicerPath:path.join(dir,'missing.exe')}));const child=cp.spawn(process.execPath,['bridge/server.cjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,CLICK_RUNTIME:dir,CLICK_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server startup timeout')),8000);child.stdout.on('data',()=>{clearTimeout(t);resolve();});child.once('exit',()=>{clearTimeout(t);reject(Error('Server exited'));});});
 const boot=(await request('/api/bootstrap')).json();assert.equal(boot.app,'click-workshop');assert.equal((await request('/runtime/config.json')).status,404);assert.equal((await request('/artifacts/lan-devices.local.json')).status,404);assert.equal((await request('/api/operator')).status,401);assert.equal((await request('/api/bootstrap',{headers:{Host:'evil.test'}})).status,403);
 const good={Origin:origin,'X-Click-Token':boot.csrf,'Content-Type':'application/json'};
 assert.equal((await request('/api/unlock',{method:'POST',headers:{...good,Origin:'https://evil.test'},body:'{"pin":"234567"}'})).status,403);
 assert.equal((await request('/api/unlock',{method:'POST',headers:good,body:'{"pin":"wrong"}'})).status,401);
 const unlock=(await request('/api/unlock',{method:'POST',headers:good,body:'{"pin":"234567"}'})).json();assert.ok(unlock.token);const op=await request('/api/operator',{headers:{'X-Operator-Token':unlock.token}});assert.equal(op.status,200);assert.equal(op.json().printer.online,false);assert.ok(!op.text.includes('234567'));
 const bad=await request('/api/slice',{method:'POST',headers:{...good,'Content-Type':'application/octet-stream'},body:'not a model'});assert.equal(bad.status,409);
 const stopped=await request('/api/stop',{method:'POST',headers:{...good,'X-Operator-Token':unlock.token},body:'{}'});assert.equal(stopped.status,409);
 }finally{child.kill();await new Promise(r=>child.once('exit',r));/* Retain isolated temp files for diagnostics; no production files are touched. */}
});
