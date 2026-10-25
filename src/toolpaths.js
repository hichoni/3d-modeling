// Shared browser/relay validation for the booth plates (14 or 20 mm) and the studio, 0.4 mm nozzle profile.
(function(root){
// A booth pair (2-key keychain) prints two 14 mm plates side by side, centred PAIR_OFFSET left and right of the bed centre.
const PAIR_OFFSET=10;
function analyzeToolpaths(text,{height=2.5,strict=false,layerHeight=.2,studio=false,size=14,pair=false}={}){
 if(!studio&&![14,20].includes(size)||pair&&size!==14)throw Error('지원하지 않는 작품 크기입니다.');
 if(![.12,.16,.2].includes(layerHeight))throw Error('지원하지 않는 출력 층 높이입니다.');
 if(typeof text!=='string'||text.length>(studio?24000000:2500000))throw Error('경로 파일 크기를 확인해주세요.');
 if(!Number.isFinite(height)||height<(studio ? .2 : 2)||height>(studio?160:4.51))throw Error('지원하지 않는 모델 높이입니다.');
 let x=90,y=90,z=0,e=0,relativeE=false,feed=0,extruded=0,retract=0,debt=0,roundingPrime=0,seconds=0,layer=null,feature='path';
 const layers=[],moves=[],commands=new Set();
 // Before its first XY move the nozzle is still over the bed centre, which for a pair is the gap between the plates:
 // a retraction or Z move there is fine, extruding is not.
 let parked=true;const round=n=>Math.round(n*10000)/10000;
 const onPlate=(px,py,cx)=>Math.abs(px-cx)<=size/2+.03&&Math.abs(py-90)<=size/2+.03&&Math.hypot(Math.max(0,Math.abs(px-cx)-size*.3),Math.max(0,Math.abs(py-90)-size*.3))<=size*.2+.04;
 const inside=(px,py)=>studio?px>=4.99&&py>=4.99&&px<=175.01&&py<=175.01:pair?onPlate(px,py,90-PAIR_OFFSET)||onPlate(px,py,90+PAIR_OFFSET):onPlate(px,py,90);
 for(const source of text.split(/\r?\n/)){
  const tag=/^\s*;\s*feature\s+(.+?)\s*$/i.exec(source);if(tag)feature=({'shells':'shell','solid fill':'solid','thin fill':'solid','sparse infill':'infill','support':'support','supports':'support','support fill':'support'})[tag[1].toLowerCase()]||'path';
  const line=source.split(';')[0].trim();if(!line)continue;
  const words=line.split(/\s+/),command=words.shift().toUpperCase(),v={};commands.add(command);
  for(const word of words){const match=/^([A-Z])(-?(?:\d+(?:\.\d*)?|\.\d+))$/i.exec(word);if(!match||v[match[1].toUpperCase()]!==undefined)throw Error('경로에 해석할 수 없는 명령이 있어요.');v[match[1].toUpperCase()]=Number(match[2]);}
  const keys=Object.keys(v);const only=allowed=>{if(keys.some(k=>!allowed.includes(k)))throw Error('이 경로에 허용되지 않는 매개변수가 있어요.');};
  if(['G90','M82','M83'].includes(command)){only([]);if(command==='M82')relativeE=false;if(command==='M83')relativeE=true;continue;}
  if(command==='G92'){only(['E']);if(v.E!==0)throw Error('압출 원점이 올바르지 않아요.');e=0;continue;}
  if(command==='G4'){only(['P']);if(v.P===undefined||v.P<0||v.P>100)throw Error('대기 시간이 올바르지 않아요.');seconds+=v.P/1000;continue;}
  if(command==='M106'){only(['P','S']);if(v.P!==1||v.S<0||v.S>255||v.S===undefined)throw Error('냉각 팬 명령이 올바르지 않아요.');continue;}
  if(!['G0','G1'].includes(command))throw Error('허용되지 않는 프린터 명령: '+command);
  if(strict&&(!commands.has('G90')||!commands.has('G92')||!commands.has('M82')&&!commands.has('M83')))throw Error('이동 전에 좌표와 압출 원점을 설정해야 해요.');
  only(['X','Y','Z','E','F']);if(v.F!==undefined){if(v.F<60||v.F>9000)throw Error('경로 속도가 허용 범위를 벗어났어요.');feed=v.F;}
  const nx=v.X??x,ny=v.Y??y,nz=v.Z??z,ne=v.E===undefined?e:relativeE?e+v.E:v.E,delta=ne-e,distance=Math.hypot(nx-x,ny-y),travel=Math.hypot(distance,nz-z);
  if(![nx,ny,nz,ne,feed].every(Number.isFinite)||feed<=0||!inside(nx,ny)&&!(parked&&nx===90&&ny===90&&delta<=0)||nz<0||nz>height+.61)throw Error('경로가 키캡 또는 높이 범위를 벗어났어요.');
  if(delta < -1.21 || delta>1.21&&distance<.001)throw Error('압출 또는 리트랙션 양을 확인해주세요.');
  // Four-decimal output: a ~0.001mm segment carrying the 0.0001mm E step reads as 14mm³/s or 0.09mm/mm. Such
  // quantization-scale moves count as rounding residue below (capped per file) instead of a real extrusion line.
  const residue=delta>0&&delta<=.00051&&distance<.01;
  if(delta>0&&distance>.001&&!residue){
   const flow=delta/distance*feed/60*Math.PI*(1.75/2)**2,why=nz<=0||nz>height+.11?'높이 Z'+round(nz)+'mm가 모델 범위 밖':Math.abs(nz-z)>.001?'압출 중 높이 변경':delta/distance>.09?'1mm당 '+(delta/distance).toFixed(3)+'mm 압출(한도 0.09)':flow>12.01?'초당 '+flow.toFixed(1)+'mm³(한도 12)':debt>.001?'리트랙션 상태에서 압출':!inside(x,y)?'안전 영역 밖':'';
   // The reason, layer and feature make a rejected slice diagnosable from a screenshot.
   if(why)throw Error('압출 경로 또는 재료량이 올바르지 않아요. ('+(layers.length+(layer&&Math.abs(layer.z-nz)<=.001?0:1))+'층 · '+({shell:'외벽',solid:'윗면·바닥',infill:'채움',support:'서포트',path:'경로'}[feature]||feature)+' · '+why+')');
   extruded+=delta;if(!layer||Math.abs(layer.z-nz)>.001){if(layer&&Math.abs(nz-layer.z-layerHeight)>.011||!layer&&Math.abs(nz-.2)>.011)throw Error('선택한 출력 층 순서가 올바르지 않아요.');layer={z:round(nz),segments:[],features:[]};layers.push(layer);}
   if(layer.segments.length>=20000)throw Error('한 층의 경로가 너무 많아요.');layer.segments.push([x-90,y-90,nx-90,ny-90].map(round));layer.features.push(feature);
  }else if(delta<0){retract-=delta;debt-=delta;if(debt>1.22||feed>1800)throw Error('리트랙션 양 또는 속도가 너무 커요.');}
  else if(delta>0){
   // Four-decimal XY rounding can collapse a tiny fill segment to the same point.
   // Limit a file's unpaired residue to 0.5mm of filament (studio) or 0.05mm per 14mm keycap.
   if((studio||residue)&&debt<.001&&delta<=.00051){roundingPrime+=delta;extruded+=delta;if(roundingPrime>(studio?.5:pair?.1:.05))throw Error('미세 압출 잔여량이 너무 많습니다.');}
   else{debt-=delta;if(debt<-.001||feed>1800)throw Error('재료 복원량 또는 압출 속도가 올바르지 않아요.');}
  }
  if(feed>0)seconds+=(travel||Math.abs(delta))*60/feed;
  if(moves.length>=(studio?500000:100000))throw Error('경로 명령이 너무 많아요.');moves.push({command,x:nx,y:ny,z:nz,e:ne,delta,distance,feed});if(nx!==90||ny!==90)parked=false;x=nx;y=ny;z=nz;e=ne;
 }
 if(!layers.length||layers.length>Math.ceil((height-.2)/layerHeight)+2||extruded<(studio ? .2 : 5)||extruded>(studio?500000:600)||retract>(studio?50000:1000))throw Error('층수 또는 총 재료량이 허용 범위를 벗어났어요.');
 if(strict&&(!commands.has('G90')||!commands.has('G92')||!commands.has('M82')&&!commands.has('M83')))throw Error('절대 좌표와 압출 원점 설정이 필요해요.');
 return {paths:layers,layers:layers.length,height:layers.at(-1).z,filamentMM:extruded,weightG:extruded*Math.PI*(1.75/2)**2*1.24/1000,seconds,moves};
}
root.analyzeToolpaths=analyzeToolpaths;root.BOOTH_PAIR_OFFSET=PAIR_OFFSET;if(typeof module==='object'&&module.exports)module.exports={analyzeToolpaths,PAIR_OFFSET};
})(typeof globalThis==='object'?globalThis:this);
