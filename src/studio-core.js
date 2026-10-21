// Portable STL/project geometry shared by the studio UI, worker and relay.
(function(root){
 const limits={bed:180,margin:5,maxHeight:160,maxTriangles:120000,maxModels:6,maxBytes:6*1024*1024};
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e6;
 function bounds(v){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<v.length;i++){const n=v[i];if(!finite(n))throw Error('모델에 올바르지 않은 좌표가 있습니다.');const a=i%3;min[a]=Math.min(min[a],n);max[a]=Math.max(max[a],n);}return {min,max,size:max.map((n,i)=>n-min[i]),center:max.map((n,i)=>(n+min[i])/2)};}
 function inspect(v,{topology=true}={}){
  if(!(v instanceof Float32Array)||v.length%9||v.length<36||v.length/9>limits.maxTriangles)throw Error('삼각형 4~120,000개인 STL을 선택해주세요.');
  const b=bounds(v);let volume=0,degenerate=0,overhangArea=0;const edges=topology?new Map():null,key=p=>p.map(n=>Math.round(n*10000)).join(',');
  for(let i=0;i<v.length;i+=9){const a=Array.from(v.subarray(i,i+3)),c=Array.from(v.subarray(i+3,i+6)),d=Array.from(v.subarray(i+6,i+9)),u=c.map((n,k)=>n-a[k]),w=d.map((n,k)=>n-a[k]),cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],norm=Math.hypot(...cross);
   if(norm<1e-8){degenerate++;continue;}volume+=(a[0]*(c[1]*d[2]-c[2]*d[1])+a[1]*(c[2]*d[0]-c[0]*d[2])+a[2]*(c[0]*d[1]-c[1]*d[0]))/6;
   if(cross[2]/norm<-.707&&Math.min(a[2],c[2],d[2])>b.min[2]+.21)overhangArea+=norm/2;
   if(edges){const keys=[key(a),key(c),key(d)];for(let n=0;n<3;n++){const p=keys[n],q=keys[(n+1)%3],k=p<q?p+'|'+q:q+'|'+p;edges.set(k,(edges.get(k)||0)+1);}}
  }
  let openEdges=0,nonManifold=0;if(edges)for(const n of edges.values()){if(n===1)openEdges++;if(n>2)nonManifold++;}
  return {...b,triangles:v.length/9,volume:Math.abs(volume),signedVolume:volume,degenerate,openEdges,nonManifold,overhangArea,closed:topology?openEdges===0&&nonManifold===0&&Math.abs(volume)>.001:null};
 }
 function parseSTL(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.byteLength<84||bytes.byteLength>limits.maxBytes)throw Error('STL은 최대 6MB까지 불러올 수 있습니다.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=view.getUint32(80,true);let v;
  if(n>0&&84+n*50===bytes.byteLength){if(n>limits.maxTriangles)throw Error('삼각형이 120,000개를 넘습니다. 모델을 단순화해주세요.');v=new Float32Array(n*9);for(let i=0;i<n;i++)for(let j=0;j<9;j++)v[i*9+j]=view.getFloat32(84+i*50+12+j*4,true);}
  else{
   const text=new TextDecoder().decode(bytes);if(!/^\s*solid(?:\s|$)/i.test(text)||!/(?:^|\n)\s*endsolid\b/i.test(text))throw Error('올바른 바이너리 또는 ASCII STL이 아닙니다.');
   const values=[],number='([-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[-+]?\\d+)?)',vertex=new RegExp('vertex\\s+'+number+'\\s+'+number+'\\s+'+number,'gi');
   const facets=text.match(/facet\s+normal[\s\S]*?endfacet/gi)||[];for(const facet of facets){const points=[...facet.matchAll(vertex)];if(points.length!==3||!/outer\s+loop/i.test(facet)||!/endloop/i.test(facet))throw Error('ASCII STL의 삼각형 구성이 올바르지 않습니다.');for(const p of points)values.push(+p[1],+p[2],+p[3]);if(values.length/9>limits.maxTriangles)throw Error('삼각형이 너무 많습니다.');}
   if((text.match(/\bvertex\b/gi)||[]).length!==values.length/3)throw Error('ASCII STL에 해석할 수 없는 면이 있습니다.');v=new Float32Array(values);
  }
  const info=inspect(v);if(info.degenerate)throw Error('면적이 없는 삼각형이 있습니다. 원본 모델을 정리해주세요.');
  const out=new Float32Array(v.length);for(let i=0;i<v.length;i++)out[i]=v[i]-(i%3===2?info.min[2]:info.center[i%3]);return {vertices:out,info:inspect(out)};
 }
 function transform(v,t={}){
  const rotation=t.rotation||[0,0,0],position=t.position||[90,90],scale=t.scale??1;if(rotation.length!==3||position.length!==2||![...rotation,...position,scale].every(finite)||scale<=0||scale>1000)throw Error('배치·회전·배율 값을 확인해주세요.');
  const a=rotation.map(n=>n*Math.PI/180),s=a.map(Math.sin),c=a.map(Math.cos),out=new Float32Array(v.length);let low=Infinity;
  for(let i=0;i<v.length;i+=3){let x=v[i]*scale,y=v[i+1]*scale,z=v[i+2]*scale;[y,z]=[y*c[0]-z*s[0],y*s[0]+z*c[0]];[x,z]=[x*c[1]+z*s[1],-x*s[1]+z*c[1]];[x,y]=[x*c[2]-y*s[2],x*s[2]+y*c[2]];out[i]=x+position[0];out[i+1]=y+position[1];out[i+2]=z;low=Math.min(low,z);}
  const box=bounds(out),dx=box.center[0]-position[0],dy=box.center[1]-position[1];for(let i=0;i<out.length;i+=3){out[i]-=dx;out[i+1]-=dy;out[i+2]-=low;}return out;
 }
 function merge(models){if(!models.length||models.length>limits.maxModels)throw Error('모델은 한 플레이트에 1~6개까지 올릴 수 있습니다.');const all=models.map(m=>transform(m.vertices,m.transform)),count=all.reduce((n,v)=>n+v.length,0);if(count/9>limits.maxTriangles)throw Error('플레이트 전체 삼각형은 120,000개 이하로 준비해주세요.');const merged=new Float32Array(count);let i=0;for(const v of all){merged.set(v,i);i+=v.length;}return merged;}
 function binarySTL(v,{relative=true}={}){const bytes=new Uint8Array(84+v.length/9*50),d=new DataView(bytes.buffer);d.setUint32(80,v.length/9,true);for(let i=0;i<v.length;i+=9){const o=84+i/9*50,u=[v[i+3]-v[i],v[i+4]-v[i+1],v[i+5]-v[i+2]],w=[v[i+6]-v[i],v[i+7]-v[i+1],v[i+8]-v[i+2]],n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],length=Math.hypot(...n)||1;for(let k=0;k<3;k++)d.setFloat32(o+k*4,n[k]/length,true);for(let k=0;k<9;k++)d.setFloat32(o+12+k*4,v[i+k]-(relative&&k%3!==2?90:0),true);}return bytes;}
 function validateVertices(v){const b=inspect(v,{topology:false});if(b.size[0]<.42||b.size[1]<.42||b.size[2]<.2||b.max[2]>limits.maxHeight+.001||Math.abs(b.min[2])>.005||b.min[0]<5-.001||b.min[1]<5-.001||b.max[0]>175+.001||b.max[1]>175+.001)throw Error('모델을 안전 영역 170 × 170 × 160mm 안에 배치해주세요.');return b;}
 function validateBinary(bytes){if(bytes.byteLength<284||bytes.byteLength>limits.maxBytes)throw Error('스튜디오에서 준비한 바이너리 STL이 필요합니다.');const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(84+d.getUint32(80,true)*50!==bytes.byteLength)throw Error('STL 파일 길이가 올바르지 않습니다.');const v=new Float32Array(d.getUint32(80,true)*9);for(let i=0;i<v.length;i++)v[i]=d.getFloat32(84+Math.floor(i/9)*50+12+i%9*4,true)+(i%3===2?0:90);validateVertices(v);const info=inspect(v);if(!info.closed||info.degenerate)throw Error('열린 모서리 또는 겹치는 면이 있습니다. 원본 STL의 메쉬를 정리해주세요.');return info;}
 function settings(input={}){const allowed=['quality','material','infill','walls','supports','brim','speed'];if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('지원하지 않는 스튜디오 설정입니다.');const out={quality:'standard',material:'generic',infill:15,walls:2,supports:false,brim:false,speed:'standard',...input};if(!['fine','balanced','standard'].includes(out.quality)||!['generic','matte'].includes(out.material)||![0,10,15,20,30,50,100].includes(out.infill)||![2,3,4,5].includes(out.walls)||typeof out.supports!=='boolean'||typeof out.brim!=='boolean'||!['quiet','standard'].includes(out.speed))throw Error('슬라이싱 설정 값을 확인해주세요.');return out;}
 function profile(input){const studio=settings(input),base=root.WebPrintProfiles.get(studio.quality,studio.material);return {...base,studio,id:`studio-0.4-${base.height}-${studio.material}-w${studio.walls}-i${studio.infill}-s${+studio.supports}-b${+studio.brim}-${studio.speed}-v1`};}
 function arrange(models){let x=8,y=8,row=0;const result=[];for(const model of models){const t={...model.transform,position:[90,90]},b=bounds(transform(model.vertices,t)),[w,d]=b.size;if(w>164||d>164)throw Error('자동 배치 전 큰 모델의 크기를 줄여주세요.');if(x+w>172){x=8;y+=row+5;row=0;}if(y+d>172)throw Error('한 플레이트에 모두 배치할 공간이 부족합니다.');result.push([x+w/2,y+d/2]);x+=w+5;row=Math.max(row,d);}const combined=result.map((p,i)=>{const b=bounds(transform(models[i].vertices,{...models[i].transform,position:p}));return b;}),min=[Math.min(...combined.map(b=>b.min[0])),Math.min(...combined.map(b=>b.min[1]))],max=[Math.max(...combined.map(b=>b.max[0])),Math.max(...combined.map(b=>b.max[1]))];return result.map(p=>p.map((n,k)=>n+90-(min[k]+max[k])/2));}
 function overlaps(models){const boxes=models.map(m=>bounds(transform(m.vertices,m.transform))),pairs=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if([0,1].every(k=>Math.min(boxes[i].max[k],boxes[j].max[k])-Math.max(boxes[i].min[k],boxes[j].min[k])>-.1))pairs.push([i,j]);return pairs;}
 const api={limits,bounds,inspect,parseSTL,transform,merge,binarySTL,validateVertices,validateBinary,settings,profile,arrange,overlaps};root.StudioCore=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
