const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {serveDownload}=require('../bridge/downloads.cjs');
function previewServer({port=5186,bridgePort=5188}={}){
 const file=path.join(__dirname,'..','index.html'),origin='http://127.0.0.1:'+port;
 return http.createServer((req,res)=>{
  if(req.headers.host!=='127.0.0.1:'+port||!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)){res.writeHead(403);return res.end();}
  if(req.url.startsWith('/api/')){
   // The preview is a local operator surface. Reject foreign origins before forwarding.
   if(req.headers.origin&&req.headers.origin!==origin||req.method!=='GET'&&req.headers.origin!==origin){res.writeHead(403);return res.end();}
   const headers={};
   for(const key of ['content-type','content-length','x-click-token','x-client-token','x-operator-token','x-model-name'])if(req.headers[key])headers[key]=req.headers[key];
   if(req.headers.origin)headers.origin='http://127.0.0.1:'+bridgePort;
   const upstream=http.request({host:'127.0.0.1',port:bridgePort,path:req.url,method:req.method,headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
   upstream.setTimeout(40000,()=>upstream.destroy());
   upstream.on('error',()=>{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'출력 PC 중계기를 실행한 뒤 다시 연결해주세요.'}));}else res.destroy();});
   req.on('aborted',()=>upstream.destroy());req.pipe(upstream);return;
  }
  if(serveDownload(req,res,path.dirname(file)))return;
  if(!['/','/index.html'].includes(req.url)){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});fs.createReadStream(file).pipe(res);
 });
}
if(require.main===module)previewServer({bridgePort:Number(process.env.CLICK_BRIDGE_PORT||5188)}).listen(5186,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:5186'));
module.exports={previewServer};
