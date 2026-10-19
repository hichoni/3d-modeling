const fs=require('node:fs');
const file=process.argv[2];if(!file)throw Error('Usage: node scripts/inspect-stl.cjs <binary.stl>');
const buf=fs.readFileSync(file);const n=buf.readUInt32LE(80);if(buf.length!==84+n*50)throw Error('STL byte count mismatch');
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],edges=new Map();let degenerate=0;
for(let t=0;t<n;t++){
  const base=84+t*50,vertices=[];
  for(let j=0;j<12;j++)if(!Number.isFinite(buf.readFloatLE(base+j*4)))throw Error('Non-finite coordinate');
  for(let v=0;v<3;v++){const p=[];for(let d=0;d<3;d++){const x=buf.readFloatLE(base+12+v*12+d*4);min[d]=Math.min(min[d],x);max[d]=Math.max(max[d],x);p.push(x);}vertices.push(p);}
  const [a,b,c]=vertices;const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);if(area<1e-8)degenerate++;
  const keys=vertices.map(p=>p.map(x=>Math.round(x*1e4)).join(','));for(let i=0;i<3;i++){const edge=[keys[i],keys[(i+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}
}
const boundaryEdges=[...edges.values()].filter(n=>n===1).length;
const unusualEdges=[...edges.values()].filter(n=>n!==2).length;
console.log(JSON.stringify({triangles:n,min,max,size:max.map((v,i)=>v-min[i]),degenerate,boundaryEdges,unusualEdges,note:'Closed shells do not establish Boolean union or slicer compatibility.'},null,2));
if(degenerate||boundaryEdges||unusualEdges)process.exitCode=1;
