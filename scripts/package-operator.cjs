const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');
const TABLE=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=TABLE[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function packageOperator(){
 // Deliberate allowlist: never archive the working directory or private runtime settings.
 const files=['configure-booth.cmd','start-booth.cmd','install-booth-autostart.cmd','start-workshop.cmd','update-booth.cmd','index.html','studio.html','setup.html','src/studio-core.js',
  'bridge/access.cjs','bridge/desktop.cjs','bridge/browser-job.cjs','bridge/connection-settings.cjs','bridge/direct-print.cjs','bridge/print-preparation.cjs','src/print-job.js','src/print-profiles.js','bridge/statistics.cjs','src/statistics-core.js','bridge/zip.cjs','bridge/profiles/a1-mini-pla.json','bridge/profiles/a1-mini-source.json','bridge/profiles/BAMBU-LICENSE.txt','src/toolpaths.js','bridge/core.cjs','bridge/discovery.cjs','bridge/downloads.cjs','bridge/fleet.cjs','bridge/pairings.cjs','bridge/printers.cjs','bridge/server.cjs','bridge/setup.cjs','bridge/transport.cjs','bridge/bambu-ca.pem','bridge/config.example.json',
  'scripts/start-background.ps1','scripts/install-autostart.ps1','scripts/update-booth.ps1','docs/CHROMEBOOK.md','docs/FLEET.md','docs/SMART_APP_CONTROL.md','docs/THIRD_PARTY.md','docs/WEB_FIRST.md','docs/PRINTER_CONNECTION.md','docs/STL_STUDIO.md','docs/PRINT_VALIDATION_2026-10-20.md','vendor/kiri/LICENSES.txt','vendor/THREE-LICENSE.txt',
  ...fs.readdirSync(path.join(root,'fonts')).filter(f=>f.endsWith('OFL.txt')).map(f=>'fonts/'+f)];
 const entries=files.map(name=>{const text=fs.readFileSync(path.join(root,name),'utf8').replace(/\r\n/g,'\n');return {name:'click-workshop/'+name,data:Buffer.from(/\.(cmd|ps1)$/.test(name)?text.replace(/\n/g,'\r\n'):text)};});
 entries.push({name:'click-workshop/먼저 읽어주세요.txt',data:Buffer.from(fs.readFileSync(path.join(root,'docs/OPERATOR_QUICK_START.txt'),'utf8').replace(/\r?\n/g,'\r\n'))});
 const local=[],central=[];let offset=0;
 for(const {name,data}of entries){const filename=Buffer.from(name),compressed=zlib.deflateRawSync(data,{level:9}),crc=crc32(data),header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);local.push(header,filename,compressed);
  const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(33,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42);central.push(record,filename);offset+=30+filename.length+compressed.length;
 }
 const end=Buffer.alloc(22),centralSize=central.reduce((n,b)=>n+b.length,0);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
 const bytes=Buffer.concat([...local,...central,end]),dir=path.join(root,'downloads');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'booth-setup.zip'),bytes);
 console.log('Packaged downloads/booth-setup.zip ('+(bytes.length/1024/1024).toFixed(1)+' MB, '+entries.length+' public files)');
}
if(require.main===module)packageOperator();
module.exports={packageOperator};
