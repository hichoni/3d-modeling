const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),{Worker}=require('node:worker_threads'),THREE=require('../vendor/three.min.js');
const core=require('../src/studio-core.js'),PrintJob=require('../src/print-job.js'),{prepareStudioJob}=require('../bridge/browser-job.cjs'),{zipEntries}=require('../bridge/core.cjs');
const machine=JSON.parse(fs.readFileSync(path.join(__dirname,'../bridge/profiles/a1-mini-pla.json'),'utf8'));
function cube(x=20,y=16,z=10){let g=new THREE.BoxGeometry(x,y,z);if(g.index)g=g.toNonIndexed();const v=new Float32Array(g.getAttribute('position').array);for(let i=2;i<v.length;i+=3)v[i]+=z/2;g.dispose();return v;}
function slice(stl,studio){return new Promise((resolve,reject)=>{const w=new Worker(path.join(__dirname,'helpers/browser-worker.cjs'),{workerData:{bundle:path.resolve('vendor/kiri/fdm-worker.js')}}),timer=setTimeout(()=>finish(Error('Studio engine timeout')),30000);function finish(error,result){clearTimeout(timer);w.terminate();error?reject(error):resolve(result);}w.on('error',e=>finish(e));w.on('message',m=>{if(m.type==='loaded'){const bytes=stl.buffer.slice(stl.byteOffset,stl.byteOffset+stl.byteLength);w.postMessage({id:'print-job-test',mode:'studio',studio,stl:bytes},[bytes]);}else if(m.type==='done')finish(null,m);else if(m.type==='error')finish(Error(m.message));});});}
function png(w,h){const raw=Buffer.alloc((w*3+1)*h),chunk=(t,d)=>{const len=Buffer.alloc(4);len.writeUInt32BE(d.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(PrintJob.crc32(Buffer.concat([Buffer.from(t),d])));return Buffer.concat([len,Buffer.from(t),d,crc]);},ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}

test('md5 matches node:crypto for empty, boundary and multi-megabyte inputs',()=>{
 for(const n of [0,1,55,56,63,64,65,1000,3*1024*1024+7]){const b=crypto.randomBytes(n);assert.equal(PrintJob.md5(new Uint8Array(b)),crypto.createHash('md5').update(b).digest('hex'),'length '+n);}
 assert.equal(PrintJob.md5('G1 X1\n'),crypto.createHash('md5').update('G1 X1\n').digest('hex'));
});

test('the Chromebook builder writes the same .gcode.3mf entries as the relay, plus the plate thumbnail',async()=>{
 const studio=core.settings(),stl=core.binarySTL(core.transform(cube(),{position:[60,70]})),r=await slice(stl,studio);
 const body={studio,profile:r.profile,gcode:r.gcode,stl:Buffer.from(stl).toString('base64'),seconds:r.summary.time};
 const relay=prepareStudioJob(body),browser=await PrintJob.prepareJob(body,{studio:true,machine}),a=zipEntries(relay.bytes),b=zipEntries(Buffer.from(browser.bytes));
 assert.deepEqual([...b.keys()],[...a.keys()]);for(const name of a.keys())assert.ok(a.get(name)().equals(b.get(name)()),name);
 assert.equal(browser.sha256,crypto.createHash('sha256').update(browser.bytes).digest('hex'));assert.deepEqual(browser.slice,relay.slice);
 assert.equal(a.get('Metadata/plate_1.gcode.md5')().toString(),crypto.createHash('md5').update(a.get('Metadata/plate_1.gcode')()).digest('hex'));
 const thumb=png(512,512),small=png(128,128),withThumb=await PrintJob.prepareJob({...body,thumbnail:thumb.toString('base64'),thumbnailSmall:small.toString('base64')},{studio:true,machine}),entries=zipEntries(Buffer.from(withThumb.bytes));
 assert.ok(entries.get('Metadata/plate_1.png')().equals(thumb));assert.ok(entries.get('Metadata/plate_1_small.png')().equals(small));assert.match(entries.get('Metadata/model_settings.config')().toString(),/thumbnail_file/);
 assert.equal(withThumb.slice.thumbnail,true);assert.ok(entries.get('Metadata/plate_1.gcode')().equals(a.get('Metadata/plate_1.gcode')()));
 assert.throws(()=>PrintJob.prepareFiles({...body,thumbnail:Buffer.from('GIF89a-not-png-but-long-enough-to-check').toString('base64')},{studio:true,machine}),/PNG/);
 assert.throws(()=>PrintJob.prepareFiles({...body,thumbnail:png(1024,1024).toString('base64')},{studio:true,machine}),/크기/);
});

test('operator ZIP and Windows payload include every module the relay requires',()=>{
 const listed=file=>new Set([...fs.readFileSync(path.join(__dirname,'..',file),'utf8').matchAll(/'((?:bridge|src)\/[^']+\.(?:cjs|js|json|pem))'/g)].map(m=>m[1]));
 const zip=listed('scripts/package-operator.cjs'),payload=listed('desktop/prepare-payload.cjs'),seen=new Set(),queue=['bridge/server.cjs'];
 while(queue.length){const file=queue.shift();if(seen.has(file))continue;seen.add(file);const text=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  for(const m of text.matchAll(/require\('(\.{1,2}\/[^']+)'\)/g)){const dep=path.posix.normalize(path.posix.join(path.posix.dirname(file),m[1]));queue.push(dep);}}
 for(const file of seen){assert.ok(zip.has(file),'ZIP missing '+file);assert.ok(payload.has(file),'payload missing '+file);}
 assert.ok(seen.has('src/print-job.js'));
});
