// One print-file builder for both the relay (Node) and the Chromebook app (browser).
// Browser toolpaths are untrusted. Only the fixed, reviewed machine wrapper can home/heat.
(function(root){
const env=()=>typeof module==='object'&&module.exports?{toolpaths:require('./toolpaths.js'),profiles:require('./print-profiles.js'),studio:require('./studio-core.js')}:{toolpaths:root,profiles:root.WebPrintProfiles,studio:root.StudioCore};
const enc=new TextEncoder();
const bytesOf=v=>typeof v==='string'?enc.encode(v):v;

// --- Printer rules shared with bridge/core.cjs and bridge/print-preparation.cjs ---
// Booth plates: the 14 mm keycap insert or the 20 mm stamp plate, a rounded square with corner radius 0.2 x size.
const PLATE_SIZES=[14,20];
function insidePlate(x,y,size,slack=0){const half=size/2,c=size*.3;return Math.abs(x)<=half+slack&&Math.abs(y)<=half+slack&&Math.hypot(Math.max(0,Math.abs(x)-c),Math.max(0,Math.abs(y)-c))<=size*.2+slack;}
function validateSTL(b){
 if(b.length<134||b.length>6*1024*1024)throw Error('STL 크기가 올바르지 않습니다.');const v=new DataView(b.buffer,b.byteOffset,b.byteLength),n=v.getUint32(80,true);if(!n||84+n*50!==b.length)throw Error('공방에서 만든 바이너리 STL이 필요합니다.');
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],point=(o,k)=>[0,1,2].map(i=>v.getFloat32(o+12+k*12+i*4,true));
 for(let o=84;o<b.length;o+=50){for(let k=0;k<3;k++){const p=point(o,k);if(!p.every(Number.isFinite))throw Error('STL에 유효하지 않은 좌표가 있습니다.');for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i]);}}}
 const size=PLATE_SIZES.find(s=>Math.abs(hi[0]-lo[0]-s)<=.005&&Math.abs(hi[1]-lo[1]-s)<=.005);
 if(!size||Math.abs(lo[2])>.005||hi[2]<2||hi[2]>4.505)throw Error('14×14mm 또는 20×20mm, 바닥 Z=0, 전체 높이 2.0~4.5mm(도장) 모델만 지원합니다.');
 for(let o=84;o<b.length;o+=50)for(let k=0;k<3;k++){const p=point(o,k);if(!insidePlate(p[0],p[1],size,.002))throw Error('고정된 '+size+'mm 둥근 사각 바깥으로 모델이 벗어납니다.');}
 return {triangles:n,width:hi[0]-lo[0],depth:hi[1]-lo[1],height:hi[2],size};
}
function checkReady(mqtt){if(!mqtt?.online||Date.now()-mqtt.lastReportAt>15000)throw Error('프린터의 최신 상태를 확인할 수 없습니다.');const s=mqtt.state;if(!['IDLE','FINISH'].includes(s.gcode_state))throw Error('프린터가 대기 상태가 아닙니다.');if(s.sdcard!==true)throw Error('SD 카드를 확인하세요.');if(Number(s.print_error)!==0)throw Error('프린터 본체의 안내를 확인하세요.');if(String(s.nozzle_diameter)!=='0.4')throw Error('0.4mm 노즐 설정이 필요합니다.');}
function checkStart(job,body,mqtt,active){
 if(job.state!=='queued'||job.startAttempted)throw Error('이 작업은 시작할 수 없습니다. 시작 명령은 반복 전송하지 않습니다.');
 if(active&&!['complete','failed','cancelled'].includes(active.state))throw Error('이전 출력 결과를 먼저 확인하세요.');
 checkReady(mqtt);
 if(body.bedClear!==true||body.plaReady!==true||body.sha256!==job.sha256)throw Error('선택한 파일, 빈 베드, 외부 PLA 확인이 필요합니다.');
}
function matchesJob(state,job){return state.subtask_id!==undefined&&String(state.subtask_id)!=='0'?String(state.subtask_id)===job.printId:state.subtask_name==='Click_'+job.id;}
function attention(s={}){if(Number(s.print_error)===50364437)return '외부 스풀 필라멘트가 감지되지 않습니다. 본체에서 외부 PLA를 로드한 뒤 다시 시작(Resume)을 선택하세요.';if(Number(s.print_error)===134184967)return '노즐에서 필라멘트가 나오는지 현장에서 확인 후 본체의 계속 또는 재시도를 선택하세요.';if(s.gcode_state==='PAUSE')return '출력이 일시 정지됐습니다. 운영자가 본체 안내를 확인하세요.';if(Number(s.print_error)>0)return '프린터에 확인이 필요한 오류가 있습니다. 본체 안내를 확인하세요.';return '';}
// Only the two reviewed firmware flags are configurable. Machine/profile settings stay fixed.
function printOptions(input){
 if(input===undefined)return {bedLeveling:true,flowCalibration:true};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['bedLeveling','flowCalibration'].includes(k))||Object.values(input).some(v=>typeof v!=='boolean'))throw Error('출력 전 보정 설정을 다시 확인해주세요.');
 return {bedLeveling:input.bedLeveling??true,flowCalibration:input.flowCalibration??true};
}
const text=v=>typeof v==='string'?v.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,40):'';
function tray(value,source,slot){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const raw=text(value.tray_color).toUpperCase(),color=/^[A-F0-9]{8}$/.test(raw)&&raw.slice(6)!=='00'?'#'+raw.slice(0,6):/^[A-F0-9]{6}$/.test(raw)?'#'+raw:null;
 const temp=v=>Number.isFinite(Number(v))&&Number(v)>=80&&Number(v)<=400?Number(v):null;
 return {source,slot,type:text(value.tray_type)||null,color,nozzleMin:temp(value.nozzle_temp_min),nozzleMax:temp(value.nozzle_temp_max)};
}
function filament(state,fresh){
 if(!fresh)return {fresh:false,external:null,slots:[],active:null};
 const external=tray(state.vt_tray,'external',254),slots=[];
 for(const ams of (Array.isArray(state.ams?.ams)?state.ams.ams:[]).slice(0,16)){
  const id=Number(ams.id);if(!Number.isInteger(id)||id<0||id>15)continue;
  for(const item of (Array.isArray(ams.tray)?ams.tray:[]).slice(0,4)){const slot=Number(item.id);if(!Number.isInteger(slot)||slot<0||slot>3)continue;const t=tray(item,'ams',id*4+slot);if(t)slots.push(t);}
 }
 const now=state.ams?.tray_now,id=now===undefined||now===null||now===''?null:Number(now);
 return {fresh:true,external,slots,active:id===254?external:slots.find(t=>t.slot===id)||null};
}
function checkFilament(state){
 const f=filament(state,true),type=f.external?.type;
 if(type&&type.toUpperCase()!=='PLA')throw Error('현재 웹 프로필은 외부 PLA 전용입니다. 본체의 외부 스풀 설정과 실제 재료를 PLA로 맞춰주세요.');
 if(f.active?.source==='ams')throw Error('현재 웹 출력은 외부 스풀 전용입니다. 본체에서 외부 PLA를 준비해주세요.');
}

// --- MD5 for Metadata/plate_1.gcode.md5 (WebCrypto has no MD5). ---
function md5(input){
 const data=bytesOf(input),n=data.length,words=new Uint32Array(((n+8>>6)+1)*16),view=new DataView(words.buffer);
 for(let i=0;i<n;i++)words[i>>2]|=data[i]<<(i%4*8);words[n>>2]|=0x80<<(n%4*8);view.setUint32(words.length*4-8,(n*8)>>>0,true);view.setUint32(words.length*4-4,Math.floor(n/0x20000000),true);
 const S=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21],K=Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*2**32)>>>0);
 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 for(let o=0;o<words.length;o+=16){let a=a0,b=b0,c=c0,d=d0;
  for(let i=0;i<64;i++){let f,g;if(i<16){f=b&c|~b&d;g=i;}else if(i<32){f=d&b|~d&c;g=(5*i+1)%16;}else if(i<48){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=7*i%16;}
   const s=S[(i>>4)*4+i%4],x=(a+f+K[i]+words[o+g])|0;a=d;d=c;c=b;b=(b+(x<<s|x>>>32-s))|0;}
  a0=a0+a|0;b0=b0+b|0;c0=c0+c|0;d0=d0+d|0;}
 return [a0,b0,c0,d0].map(v=>Array.from({length:4},(_,i)=>(v>>>i*8&255).toString(16).padStart(2,'0')).join('')).join('');
}

// --- ZIP (store entries already deflated by the host: zlib in Node, CompressionStream in the browser). ---
const CRC=Array.from({length:256},(_,c)=>{for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function assembleZip(entries){
 const local=[],central=[];let offset=0;
 for(const {name,data,deflated} of entries){const n=enc.encode(name),crc=crc32(data),h=new DataView(new ArrayBuffer(30)),d=new DataView(new ArrayBuffer(46));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(8,8,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,deflated.length,true);h.setUint32(22,data.length,true);h.setUint16(26,n.length,true);local.push(new Uint8Array(h.buffer),n,deflated);
  d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(10,8,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,deflated.length,true);d.setUint32(24,data.length,true);d.setUint16(28,n.length,true);d.setUint32(42,offset,true);central.push(new Uint8Array(d.buffer),n);offset+=30+n.length+deflated.length;}
 const size=central.reduce((s,b)=>s+b.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
 const parts=[...local,...central,new Uint8Array(e.buffer)],out=new Uint8Array(parts.reduce((s,b)=>s+b.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;
}
function zipSync(files,deflateRaw){return assembleZip(Object.entries(files).map(([name,value])=>{const data=bytesOf(value);return {name,data,deflated:new Uint8Array(deflateRaw(data))};}));}
async function zipAsync(files){
 const deflate=async data=>new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
 const entries=[];for(const [name,value] of Object.entries(files)){const data=bytesOf(value);entries.push({name,data,deflated:await deflate(data)});}return assembleZip(entries);
}
function base64Bytes(value,max,label){
 if(typeof value!=='string'||value.length>max||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error(label);
 if(typeof Buffer==='function')return new Uint8Array(Buffer.from(value,'base64'));return Uint8Array.from(atob(value),c=>c.charCodeAt(0));
}
// Plate thumbnails as Bambu Studio writes them (plate_1.png 512px, plate_1_small.png 128px) for the printer screen. Optional, PNG only.
function thumbnail(value,limit=512){
 if(value===undefined||value===null||value==='')return null;const png=base64Bytes(value,700000,'미리보기 이미지가 올바르지 않습니다.');
 const sig=[137,80,78,71,13,10,26,10];if(png.length<33||sig.some((v,i)=>png[i]!==v)||String.fromCharCode(...png.subarray(12,16))!=='IHDR')throw Error('미리보기 이미지는 PNG여야 합니다.');
 const v=new DataView(png.buffer,png.byteOffset),w=v.getUint32(16),h=v.getUint32(20);if(w<16||h<16||w>limit||h>limit)throw Error('미리보기 이미지 크기가 올바르지 않습니다.');return png;
}

function modelXML(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),vertices=[],triangles=[];let n=0;for(let o=84;o<bytes.length;o+=50){for(let k=0;k<3;k++){const p=[0,1,2].map(i=>v.getFloat32(o+12+k*12+i*4,true));vertices.push(`<vertex x="${p[0]+90}" y="${p[1]+90}" z="${p[2]}"/>`);}triangles.push(`<triangle v1="${n++}" v2="${n++}" v3="${n++}"/>`);}
 return `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">Click Workshop Web</metadata><resources><object id="1" type="model"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
}
// Returns the .gcode.3mf entries; the caller zips and hashes them with its platform's deflate and SHA-256.
function prepareFiles(body,{studio=false,machine}={}){
 const {toolpaths:{analyzeToolpaths},profiles,studio:studioCore}=env();
 const profile=studio?studioCore.profile(body.studio):profiles.fromId(body.profile);if(body.profile!==profile.id)throw Error('선택한 프로필과 슬라이싱 결과가 다릅니다. 다시 계산해주세요.');
 const stl=base64Bytes(body.stl,8388608,'바이너리 STL이 필요합니다.'),png=thumbnail(body.thumbnail),small=png?thumbnail(body.thumbnailSmall,128):null;
 let dimensions;if(studio){const b=studioCore.validateBinary(stl);dimensions={triangles:b.triangles,width:b.size[0],depth:b.size[1],height:b.size[2],min:b.min,max:b.max,contactEdges:b.nonManifold};}else dimensions=validateSTL(stl);
 if(typeof body.gcode!=='string')throw Error('슬라이싱 경로가 없습니다. 다시 계산해주세요.');
 const size=studio?0:dimensions.size,analysis=analyzeToolpaths(body.gcode,{height:dimensions.height,strict:true,layerHeight:profile.height,studio,size});
 if(studio)for(const layer of analysis.paths)for(const segment of layer.segments)for(let point=0;point<2;point++){const x=segment[point*2]+90,y=segment[point*2+1]+90;if(x<dimensions.min[0]-3||x>dimensions.max[0]+3||y<dimensions.min[1]-3||y>dimensions.max[1]+3)throw Error('경로와 STL의 배치가 다릅니다. 다시 슬라이싱해주세요.');}
 if(analysis.height<dimensions.height-profile.height-.11)throw Error('모델의 위쪽 층이 누락됐습니다. 다시 슬라이싱해주세요.');
 // Re-emit parsed commands: never concatenate untrusted comments, tokens or macros into a machine file.
 const lines=body.gcode.split(/\r?\n/).map(s=>s.split(';')[0].trim().toUpperCase()).filter(Boolean);let layer=0,move=0;
 const clean=[];for(const line of lines){if(/^G[01](?:\s|$)/.test(line)){const m=analysis.moves[move++],target=analysis.paths[layer];if(target&&m.delta>0&&m.distance>.001&&Math.abs(m.z-target.z)<.001){clean.push('; CHANGE_LAYER',`M73 L${++layer}`,`M73 P${Math.floor((layer-1)/analysis.layers*100)}`,`M991 S0 P${layer}`);}}clean.push(line);}
 const seconds=Math.max(analysis.seconds,Math.min(studio?604800:3600,Number(body.seconds)||0)),weight=analysis.weightG;
 let start=machine.start,end=machine.end,lift=3.2;const edge=90-size/2;
 // Booth: bed mesh over the plate only (the profile's line is the 14 mm one).
 if(!studio)start=start.map(line=>/^G29 A1 /.test(line)?`G29 A1 X${edge} Y${edge} I${size} J${size}`:line);
 if(studio){const min=dimensions.min.slice(0,2).map(n=>Math.max(1,Math.floor(n-3))),max=dimensions.max.slice(0,2).map(n=>Math.min(179,Math.ceil(n+3)));lift=+(Math.max(dimensions.height,analysis.height)+2).toFixed(3);const park=Math.min(179,Math.max(dimensions.height,analysis.height)+100);
  start=start.map(line=>/^G29 A1 /.test(line)?`G29 A1 X${min[0]} Y${min[1]} I${max[0]-min[0]} J${max[1]-min[1]}`:line);
  end=end.map(line=>line.replace(/^G1 Z2\.8(?=\s|$)/,`G1 Z${lift}`).replace(/^G1 Z102\.4(?=\s|$)/,`G1 Z${park.toFixed(3)}`).replace(/^G1 Z100\.4(?=\s|$)/,`G1 Z${Math.max(lift,park-2).toFixed(3)}`));
 }
 const header=`; HEADER_BLOCK_START\n; generated by Click Workshop Web / Kiri:Moto 4.7.0\n; model printing time: ${Math.ceil(seconds)}s\n; total layer number: ${analysis.layers}\n; total filament length [mm] : ${analysis.filamentMM.toFixed(2)}\n; total filament weight [g] : ${weight.toFixed(3)}\n; filament_density: 1.24\n; filament_diameter: 1.75\n; max_z_height: ${analysis.height.toFixed(2)}\n; HEADER_BLOCK_END\n`;
 const gcode=header+'; EXECUTABLE_BLOCK_START\n'+start.join('\n')+'\n; WEB_MODEL_START\nG90\nG21\nM82\nG92 E0\nG1 Z5 F1200\nG1 X90 Y90 F6000\nM106 P1 S0\n'+clean.join('\n')+'\n; WEB_MODEL_END\nM400\nM83\nG92 E0\nG1 E-0.8 F1800\nG1 Z'+lift+' F900\n'+end.join('\n')+'\nM73 P100\n; EXECUTABLE_BLOCK_END\n';
 const prediction=Math.ceil(seconds+365);
 const files={
  '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="gcode" ContentType="application/octet-stream"/>'+(png?'<Default Extension="png" ContentType="image/png"/>':'')+'</Types>',
  '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'+(png?'<Relationship Target="/Metadata/plate_1.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>':'')+'</Relationships>',
  '3D/3dmodel.model':modelXML(stl),
  'Metadata/_rels/model_settings.config.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/Metadata/plate_1.gcode" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/gcode"/></Relationships>',
  'Metadata/model_settings.config':'<?xml version="1.0"?><config><plate><metadata key="plater_id" value="1"/><metadata key="gcode_file" value="Metadata/plate_1.gcode"/>'+(png?'<metadata key="thumbnail_file" value="Metadata/plate_1.png"/>':'')+'</plate></config>',
  'Metadata/slice_info.config':`<?xml version="1.0"?><config><header><header_item key="X-BBL-Client-Type" value="slicer"/><header_item key="X-BBL-Client-Version" value="02.07.01.62"/></header><plate><metadata key="index" value="1"/><metadata key="printer_model_id" value="N1"/><metadata key="nozzle_diameters" value="0.4"/><metadata key="timelapse_type" value="0"/><metadata key="prediction" value="${prediction}"/><metadata key="weight" value="${weight.toFixed(3)}"/><metadata key="outside" value="false"/><metadata key="support_used" value="${analysis.paths.some(layer=>layer.features.includes("support"))}"/><metadata key="label_object_enabled" value="false"/><filament id="1" tray_info_idx="GFL99" type="PLA" color="#FFFFFF" used_m="${(analysis.filamentMM/1000).toFixed(4)}" used_g="${weight.toFixed(3)}"/></plate></config>`,
  'Metadata/plate_1.json':JSON.stringify({bbox_all:studio?[...dimensions.min.slice(0,2),...dimensions.max.slice(0,2)]:[edge,edge,180-edge,180-edge],bbox_objects:[{area:studio?dimensions.width*dimensions.depth:+(size*size-(4-Math.PI)*(size*.2)**2).toFixed(1),bbox:studio?[...dimensions.min.slice(0,2),...dimensions.max.slice(0,2)]:[edge,edge,180-edge,180-edge],id:1,layer_height:profile.height,name:studio?'STL plate':'keycap'}],bed_type:'textured_plate',filament_colors:['#FFFFFF'],filament_ids:[0],first_extruder:0,is_seq_print:false,nozzle_diameter:.4,version:2}),
  'Metadata/project_settings.config':JSON.stringify({printer_model:'Bambu Lab A1 mini',printer_settings_id:'Bambu Lab A1 mini 0.4 nozzle',nozzle_diameter:['0.4'],curr_bed_type:'Textured PEI Plate',filament_type:['PLA'],filament_settings_id:[profile.materialLabel+' · Web'],layer_height:profile.height,initial_layer_print_height:.2}),
  'Metadata/plate_1.gcode':gcode,'Metadata/plate_1.gcode.md5':md5(gcode),
  ...(png?{'Metadata/plate_1.png':png}:{}),...(small?{'Metadata/plate_1_small.png':small}:{})
 };
 return {stl,files,dimensions,slice:{...analysis,moves:undefined,seconds,layerHeight:profile.height,source:'browser',workspace:studio?'studio':'booth',studio:studio?profile.studio:undefined,profile:profile.id,quality:profile.quality,material:profile.material,materialLabel:profile.materialLabel,topLayers:profile.top,bottomLayers:profile.bottom,timeScope:'model',machineProfile:machine.id+(studio?'-studio-v1':''),physicalValidation:'pending',thumbnail:!!png}};
}
async function sha256(bytes){return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
// Browser path: same entries, zipped with CompressionStream.
async function prepareJob(body,options){const r=prepareFiles(body,options),bytes=await zipAsync(r.files);return {...r,bytes,sha256:await sha256(bytes)};}
const api={PLATE_SIZES,insidePlate,validateSTL,checkReady,checkStart,matchesJob,attention,printOptions,filament,checkFilament,md5,crc32,assembleZip,zipSync,zipAsync,thumbnail,prepareFiles,prepareJob,sha256};
root.PrintJob=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
