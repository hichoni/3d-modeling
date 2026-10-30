// The 2-key keychain prints its two 14 mm plates in one job, side by side 20 mm apart (34 x 14 mm overall).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{Worker}=require('node:worker_threads');
const THREE=require('../vendor/three.min.js'),{analyzeToolpaths,PAIR_OFFSET}=require('../src/toolpaths.js'),{prepareBrowserJob}=require('../bridge/browser-job.cjs'),{zipEntries,parseGcode}=require('../bridge/core.cjs'),PrintJob=require('../src/print-job.js');
const c=vm.createContext({THREE,Blob,TextEncoder,Uint8Array,Uint32Array,Int32Array,Float32Array,ArrayBuffer,DataView,document:{}});vm.runInContext(fs.readFileSync('src/state.js','utf8')+fs.readFileSync('src/engine.js','utf8'),c);
// Two plates: a 1.5 mm base each, a raised block on the left (to 2.3 mm) and a taller stamp-like one on the right (to 4.5 mm).
function pair({offset=PAIR_OFFSET,size=14}={}){c.offset=offset;c.size=size;return Buffer.from(vm.runInContext(`(()=>{const list=[];for(const [x,h] of [[-offset,2.3],[offset,4.5]]){const base=new THREE.ExtrudeGeometry(plateShape(size,size),{depth:1.5,bevelEnabled:false});base.translate(x,0,0);const top=new THREE.BoxGeometry(5,4,h-1.49);top.translate(x,0,1.49+(h-1.49)/2);list.push(base,top);}return toSTL(list);})()`,c));}
function slice(stl){return new Promise((resolve,reject)=>{const worker=new Worker(path.join(__dirname,'helpers/browser-worker.cjs'),{workerData:{bundle:path.resolve('vendor/kiri/fdm-worker.js')}});const timer=setTimeout(()=>done(Error('Engine timeout')),30000);function done(error,result){clearTimeout(timer);worker.terminate();error?reject(error):resolve(result);}worker.on('error',e=>done(e));worker.on('message',m=>{if(m.type==='loaded'){const bytes=stl.buffer.slice(stl.byteOffset,stl.byteOffset+stl.byteLength);worker.postMessage({id:'1',stl:bytes,quality:'standard',material:'generic'},[bytes]);}else if(m.type==='done')done(null,m);else if(m.type==='error')done(Error(m.message));});});}

test('both checks use the same pair layout',()=>{assert.equal(PrintJob.PAIR_OFFSET,PAIR_OFFSET);assert.equal(PAIR_OFFSET,10);});
test('printer rules accept a pair of 14 mm plates 20 mm apart, and nothing else that wide',()=>{
 const d=PrintJob.validateSTL(pair());assert.equal(d.size,14);assert.equal(d.pair,true);assert.equal(+d.width.toFixed(3),34);
 assert.equal(PrintJob.validateSTL(Buffer.from(vm.runInContext(`toSTL([new THREE.ExtrudeGeometry(plateShape(14,14),{depth:2.3,bevelEnabled:false})])`,c))).pair,false);
 assert.throws(()=>PrintJob.validateSTL(pair({offset:12})),/14×14mm 또는 20×20mm/);
 // 34 x 14 overall but one long bar: outside both rounded squares
 assert.throws(()=>PrintJob.validateSTL(Buffer.from(vm.runInContext(`(()=>{const g=new THREE.BoxGeometry(34,14,2.3);g.translate(0,0,1.15);return toSTL([g]);})()`,c))),/둥근 사각/);
});
test('a pair slices in the browser engine and packs with one bed mesh over both plates',async()=>{
 const stl=pair(),r=await slice(stl),a=analyzeToolpaths(r.gcode,{height:4.5,strict:true,size:14,pair:true});
 const xs=a.paths.flatMap(l=>l.segments.flatMap(s=>[s[0],s[2]]));assert.ok(Math.min(...xs)<-PAIR_OFFSET-5&&Math.max(...xs)>PAIR_OFFSET+5,'paths on both plates');
 assert.ok(a.paths.at(-1).segments.every(s=>s[0]>0&&s[2]>0),'only the taller right plate reaches the top');
 assert.throws(()=>analyzeToolpaths(r.gcode,{height:4.5,strict:true,size:14}),/벗어/);
 const job=prepareBrowserJob({profile:r.profile,stl:stl.toString('base64'),gcode:r.gcode,seconds:r.summary.time}),entries=zipEntries(job.bytes),gcode=entries.get('Metadata/plate_1.gcode')().toString(),plate=JSON.parse(entries.get('Metadata/plate_1.json')());
 assert.match(gcode,/G29 A1 X73 Y83 I34 J14\n/);assert.deepEqual(plate.bbox_all,[73,83,107,97]);assert.equal(plate.bbox_objects[0].name,'keycap pair');assert.equal(job.dimensions.pair,true);
 assert.ok(parseGcode(gcode,14,PAIR_OFFSET).length>=21,'the relay reads paths on both plates');
 // The printer screen counts down from M73 R (minutes left); percent and minutes only move forward.
 const m73=[...gcode.matchAll(/^M73 P(\d+) R(\d+)$/gm)].map(m=>[+m[1],+m[2]]);assert.ok(m73.length>=10);assert.equal(m73[0][0],0);assert.ok(m73[0][1]>=1);
 for(let i=1;i<m73.length;i++)assert.ok(m73[i][0]>=m73[i-1][0]&&m73[i][1]<=m73[i-1][1],'M73 '+m73[i]);assert.match(gcode,/^M73 P100$/m);
});

// A 3-key keychain: three plates in a row, 20 mm apart (54 x 14 mm overall).
function trio(){return Buffer.from(vm.runInContext(`(()=>{const list=[];for(const [x,h] of [[-20,2.3],[0,2.5],[20,4.5]]){const base=new THREE.ExtrudeGeometry(plateShape(14,14),{depth:1.5,bevelEnabled:false});base.translate(x,0,0);const top=new THREE.BoxGeometry(5,4,h-1.49);top.translate(x,0,1.49+(h-1.49)/2);list.push(base,top);}return toSTL(list);})()`,c));}
test('a set of three slices and packs with one bed mesh over all three plates, and counts as three prints',async()=>{
 const stl=trio(),d=PrintJob.validateSTL(stl);assert.equal(d.count,3);assert.equal(d.pair,true);assert.equal(+d.width.toFixed(3),54);
 const r=await slice(stl),a=analyzeToolpaths(r.gcode,{height:4.5,strict:true,size:14,count:3});
 const xs=a.paths.flatMap(l=>l.segments.flatMap(s=>[s[0],s[2]]));assert.ok(Math.min(...xs)<-25&&Math.max(...xs)>25&&xs.some(x=>Math.abs(x)<3),'paths on all three plates');
 assert.throws(()=>analyzeToolpaths(r.gcode,{height:4.5,strict:true,size:14,count:2}),/벗어/);assert.throws(()=>analyzeToolpaths(r.gcode,{height:4.5,strict:true,size:14,count:4}),/크기/);
 const job=prepareBrowserJob({profile:r.profile,stl:stl.toString('base64'),gcode:r.gcode,seconds:r.summary.time}),entries=zipEntries(job.bytes),gcode=entries.get('Metadata/plate_1.gcode')().toString(),plate=JSON.parse(entries.get('Metadata/plate_1.json')());
 assert.match(gcode,/G29 A1 X63 Y83 I54 J14\n/);assert.deepEqual(plate.bbox_all,[63,83,117,97]);assert.equal(plate.bbox_objects[0].name,'keycap set of 3');
 assert.ok(parseGcode(gcode,14,2*PAIR_OFFSET).length>=21);
 const counts=require('../src/statistics-core.js');assert.equal(counts.pieces({dimensions:job.dimensions}),3);
});
