// Built with the pinned Kiri:Moto FDM worker. This file never connects to a printer.
import '../artifacts/grid-apps/src/kiri/run/worker.js';
import { conf } from '../artifacts/grid-apps/src/kiri/app/conf/defaults.js';
import { newWidget } from '../artifacts/grid-apps/src/kiri/core/widget.js';

function verticesFromSTL(bytes){
 const data=new DataView(bytes),count=data.getUint32(80,true);if(count<12||count>120000||bytes.byteLength!==84+count*50)throw Error('올바른 바이너리 STL이 필요해요.');
 const vertices=new Float32Array(count*9);let n=0;
 for(let face=0;face<count;face++)for(let v=0;v<3;v++)for(let d=0;d<3;d++){const value=data.getFloat32(84+face*50+12+v*12+d*4,true);if(!Number.isFinite(value))throw Error('좌표를 확인해주세요.');vertices[n++]=value;}
 return vertices;
}
function makeSettings(){
 const settings={mode:'FDM',controller:{units:'mm',lineType:'line',threaded:false,exportThumb:false},render:false,filter:{FDM:'internal'},device:structuredClone(conf.defaults.fdm.d),process:structuredClone(conf.defaults.fdm.p),widget:{'click-model':{}},time:Date.now()};
 Object.assign(settings.device,{deviceName:'A1 mini 0.4 - path research',bedWidth:180,bedDepth:180,maxHeight:180,originCenter:false,extrudeAbs:true,gcodePre:['; CLICK_BROWSER_PATHS_ONLY - NOT A PRINTABLE MACHINE FILE','G90','M82','G92 E0'],gcodePost:['; END CLICK_BROWSER_PATHS_ONLY'],gcodeFan:['M106 P1 S{fan_speed}'],gcodeLayer:[';LAYER:{layer}'],gcodeTrack:[],gcodePause:[],gcodeChange:[],extras:{},extruders:[{extFilament:1.75,extNozzle:.4,extSelect:['T0'],extOffsetX:0,extOffsetY:0}]});
 Object.assign(settings.process,{sliceHeight:.2,firstSliceHeight:.2,sliceShells:2,sliceTopLayers:3,sliceBottomLayers:3,sliceFillSparse:.15,sliceFillType:'grid',sliceLineWidth:.42,sliceFillOverlap:.15,outputShellMult:1,outputFillMult:1,outputSparseMult:1,outputBrimCount:0,outputBedTemp:65,outputTemp:220,firstLayerBedTemp:65,firstLayerNozzleTemp:220,firstLayerRate:25,firstLayerFillRate:30,outputFeedrate:70,outputFinishrate:50,outputSeekrate:100,outputRetractDist:.8,outputRetractSpeed:30,outputMinLayerTime:4,outputMaxFlowrate:12,sliceDetectThin:'basic'});
 return settings;
}
function invoke(task,data,onData=()=>{}){
 return new Promise((resolve,reject)=>{try{const result=self.kiri_worker.dispatch[task](data,{data:value=>{if(value?.error)reject(Error(value.error));else onData(value);},done:value=>value?.error?reject(Error(value.error)):resolve(value)});result?.catch?.(reject);}catch(e){reject(e);}});
}
self.onmessage=async event=>{
 const {id,stl}=event.data||{};if(!id||!(stl instanceof ArrayBuffer))return;
 const progress=(value,message)=>self.postMessage({id,type:'progress',value,message});
 try{
  const vertices=verticesFromSTL(stl),settings=makeSettings();await invoke('clear',{});
  const widget=newWidget('source').setInWorker().loadVertices(vertices).center();
  const bounds=widget.getBoundingBox(),height=bounds.max.z-bounds.min.z;
  if(Math.abs(bounds.max.x-bounds.min.x-14)>.03||Math.abs(bounds.max.y-bounds.min.y-14)>.03||height<2||height>2.51)throw Error('14mm 키캡 조각만 계산할 수 있어요.');
  widget.setTopZ(height);
  await invoke('sync',{id:'click-model',group:'click-model',meta:{file:'keycap.stl'},anno:{},track:widget.track,vertices:widget.getGeoVertices()});
  await invoke('slicePre',{settings});
  await invoke('slice',{id:'click-model',settings},data=>{if(data.update)progress(data.update*.7,'층과 외벽 계산');});
  await invoke('slicePost',{settings});
  await invoke('prepare',{settings},data=>{if(data.progress)progress(.7+data.progress*.2,'채움과 이동 경로 계산');});
  let chunks=[];const result=await invoke('export',{settings},data=>{if(typeof data.line==='string')chunks.push(data.line);});
  const gcode=chunks.join('\n');if(!gcode.includes('G1'))throw Error('압출 경로를 생성하지 못했어요.');
  self.postMessage({id,type:'done',gcode,summary:{...result.output,settings:undefined},profile:'click-paths-0.4-0.2-v1',printable:false});
 }catch(error){self.postMessage({id,type:'error',message:String(error.message||error)});}
};
