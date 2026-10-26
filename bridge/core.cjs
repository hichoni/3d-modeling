const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const cp=require('node:child_process');
const crypto=require('node:crypto');
// Printer rules live in src/print-job.js so the Chromebook app enforces exactly the same checks.
const {validateSTL,checkReady,checkStart,matchesJob,attention,PAIR_OFFSET}=require('../src/print-job.js');
function zipEntries(buffer){
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}if(end<0)throw Error('올바른 3MF ZIP 파일이 아닙니다.');
 const entries=new Map();let offset=buffer.readUInt32LE(end+16);const count=buffer.readUInt16LE(end+10);
 for(let i=0;i<count;i++){if(buffer.readUInt32LE(offset)!==0x02014b50)throw Error('3MF 디렉터리 오류');const method=buffer.readUInt16LE(offset+10),size=buffer.readUInt32LE(offset+20),rawSize=buffer.readUInt32LE(offset+24),nl=buffer.readUInt16LE(offset+28),el=buffer.readUInt16LE(offset+30),cl=buffer.readUInt16LE(offset+32),start=buffer.readUInt32LE(offset+42),name=buffer.subarray(offset+46,offset+46+nl).toString();if(rawSize>64*1024*1024)throw Error('3MF 항목이 너무 큽니다.');const dataStart=start+30+buffer.readUInt16LE(start+26)+buffer.readUInt16LE(start+28),data=buffer.subarray(dataStart,dataStart+size);entries.set(name,()=>{const result=method===0?data:method===8?zlib.inflateRawSync(data,{maxOutputLength:64*1024*1024}):null;if(!result||result.length!==rawSize)throw Error('3MF 압축 형식 오류');return result;});offset+=46+nl+el+cl;}
 return entries;
}
function parseGcode(text,size=14,spread=0){
 const lo=90-size/2-.1,hi=90+size/2+.1,xlo=lo-spread,xhi=hi+spread;
 const layers=[];let x=0,y=0,z=0,e=0,relativeE=false,relativeXYZ=false,current=null,layerPending=false;
 for(const line of text.split(/\r?\n/)){
  if(/^;\s*(CHANGE_LAYER|LAYER_CHANGE)\b/.test(line)){layerPending=true;continue;}
  const code=line.split(';')[0].trim();if(!code)continue;const command=code.split(/\s/)[0];
  if(command==='M83'){relativeE=true;continue;}if(command==='M82'){relativeE=false;continue;}if(command==='G90'){relativeXYZ=false;continue;}if(command==='G91'){relativeXYZ=true;continue;}
  const vals={};for(const m of code.matchAll(/([XYZE])(-?\d*\.?\d+)/g))vals[m[1]]=Number(m[2]);if(command==='G92'){if(vals.E!==undefined)e=vals.E;continue;}if(command!=='G0'&&command!=='G1')continue;
  const nx=vals.X===undefined?x:vals.X+(relativeXYZ?x:0),ny=vals.Y===undefined?y:vals.Y+(relativeXYZ?y:0),nz=vals.Z===undefined?z:vals.Z+(relativeXYZ?z:0),ne=vals.E===undefined?e:vals.E+(relativeE?e:0);
  if(ne>e+.00001&&(nx!==x||ny!==y)&&nz>0&&nz<=4.51&&nx>=xlo&&nx<=xhi&&ny>=lo&&ny<=hi&&x>=xlo&&x<=xhi&&y>=lo&&y<=hi){
   if(!current||layerPending&&Math.abs(current.z-nz)>.01){current={z:nz,segments:[]};layers.push(current);}layerPending=false;
   if(current.segments.length<15000)current.segments.push([x-90,y-90,nx-90,ny-90].map(n=>Math.round(n*1000)/1000));
  }
  x=nx;y=ny;z=nz;e=ne;
 }
 return layers;
}
function expandProfiles(profileRoot){const index=new Map();function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(entry.name.endsWith('.json')){const data=JSON.parse(fs.readFileSync(p,'utf8'));if(data.name)index.set(data.name,data);}}}walk(profileRoot);
 function expand(name,stack=[]){if(stack.includes(name))throw Error('프리셋 순환 참조');const d=index.get(name);if(!d)throw Error('공식 프리셋 없음: '+name);const out=d.inherits?expand(d.inherits,[...stack,name]):{};for(const include of d.include||[])Object.assign(out,expand(include,[...stack,name]));Object.assign(out,d);delete out.inherits;delete out.include;return out;}
 return expand;
}
async function sliceSTL(dir,config={}){
 const exe=config.slicerPath||'C:/Program Files/Bambu Studio/bambu-studio.exe';if(!fs.existsSync(exe))throw Error('Bambu Studio를 설치하거나 config.json의 slicerPath를 지정하세요.');
 const profileRoot=config.profilePath||path.join(path.dirname(exe),'resources/profiles/BBL');const expand=expandProfiles(profileRoot);for(const [type,name] of [['machine','Bambu Lab A1 mini 0.4 nozzle'],['process','0.20mm Standard @BBL A1M'],['filament','Generic PLA @BBL A1M']]){const p=expand(name);p[{machine:'printer_settings_id',process:'print_settings_id',filament:'filament_settings_id'}[type]]=type==='filament'?[name]:name;fs.writeFileSync(path.join(dir,type+'.json'),JSON.stringify(p));}
 const output=path.join(dir,'print.gcode.3mf'),args=['--debug','3','--arrange','1','--load-settings',path.join(dir,'machine.json')+';'+path.join(dir,'process.json'),'--load-filaments',path.join(dir,'filament.json'),'--curr-bed-type','Textured PEI Plate','--slice','0','--export-3mf',output,path.join(dir,'model.stl')];
 await new Promise((resolve,reject)=>{const out=fs.openSync(path.join(dir,'slicer.log'),'w'),child=cp.spawn(exe,args,{cwd:dir,windowsHide:true,stdio:['ignore',out,out]});let done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);fs.closeSync(out);error?reject(error):resolve();};const timer=setTimeout(()=>{child.kill();finish(Error('슬라이싱 시간 초과 (3분). Bambu Studio에서 파일을 확인하세요.'));},180000);child.on('error',()=>finish(Error('Bambu Studio 실행 실패')));child.on('exit',code=>finish(code===0?null:Error('Bambu Studio 슬라이싱 실패. 로컬 slicer.log와 result.json을 확인하세요.')));});
 const result=JSON.parse(fs.readFileSync(path.join(dir,'result.json')));if(result.return_code!==0||result.sliced_plates?.length!==1)throw Error('슬라이싱 결과를 확인할 수 없습니다.');const plate=result.sliced_plates[0];if(plate.objects?.length!==1)throw Error('출력물은 1개여야 합니다.');const bb=plate.objects[0].bbox,count=[2,3].find(c=>Math.abs(bb.width-14-2*PAIR_OFFSET*(c-1))<=.02&&Math.abs(bb.depth-14)<=.02)||1,size=count>1?14:[14,20].find(s=>Math.abs(bb.width-s)<=.02&&Math.abs(bb.depth-s)<=.02);if(!size||bb.height>4.51||bb.height<2||Math.abs(bb.z)>.01)throw Error('슬라이싱 후 크기 또는 배치가 달라졌습니다.');
 const bytes=fs.readFileSync(output),entries=zipEntries(bytes);if(!entries.has('Metadata/plate_1.gcode'))throw Error('슬라이싱 G-code가 없습니다.');const gcode=entries.get('Metadata/plate_1.gcode')().toString();const paths=parseGcode(gcode,size,(count-1)*PAIR_OFFSET);if(!paths.length)throw Error('모델 출력 경로를 읽지 못했습니다.');
 const seconds=Number(plate.total_predication),weightG=Number(plate.filaments?.reduce((s,f)=>s+f.total_used_g,0));if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(weightG)||weightG<=0)throw Error('출력 시간과 재료량을 확인할 수 없습니다.');
 return {sha256:crypto.createHash('sha256').update(bytes).digest('hex'),slice:{seconds,weightG,layers:paths.length,layerHeight:result.layer_height,paths},bytes:bytes.length};
}
module.exports={validateSTL,zipEntries,parseGcode,expandProfiles,sliceSTL,checkReady,checkStart,matchesJob,attention};
