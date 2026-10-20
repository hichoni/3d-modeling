const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'..','index.html');
http.createServer((req,res)=>{if(req.headers.host!=='127.0.0.1:5186'){res.writeHead(403);return res.end();}if(!['/','/index.html'].includes(req.url)){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'});fs.createReadStream(file).pipe(res);}).listen(5186,'127.0.0.1',()=>console.log('Static preview: http://127.0.0.1:5186'));
