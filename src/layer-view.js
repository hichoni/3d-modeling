// Visualization only: the toolpaths and printing profile are never changed here.
(function(root){
const LAYER_COLORS={shell:0x168e96,infill:0xf3a12b,solid:0x5197dd,path:0xf3a12b};
function firstInfillLayer(paths){const i=paths?.findIndex(layer=>layer.features?.includes('infill'))??-1;return i<0?null:i+1;}
function layerFeatureSummary(layer){const kinds=new Set(layer?.features||[]);return kinds.has('infill')?'infill':kinds.has('solid')?'solid':kinds.has('shell')?'shell':'path';}
function layerDisplayPlan(paths,n,mode='stack'){const end=Math.max(0,Math.min(paths?.length||0,n));return {complete:mode==='stack'&&end>0&&end===paths.length,completed:mode==='stack'?(paths||[]).slice(0,Math.max(0,end-1)):[],current:paths?.[end-1]||null};}
function layerStackPositions(layers){const arrays=layers.map((layer,i)=>layerRibbonPositions(layer.segments,layer.z,.43,Math.max(.01,layer.z-(layers[i-1]?.z||0)-.005))),result=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const a of arrays){result.set(a,offset);offset+=a.length;}return result;}
function layerRibbonPositions(segments,z,width=.42,height=.18){
 const positions=[];
 for(const [x1,y1,x2,y2]of segments){
  const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);if(length<.0001)continue;
  const radius=width/2,angle=Math.atan2(dy,dx),lo=z-height,ring=[];
  for(let i=0;i<=4;i++){const a=angle-Math.PI/2+i*Math.PI/4;ring.push([x2+Math.cos(a)*radius,y2+Math.sin(a)*radius]);}
  for(let i=0;i<=4;i++){const a=angle+Math.PI/2+i*Math.PI/4;ring.push([x1+Math.cos(a)*radius,y1+Math.sin(a)*radius]);}
  const center=[(x1+x2)/2,(y1+y2)/2];
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];
   positions.push(...center,z,...a,z,...b,z,...center,lo,...b,lo,...a,lo,...a,lo,...b,lo,...b,z,...a,lo,...b,z,...a,z);
  }
 }
 return new Float32Array(positions);
}
Object.assign(root,{LAYER_COLORS,firstInfillLayer,layerFeatureSummary,layerRibbonPositions,layerDisplayPlan,layerStackPositions});
if(typeof module==='object'&&module.exports)module.exports={LAYER_COLORS,firstInfillLayer,layerFeatureSummary,layerRibbonPositions,layerDisplayPlan,layerStackPositions};
})(typeof globalThis==='object'?globalThis:this);
