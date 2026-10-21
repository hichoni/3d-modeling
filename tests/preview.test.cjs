const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {previewServer}=require('../scripts/serve.cjs');
function request(port,route,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port,path:route,method,headers},s=>{let text='';s.on('data',x=>text+=x);s.on('end',()=>resolve({status:s.statusCode,text}));});r.on('error',reject);r.end(body);});}
test('preview forwards only local same-origin API requests and preserves backend CSRF checks',async()=>{
 const seen=[],backend=http.createServer((req,res)=>{seen.push({url:req.url,headers:req.headers});res.writeHead(req.method==='POST'&&req.headers['x-click-token']!=='csrf'?403:200,{'Content-Type':'application/json'});res.end('{"ok":true}');});
 await new Promise(r=>backend.listen(0,'127.0.0.1',r));const bridgePort=backend.address().port;
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const preview=previewServer({port,bridgePort});await new Promise(r=>preview.listen(port,'127.0.0.1',r));const origin='http://127.0.0.1:'+port;
 try{
  assert.equal((await request(port,'/api/bootstrap')).status,200);assert.equal(seen[0].headers.host,'127.0.0.1:'+bridgePort);
  const headers={Origin:origin,'Content-Type':'application/json','X-Click-Token':'csrf','X-Operator-Token':'operator'};
  assert.equal((await request(port,'/api/connection-settings',{method:'POST',headers,body:'{}'})).status,200);assert.equal(seen[1].headers.origin,'http://127.0.0.1:'+bridgePort);assert.equal(seen[1].headers['x-operator-token'],'operator');
  assert.equal((await request(port,'/api/connection-settings',{method:'POST',headers:{...headers,'X-Click-Token':'wrong'},body:'{}'})).status,403);
  const count=seen.length;
  for(const method of ['GET','POST'])assert.equal((await request(port,'/api/connection-settings',{method,headers:{...headers,Origin:'https://evil.test'}})).status,403);
  assert.equal((await request(port,'/api/connection-settings',{method:'POST',body:'{}'})).status,403);assert.equal((await request(port,'/api/bootstrap',{headers:{Host:'evil.test'}})).status,403);assert.equal(seen.length,count);
  assert.equal((await request(port,'/runtime/config.json')).status,404);
  const guide=await request(port,'/setup.html');assert.equal(guide.status,200);assert.match(guide.text,/프린터 연결 시작하기/);
 }finally{await Promise.all([new Promise(r=>preview.close(r)),new Promise(r=>backend.close(r))]);}
});
