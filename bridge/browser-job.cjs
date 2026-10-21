// Browser toolpaths are untrusted. The shared builder re-validates them and adds only the reviewed machine wrapper.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const PrintJob=require('../src/print-job.js'),profiles=require('../src/print-profiles.js'),PROFILE=profiles.get().id;
const machine=JSON.parse(fs.readFileSync(path.join(__dirname,'profiles/a1-mini-pla.json'),'utf8'));
function prepareBrowserJob(body,{studio=false}={}){
 const r=PrintJob.prepareFiles(body,{studio,machine}),bytes=Buffer.from(PrintJob.zipSync(r.files,zlib.deflateRawSync));
 return {stl:Buffer.from(r.stl),bytes,dimensions:r.dimensions,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),slice:r.slice};
}
module.exports={prepareBrowserJob,prepareStudioJob:body=>prepareBrowserJob(body,{studio:true}),PROFILE};
