const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function prepare(nodeBinary,destination){
 if(!fs.existsSync(nodeBinary)||path.basename(nodeBinary).toLowerCase()!=='node.exe')throw Error('Official Windows Node executable required');
 const files=['studio.html','src/studio-core.js','docs/STL_STUDIO.md','index.html','src/toolpaths.js','bridge/browser-job.cjs','bridge/connection-settings.cjs','bridge/direct-print.cjs','bridge/print-preparation.cjs','src/print-profiles.js','bridge/statistics.cjs','src/statistics-core.js','bridge/zip.cjs','bridge/profiles/a1-mini-pla.json','bridge/profiles/a1-mini-source.json','bridge/profiles/BAMBU-LICENSE.txt','vendor/kiri/LICENSES.txt','bridge/access.cjs','bridge/core.cjs','bridge/desktop.cjs','bridge/discovery.cjs','bridge/downloads.cjs','bridge/fleet.cjs','bridge/pairings.cjs','bridge/printers.cjs','bridge/server.cjs','bridge/transport.cjs','bridge/bambu-ca.pem','docs/THIRD_PARTY.md','vendor/THREE-LICENSE.txt',...fs.readdirSync(path.join(root,'fonts')).filter(n=>n.endsWith('OFL.txt')).map(n=>'fonts/'+n)];
 files.push(...fs.readdirSync(path.join(__dirname,'licenses')).filter(n=>n.endsWith('.txt')).map(n=>'desktop/licenses/'+n));
 const manifest={};const target=path.resolve(destination);
 for(const file of files){const bytes=fs.readFileSync(path.join(root,file));const output=path.join(target,'payload',file);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);manifest['payload/'+file]=crypto.createHash('sha256').update(bytes).digest('hex');}
 const nodeBytes=fs.readFileSync(nodeBinary);fs.writeFileSync(path.join(target,'payload','node.exe'),nodeBytes);manifest['payload/node.exe']=crypto.createHash('sha256').update(nodeBytes).digest('hex');
 const nodeLicense=path.join(path.dirname(nodeBinary),'LICENSE');if(!fs.existsSync(nodeLicense))throw Error('Node LICENSE missing beside the verified runtime');
 fs.copyFileSync(nodeLicense,path.join(target,'payload','NODE-LICENSE.txt'));manifest['payload/NODE-LICENSE.txt']=crypto.createHash('sha256').update(fs.readFileSync(nodeLicense)).digest('hex');
 const resource=path.join(__dirname,'ClickBooth','Resources');fs.mkdirSync(resource,{recursive:true});fs.writeFileSync(path.join(resource,'payload-manifest.json'),JSON.stringify(manifest,null,2));
 console.log('Prepared '+Object.keys(manifest).length+' public payload files; no CMD, PowerShell or private runtime data.');
}
if(require.main===module)prepare(process.argv[2],process.argv[3]);module.exports={prepare};
