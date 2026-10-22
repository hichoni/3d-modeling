// Booth plates come in two sizes: the 14 mm keycap insert and the 20 mm plate of the big stamp head.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{Worker}=require('node:worker_threads');
const THREE=require('../vendor/three.min.js'),{analyzeToolpaths}=require('../src/toolpaths.js'),{prepareBrowserJob}=require('../bridge/browser-job.cjs'),{zipEntries,parseGcode}=require('../bridge/core.cjs'),PrintJob=require('../src/print-job.js');
const c=vm.createContext({THREE,Blob,TextEncoder,Uint8Array,Uint32Array,Int32Array,Float32Array,ArrayBuffer,DataView,document:{}});vm.runInContext(fs.readFileSync('src/state.js','utf8')+fs.readFileSync('src/engine.js','utf8'),c);
// A stamp plate: 3.0 mm base and a 1.5 mm block of "letters".
function stamp(size,{square=false}={}){c.size=size;c.square=square;return Buffer.from(vm.runInContext(`(()=>{S.shape=square?'rect':'rounded';const base=new THREE.ExtrudeGeometry(plateShape(size,size),{depth:3,bevelEnabled:false});const top=new THREE.BoxGeometry(size*.4,size*.3,1.51);top.translate(0,0,3.745);S.shape='rounded';return toSTL([base,top]);})()`,c));}
function slice(stl){return new Promise((resolve,reject)=>{const worker=new Worker(path.join(__dirname,'helpers/browser-worker.cjs'),{workerData:{bundle:path.resolve('vendor/kiri/fdm-worker.js')}});const timer=setTimeout(()=>done(Error('Engine timeout')),20000);function done(error,result){clearTimeout(timer);worker.terminate();error?reject(error):resolve(result);}worker.on('error',e=>done(e));worker.on('message',m=>{if(m.type==='loaded'){const bytes=stl.buffer.slice(stl.byteOffset,stl.byteOffset+stl.byteLength);worker.postMessage({id:'fixture',stl:bytes},[bytes]);}else if(m.type==='done')done(null,m);else if(m.type==='error')done(Error(m.message));});});}

test('the big stamp kind is always a mirrored 20 mm stamp, and the plate outline follows the size',()=>{
 const d=vm.runInContext(`restoreDesign({kind:'stamp20',mode:'relief'})`,c);assert.equal(d.kind,'stamp20');assert.equal(d.mode,'stamp');
 assert.equal(vm.runInContext(`restoreDesign({kind:'huge'}).kind`,c),'keycap');
 vm.runInContext(`S.kind='stamp20'`,c);assert.deepEqual({...vm.runInContext('dims()',c)},{w:20,h:20});
 const [x,y]=vm.runInContext('clampToInsert(30,30)',c);assert.ok(Math.hypot(x-6,y-6)<=4.0001&&x<=10&&y<=10,String([x,y]));
 vm.runInContext(`S.kind='keycap'`,c);assert.deepEqual({...vm.runInContext('dims()',c)},{w:14,h:14});
});
test('printer rules accept the 14 and 20 mm plates only, each inside its own rounded square',()=>{
 assert.equal(PrintJob.validateSTL(stamp(14)).size,14);assert.equal(PrintJob.validateSTL(stamp(20)).size,20);
 assert.throws(()=>PrintJob.validateSTL(stamp(17)),/14×14mm 또는 20×20mm/);
 assert.throws(()=>PrintJob.validateSTL(stamp(20,{square:true})),/20mm 둥근 사각/);
});
test('a 20 mm stamp slices in the browser engine and packs with a 20 mm bed mesh and bounding box',async()=>{
 for(const size of [14,20]){
  const stl=stamp(size),r=await slice(stl),a=analyzeToolpaths(r.gcode,{height:4.5,strict:true,size});assert.ok(a.layers>=21,String(a.layers));
  const edge=90-size/2,xs=a.paths.flatMap(l=>l.segments.flatMap(s=>[s[0],s[2]]));assert.ok(Math.max(...xs)>size/2-1,'paths reach the plate edge');
  if(size===20)assert.throws(()=>analyzeToolpaths(r.gcode,{height:4.5,strict:true,size:14}),/압출 경로|벗어/);
  const job=prepareBrowserJob({profile:r.profile,stl:stl.toString('base64'),gcode:r.gcode,seconds:r.summary.time}),entries=zipEntries(job.bytes),gcode=entries.get('Metadata/plate_1.gcode')().toString(),plate=JSON.parse(entries.get('Metadata/plate_1.json')());
  assert.match(gcode,new RegExp(`G29 A1 X${edge} Y${edge} I${size} J${size}\\n`));assert.deepEqual(plate.bbox_all,[edge,edge,180-edge,180-edge]);assert.equal(job.dimensions.size,size);
  assert.ok(parseGcode(gcode,size).length>=21,'the relay reads the same paths');
 }
});
