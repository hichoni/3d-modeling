const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const cp=require('node:child_process');
const crypto=require('node:crypto');
function validateSTL(b){
 if(b.length<134||b.length>6*1024*1024)throw Error('STL 크기가 올바르지 않습니다.');const n=b.readUInt32LE(80);if(!n||84+n*50!==b.length)throw Error('공방에서 만든 바이너리 STL이 필요합니다.');
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let o=84;o<b.length;o+=50){for(let v=0;v<3;v++){const p=[0,1,2].map(k=>b.readFloatLE(o+12+v*12+k*4));if(!p.every(Number.isFinite))throw Error('STL에 유효하지 않은 좌표가 있습니다.');for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}const dx=Math.max(0,Math.abs(p[0])-4.2),dy=Math.max(0,Math.abs(p[1])-4.2);if(Math.hypot(dx,dy)>2.802||Math.abs(p[0])>7.002||Math.abs(p[1])>7.002)throw Error('고정된 14mm 둥근 사각 바깥으로 모델이 벗어납니다.');}}
 if(Math.abs(hi[0]-lo[0]-14)>.005||Math.abs(hi[1]-lo[1]-14)>.005||Math.abs(lo[2])>.005||hi[2]<2||hi[2]>2.505)throw Error('14×14mm, 바닥 Z=0, 전체 높이 2.0~2.5mm 모델만 지원합니다.');
 return {triangles:n,width:hi[0]-lo[0],depth:hi[1]-lo[1],height:hi[2]};
}
function zipEntries(buffer){
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}if(end<0)throw Error('올바른 3MF ZIP 파일이 아닙니다.');
 const entries=new Map();let offset=buffer.readUInt32LE(end+16);const count=buffer.readUInt16LE(end+10);
 for(let i=0;i<count;i++){if(buffer.readUInt32LE(offset)!==0x02014b50)throw Error('3MF 디렉터리 오류');const method=buffer.readUInt16LE(offset+10),size=buffer.readUInt32LE(offset+20),rawSize=buffer.readUInt32LE(offset+24),nl=buffer.readUInt16LE(offset+28),el=buffer.readUInt16LE(offset+30),cl=buffer.readUInt16LE(offset+32),start=buffer.readUInt32LE(offset+42),name=buffer.subarray(offset+46,offset+46+nl).toString();if(rawSize>64*1024*1024)throw Error('3MF 항목이 너무 큽니다.');const dataStart=start+30+buffer.readUInt16LE(start+26)+buffer.readUInt16LE(start+28),data=buffer.subarray(dataStart,dataStart+size);entries.set(name,()=>{const result=method===0?data:method===8?zlib.inflateRawSync(data,{maxOutputLength:64*1024*1024}):null;if(!result||result.length!==rawSize)throw Error('3MF 압축 형식 오류');return result;});offset+=46+nl+el+cl;}
 return entries;
}
function parseGcode(text){
 const layers=[];let x=0,y=0,z=0,e=0,relativeE=false,relativeXYZ=false,current=null,layerPending=false;
 for(const line of text.split(/\r?\n/)){
  if(/^;\s*(CHANGE_LAYER|LAYER_CHANGE)\b/.test(line)){layerPending=true;continue;}
  const code=line.split(';')[0].trim();if(!code)continue;const command=code.split(/\s/)[0];
  if(command==='M83'){relativeE=true;continue;}if(command==='M82'){relativeE=false;continue;}if(command==='G90'){relativeXYZ=false;continue;}if(command==='G91'){relativeXYZ=true;continue;}
  const vals={};for(const m of code.matchAll(/([XYZE])(-?\d*\.?\d+)/g))vals[m[1]]=Number(m[2]);if(command==='G92'){if(vals.E!==undefined)e=vals.E;continue;}if(command!=='G0'&&command!=='G1')continue;
  const nx=vals.X===undefined?x:vals.X+(relativeXYZ?x:0),ny=vals.Y===undefined?y:vals.Y+(relativeXYZ?y:0),nz=vals.Z===undefined?z:vals.Z+(relativeXYZ?z:0),ne=vals.E===undefined?e:vals.E+(relativeE?e:0);
  if(ne>e+.00001&&(nx!==x||ny!==y)&&nz>0&&nz<=2.51&&nx>=82.9&&nx<=97.1&&ny>=82.9&&ny<=97.1&&x>=82.9&&x<=97.1&&y>=82.9&&y<=97.1){
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
 const result=JSON.parse(fs.readFileSync(path.join(dir,'result.json')));if(result.return_code!==0||result.sliced_plates?.length!==1)throw Error('슬라이싱 결과를 확인할 수 없습니다.');const plate=result.sliced_plates[0];if(plate.objects?.length!==1)throw Error('출력물은 1개여야 합니다.');const bb=plate.objects[0].bbox;if(Math.abs(bb.width-14)>.02||Math.abs(bb.depth-14)>.02||bb.height>2.51||bb.height<2||Math.abs(bb.z)>.01)throw Error('슬라이싱 후 크기 또는 배치가 달라졌습니다.');
 const bytes=fs.readFileSync(output),entries=zipEntries(bytes);if(!entries.has('Metadata/plate_1.gcode'))throw Error('슬라이싱 G-code가 없습니다.');const gcode=entries.get('Metadata/plate_1.gcode')().toString();const paths=parseGcode(gcode);if(!paths.length)throw Error('모델 출력 경로를 읽지 못했습니다.');
 const seconds=Number(plate.total_predication),weightG=Number(plate.filaments?.reduce((s,f)=>s+f.total_used_g,0));if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(weightG)||weightG<=0)throw Error('출력 시간과 재료량을 확인할 수 없습니다.');
 return {sha256:crypto.createHash('sha256').update(bytes).digest('hex'),slice:{seconds,weightG,layers:paths.length,layerHeight:result.layer_height,paths},bytes:bytes.length};
}
function checkReady(mqtt){if(!mqtt?.online||Date.now()-mqtt.lastReportAt>15000)throw Error('프린터의 최신 상태를 확인할 수 없습니다.');const s=mqtt.state;if(!['IDLE','FINISH'].includes(s.gcode_state))throw Error('프린터가 대기 상태가 아닙니다.');if(s.sdcard!==true)throw Error('SD 카드를 확인하세요.');if(Number(s.print_error)!==0)throw Error('프린터 본체의 안내를 확인하세요.');if(String(s.nozzle_diameter)!=='0.4')throw Error('0.4mm 노즐 설정이 필요합니다.');}
function attention(s={}){if(Number(s.print_error)===50364437)return '외부 스풀 필라멘트가 감지되지 않습니다. 본체에서 외부 PLA를 로드한 뒤 다시 시작(Resume)을 선택하세요.';if(Number(s.print_error)===134184967)return '노즐에서 필라멘트가 나오는지 현장에서 확인 후 본체의 계속 또는 재시도를 선택하세요.';if(s.gcode_state==='PAUSE')return '출력이 일시 정지됐습니다. 운영자가 본체 안내를 확인하세요.';if(Number(s.print_error)>0)return '프린터에 확인이 필요한 오류가 있습니다. 본체 안내를 확인하세요.';return '';}
function checkStart(job,body,mqtt,active){
 if(job.state!=='queued'||job.startAttempted)throw Error('이 작업은 시작할 수 없습니다. 시작 명령은 반복 전송하지 않습니다.');
 if(active&&!['complete','failed','cancelled'].includes(active.state))throw Error('이전 출력 결과를 먼저 확인하세요.');
 checkReady(mqtt);
 if(body.bedClear!==true||body.plaReady!==true||body.sha256!==job.sha256)throw Error('선택한 파일, 빈 베드, 외부 PLA 확인이 필요합니다.');
}
function matchesJob(state,job){return state.subtask_id!==undefined&&String(state.subtask_id)!=='0'?String(state.subtask_id)===job.printId:state.subtask_name==='Click_'+job.id;}
module.exports={validateSTL,zipEntries,parseGcode,expandProfiles,sliceSTL,checkReady,checkStart,matchesJob,attention};
