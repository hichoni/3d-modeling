// Release checks contain public identity metadata only. Never log key contents or passwords.
const fs=require('node:fs');
const path=require('node:path');
function writeVersionedBundle(directory,version,bytes){
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Release version must be x.y.z');
 const name='click-studio-v'+version+'.swbn',file=path.join(directory,name);
 if(fs.existsSync(file)){
  if(!fs.readFileSync(file).equals(bytes))throw Error('Published IWA version cannot be overwritten: '+version);
 }else fs.writeFileSync(file,bytes,{flag:'wx'});
 return name;
}
function assertIdentity(actual,expected,label){
 if(typeof actual!=='string'||!actual||typeof expected!=='string'||!expected)throw Error(label+' identity is missing. Keep the published package unchanged.');
 if(actual!==expected)throw Error(label+' signing identity does not match the published app. Recover the original key; do not replace the download with a different app.');
}
function assertNextVersion(next,previous){
 const parse=v=>{if(!/^\d+\.\d+\.\d+$/.test(v))throw Error('Release version must be x.y.z');return v.split('.').map(Number);};
 const a=parse(next),b=parse(previous);for(let i=0;i<3;i++){if(a[i]>b[i])return;if(a[i]<b[i])break;}
 throw Error('Release version must be newer than the published version '+previous);
}
function requireKeyFiles(files){for(const file of files)if(!fs.existsSync(file))throw Error('Original signing file not found: '+file+'. No replacement key was generated.');}
function assertOfflinePages(entries,expected){
 for(const [name,bytes]of Object.entries(expected)){
  const read=entries.get('assets/web/'+name);
  if(!read||!read().equals(bytes))throw Error('APK offline page does not match this build: '+name+'. Use the APK from the matching Android CI run.');
 }
}
module.exports={assertIdentity,assertNextVersion,requireKeyFiles,assertOfflinePages,writeVersionedBundle};
