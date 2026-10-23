// Puffy (말랑) relief and two-level characters: the dome profile and the saved-design rules.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three.min.js');
const c=vm.createContext({THREE,Blob,TextEncoder,Uint8Array,Uint32Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,DataView,Math,document:{}});vm.runInContext(fs.readFileSync('src/state.js','utf8')+fs.readFileSync('src/engine.js','utf8'),c);
const run=code=>vm.runInContext(code,c);
// A 40 x 40 px square (2 mm at 20 px/mm) inside a 60 x 60 canvas.
function bar(){const W=60,H=60,a=new Float32Array(W*H);for(let y=10;y<50;y++)for(let x=10;x<50;x++)a[y*W+x]=1;return {a,W,H};}
test('distance to the outline is exact inside a bar and zero outside',()=>{
 const {a,W,H}=bar();c.a=a;const d=run(`distanceInside(a,${W},${H})`);
 assert.equal(d[0],0);assert.ok(Math.abs(d[30*W+30]-19.5)<1e-9,String(d[30*W+30]));assert.ok(Math.abs(d[10*W+30]-.5)<1e-9);assert.ok(Math.abs(d[30*W+11]-1.5)<1e-9);
});
test('puffy slabs keep a straight wall, then shrink inward as they rise to a flat top',()=>{
 const {a,W,H}=bar();c.a=a;const slabs=run(`puffSlabs(a,${W},${H},20,1.2)`);
 assert.equal(slabs.length,6);assert.deepEqual(Array.from(slabs,s=>+s.z1.toFixed(2)),[.2,.4,.6,.8,1,1.2]);
 const areas=Array.from(slabs,s=>s.alpha.reduce((n,v)=>n+(v>=.5),0));assert.equal(areas[0],1600);assert.equal(areas[1],1600,'0.4 mm wall');
 for(let i=1;i<areas.length;i++)assert.ok(areas[i]<=areas[i-1],JSON.stringify(areas));assert.ok(areas[5]>0&&areas[5]<areas[2],JSON.stringify(areas));
});
test('saved designs accept the puffy mode and the characters, nothing else',()=>{
 assert.equal(run(`restoreDesign({mode:'puffy'}).mode`),'puffy');
 for(const id of ['click','bear','cat','rabbit','chick','frog'])assert.equal(run(`restoreDesign({content:'icon',icon:'${id}'}).icon`),id);
 assert.equal(run(`restoreDesign({icon:'dragon'}).icon`),'heart');assert.equal(run(`restoreDesign({mode:'balloon'}).mode`),'relief');
 assert.equal(run('Object.keys(CHARACTERS).length'),6);
});
