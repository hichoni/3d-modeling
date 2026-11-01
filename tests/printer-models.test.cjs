// A1 mini · A1 · X1C · P2S · X2D: discovery codes, the print lock on models not yet verified, and print files that
// follow a machine's bed (A1/X1C/P2S/X2D have 256 mm beds) while the A1 mini's stay unchanged.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Worker}=require('node:worker_threads'),THREE=require('../vendor/three.min.js');
const PM=require('../src/printer-models.js'),core=require('../src/studio-core.js'),PrintJob=require('../src/print-job.js'),{zipEntries}=require('../bridge/core.cjs');
const machine=JSON.parse(fs.readFileSync(path.join(__dirname,'../bridge/profiles/a1-mini-pla.json'),'utf8'));
function cube(x=20,y=16,z=10){let g=new THREE.BoxGeometry(x,y,z);if(g.index)g=g.toNonIndexed();const v=new Float32Array(g.getAttribute('position').array);for(let i=2;i<v.length;i+=3)v[i]+=z/2;g.dispose();return v;}
function slice(stl,studio){return new Promise((resolve,reject)=>{const w=new Worker(path.join(__dirname,'helpers/browser-worker.cjs'),{workerData:{bundle:path.resolve('vendor/kiri/fdm-worker.js')}}),timer=setTimeout(()=>finish(Error('Studio engine timeout')),30000);function finish(error,result){clearTimeout(timer);w.terminate();error?reject(error):resolve(result);}w.on('error',e=>finish(e));w.on('message',m=>{if(m.type==='loaded'){const bytes=stl.buffer.slice(stl.byteOffset,stl.byteOffset+stl.byteLength);w.postMessage({id:'print-job-test',mode:'studio',studio,stl:bytes},[bytes]);}else if(m.type==='done')finish(null,m);else if(m.type==='error')finish(Error(m.message));});});}

test('every target model is known by its Bambu codes, and only the A1 mini prints',()=>{
 const want={N1:'A1 mini',N2S:'A1','BL-P001':'X1C','3DPrinter-X1-Carbon':'X1C',N7:'P2S',N6:'X2D'};
 for(const [code,name] of Object.entries(want))assert.equal(PM.fromCode(code)?.name,name,code);
 assert.equal(PM.fromCode('C12'),null);
 assert.deepEqual(PM.MODELS.filter(PM.printable).map(m=>m.name),['A1 mini']);
 assert.match(PM.lockedReason(PM.byId('x1c')),/X1C.*검증 전/);
 for(const m of PM.MODELS)assert.ok(m.bed[0]>=180&&m.height>=180&&m.nozzles>=1,m.name);
});

test('a 256 mm bed gets the same toolpaths moved to its centre, with its model in the metadata',async()=>{
 const studio=core.settings(),stl=core.binarySTL(core.transform(cube(),{position:[90,90]})),r=await slice(stl,studio);
 const body={studio,profile:r.profile,gcode:r.gcode,stl:Buffer.from(stl).toString('base64'),seconds:r.summary.time};
 const read=job=>{const e=zipEntries(Buffer.from(job.bytes));return {gcode:e.get('Metadata/plate_1.gcode')().toString(),info:e.get('Metadata/slice_info.config')().toString(),settings:JSON.parse(e.get('Metadata/project_settings.config')()),plate:JSON.parse(e.get('Metadata/plate_1.json')())};};
 const mini=read(await PrintJob.prepareJob(body,{studio:true,machine}));
 const wide=read(await PrintJob.prepareJob(body,{studio:true,machine:{...machine,bed:[256,256],modelId:'N2S',printerModel:'Bambu Lab A1'}}));
 assert.match(mini.info,/printer_model_id" value="N1"/);assert.equal(mini.settings.printer_model,'Bambu Lab A1 mini');assert.match(mini.gcode,/\nG1 X90 Y90 F6000\n/);
 assert.match(wide.info,/printer_model_id" value="N2S"/);assert.equal(wide.settings.printer_settings_id,'Bambu Lab A1 0.4 nozzle');assert.match(wide.gcode,/\nG1 X128 Y128 F6000\n/);
 const xy=g=>[...g.split('; WEB_MODEL_START')[1].split('; WEB_MODEL_END')[0].matchAll(/^G1 [^\n]*X(-?[\d.]+) Y(-?[\d.]+)/gm)].map(m=>[+m[1],+m[2]]);
 const a=xy(mini.gcode),b=xy(wide.gcode);assert.ok(a.length>50);assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i++){assert.ok(Math.abs(b[i][0]-a[i][0]-38)<1e-3&&Math.abs(b[i][1]-a[i][1]-38)<1e-3,'move '+i);}
 assert.deepEqual(wide.plate.bbox_all,mini.plate.bbox_all.map(n=>n+38));
});
