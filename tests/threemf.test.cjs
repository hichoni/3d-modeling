const test=require('node:test'),assert=require('node:assert/strict');
const ThreeMF=require('../src/threemf.js');

const {zip,box,bambuProject}=require('./helpers/make-3mf.cjs');

test('3MF: Bambu project plates, split object files, modifiers, instances and settings',async()=>{
 for(const zip64 of [false,true]){
  const r=await ThreeMF.parse3MF(bambuProject({zip64}));
  assert.equal(r.title,'Test & Keychain');assert.deepEqual(r.plates.map(p=>[p.id,p.name,p.objects.map(o=>o.name)]),[[1,'Main',['Keychain','Base plate']],[2,'',['Base plate']]]);
  const key=r.plates[0].objects[0].vertices;assert.equal(key.length/9,12,'modifier part is not printed');
  const xs=[...key].filter((_,i)=>i%3===0);assert.deepEqual([Math.min(...xs),Math.max(...xs)],[95,105]);
  const base2=[...r.plates[1].objects[0].vertices].filter((_,i)=>i%3===0);assert.deepEqual([Math.min(...base2),Math.max(...base2)],[306,326],'second instance uses its own build item');
  assert.deepEqual(r.settings,{quality:'balanced',infill:20,walls:3,supports:true,brim:false});
  assert.equal(r.profile.printer,'Bambu Lab X1 Carbon');assert.ok(r.plates[0].thumbnailBytes);
  assert.ok(r.warnings.some(w=>/modifier/.test(w)));assert.ok(r.warnings.some(w=>/PLA가 아니에요/.test(w)));assert.ok(r.warnings.some(w=>/여러 색/.test(w)));
 }
});

test('3MF: plain single-file 3MF without Bambu metadata becomes one plate',async()=>{
 const r=await ThreeMF.parse3MF(zip({'3D/3dmodel.model':`<model unit="centimeter"><resources><object id="1">${box(1)}</object></resources><build><item objectid="1"/></build></model>`}));
 assert.equal(r.plates.length,1);const xs=[...r.plates[0].objects[0].vertices].filter((_,i)=>i%3===0);assert.equal(Math.max(...xs),10,'centimeters become millimeters');
 assert.deepEqual(r.settings,{});assert.equal(r.profile,null);
});

test('3MF: printer codes, invalid files and missing parts are reported plainly',async()=>{
 assert.equal(ThreeMF.mapSettings({printer_model:'Bambu Lab N1'}).profile.printer,'Bambu Lab A1 mini');
 await assert.rejects(ThreeMF.parse3MF(new Uint8Array(100)),/ZIP/);
 await assert.rejects(ThreeMF.parse3MF(zip({'3D/3dmodel.model':'<model><resources><object id="1"><components><component objectid="9"/></components></object></resources><build><item objectid="1"/></build></model>'})),/찾지 못했어요/);
 await assert.rejects(ThreeMF.parse3MF(zip({'3D/3dmodel.model':'<model><resources><object id="1"><mesh><vertices><vertex x="0" y="0" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources><build><item objectid="1"/></build></model>'})),/메쉬/);
});
