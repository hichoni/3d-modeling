const test=require('node:test'),assert=require('node:assert/strict');
const {printOptions,filament,checkFilament}=require('../bridge/print-preparation.cjs');
test('only boolean calibration flags are accepted and omitted values keep both enabled',()=>{
 assert.deepEqual(printOptions(),{bedLeveling:true,flowCalibration:true});
 for(const bedLeveling of [false,true])for(const flowCalibration of [false,true])assert.deepEqual(printOptions({bedLeveling,flowCalibration}),{bedLeveling,flowCalibration});
 for(const invalid of [null,[],false,{bedLeveling:0},{flowCalibration:'false'},{use_ams:true}])assert.throws(()=>printOptions(invalid));
});
test('public filament data only contains bounded material metadata and becomes unknown when stale',()=>{
 const state={vt_tray:{id:'254',tray_type:'PLA',tray_color:'78C451FF',nozzle_temp_min:'190',nozzle_temp_max:'240',tag_uid:'PRIVATE',accessCode:'PRIVATE'},ams:{tray_now:'254',ams:[{id:'1',tray:[{id:'2',tray_type:'PETG',tray_color:'F08A00FF'}]}]}};
 const f=filament(state,true);assert.equal(f.external.type,'PLA');assert.equal(f.external.color,'#78C451');assert.equal(f.external.nozzleMin,190);assert.deepEqual(f.active,f.external);assert.equal(f.slots[0].slot,6);assert.ok(!JSON.stringify(f).includes('PRIVATE'));assert.doesNotThrow(()=>checkFilament(state));
 state.ams.tray_now='6';assert.equal(filament(state,true).active.source,'ams');assert.throws(()=>checkFilament(state),/외부/);state.ams.tray_now='254';state.vt_tray.tray_type='PETG';assert.throws(()=>checkFilament(state),/PLA/);
 assert.deepEqual(filament(state,false),{fresh:false,external:null,slots:[],active:null});assert.equal(filament({},true).active,null);
 for(const value of ['00000000','red;background:url(secret)','xyz','FFFFFFFFFF'])assert.equal(filament({vt_tray:{tray_color:value}},true).external.color,null);
});
test('the machine wrapper actually gates leveling and flow calibration on firmware flags',()=>{
 const {start}=require('../bridge/profiles/a1-mini-pla.json');const s=start.join('\n');
 assert.match(s,/judge_flag g29_before_print_flag\nM622 J1[\s\S]*?G29 A1[\s\S]*?M623/);
 assert.match(s,/judge_flag extrude_cali_flag\nM622 J1[\s\S]*?M983[\s\S]*?M984[\s\S]*?M623/);
});
