const fs=require('node:fs');
const path=require('node:path');
const DOWNLOADS=Object.freeze({
 '/downloads/booth-setup.zip':{file:'downloads/booth-setup.zip',type:'application/zip',name:'booth-setup.zip'},
 '/configure-booth.cmd':{file:'configure-booth.cmd',type:'application/octet-stream',name:'configure-booth.cmd'}
});
function serveDownload(req,res,root){
 const item=DOWNLOADS[req.url];if(req.method!=='GET'||!item)return false;
 const file=path.join(root,item.file);if(!fs.existsSync(file)){res.writeHead(404);res.end('Build the workshop first.');return true;}
 res.writeHead(200,{'Content-Type':item.type,'Content-Length':fs.statSync(file).size,'Content-Disposition':'attachment; filename="'+item.name+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);return true;
}
module.exports={serveDownload};
