const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {describe,bound}=require('../src/production-status.js');
const printer={id:'one',name:'미니 01',online:true,fresh:true},slice={source:'browser',seconds:124,weightG:.4};
const view=(job,telemetry={fresh:true},extra={})=>describe({job,printer,telemetry,connected:true,slice,...extra});

test('the slicing stage keeps the actual work visible before calculation and after restoring a job without paths',()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{value:11,max:11,hidden:false,disabled:false,textContent:'',setAttribute(){}});return elements.get(id);};
 const c=vm.createContext({$:get,document:{querySelector:()=>({classList:{toggle(){}}})},step:1,browserSliceBusy:false,job:null,layerView:'stack',current:null,R:{clip:{},group:{visible:false},paths:{children:[]}},activeSlice:()=>null,layerFeatureSummary:()=>null,firstInfillLayer:()=>null});
 const app=fs.readFileSync('src/app.js','utf8');vm.runInContext(app.slice(app.indexOf('function updateLayer(){'),app.indexOf('function download(')),c);
 c.updateLayer();assert.equal(c.R.group.visible,true);assert.equal(get('layerTools').hidden,true);assert.match(get('layerDetailTitle').textContent,/먼저/);assert.equal(get('topLayerBtn').disabled,true);
 c.browserSliceBusy=true;c.updateLayer();assert.match(get('layerDetailTitle').textContent,/계산/);assert.equal(c.R.group.visible,true);
 c.browserSliceBusy=false;c.activeSlice=()=>({source:'browser',layers:11});c.updateLayer();assert.equal(c.R.group.visible,true);assert.equal(get('layerTools').hidden,true);assert.match(get('layerDetailCopy').textContent,/이전 작업/);
});
test('an unconnected browser has no invented printer, time or progress',()=>{
 const s=describe();assert.match(s.printerName,/아직/);assert.match(s.printerState,/연결 필요/);assert.equal(s.timeValue,'슬라이싱 후 확인');assert.equal(s.progress,null);
 assert.equal(describe({slicing:true}).timeValue,'계산 중…');
});
test('model-only and Studio estimates use different time scopes',()=>{
 const a=view();assert.equal(a.timeValue,'2분 04초');assert.match(a.timeNote,/별도/);
 const b=view(null,{fresh:true},{slice:{...slice,source:'studio'}});assert.equal(b.timeLabel,'준비 포함 예상');
 for(const seconds of [null,undefined,NaN,Infinity,-1,'120'])assert.equal(view(null,null,{slice:{source:'browser',seconds}}).timeValue,'슬라이싱 후 확인');
});
test('only a fresh printer report supplies a live remaining time and progress',()=>{
 const j={state:'printing',printerName:'출력 미니',progress:37,layer:5,slice:{layers:12}};
 const a=view(j,{fresh:true,remainingMinutes:3});assert.equal(a.timeValue,'3분');assert.equal(a.progress,37);assert.match(a.progressText,/5 \/ 12층/);
 const b=view(j,{fresh:false,remainingMinutes:3});assert.equal(b.timeValue,'확인 중');assert.equal(b.progress,null);assert.match(b.printerState,/연결 확인/);
 assert.equal(view(j,{fresh:true,remainingMinutes:0}).timeValue,'곧 완료 예정');
});
test('missing remaining time never fabricates a countdown from percent complete',()=>{
 const s=view({state:'printing',progress:99},{fresh:true});assert.equal(s.timeValue,'2분 04초');assert.equal(s.timeLabel,'작품 경로 예상');assert.match(s.timeNote,/전체 경로/);
});
test('paused, uncertain, failed and cancelled states do not claim ongoing remaining time',()=>{
 for(const [state,value] of [['paused','일시 정지'],['uncertain','본체 확인 필요'],['failed','작업 중단'],['cancelled','작업 취소']]){
  const s=view({state,progress:40},{fresh:true,remainingMinutes:5});assert.equal(s.timeValue,value);assert.equal(s.progress,null);
 }
});
test('acknowledged completion stays complete when later telemetry becomes stale',()=>{
 const s=view({state:'complete',printerName:'미니 01',progress:98},{fresh:false});assert.equal(s.timeValue,'출력 완료');assert.equal(s.progress,100);assert.match(s.timeNote,/식으면/);
});
test('the job printer stays identified during a job even if the selection list changed',()=>{
 assert.equal(view({state:'printing',printerName:'작업 미니'},{fresh:false}).printerName,'작업 미니');
 assert.equal(view({state:'ready',printerName:'이전 미니'}).printerName,'미니 01');
 assert.equal(bound({state:'uncertain'}),true);assert.equal(bound({state:'ready'}),false);
});
test('another device lease and another print are reported without calling them ready',()=>{
 assert.match(view(null,{fresh:true},{printer:{...printer,paired:true,mine:false}}).printerState,/다른 기기/);
 assert.match(view(null,{fresh:true},{printer:{...printer,busy:true}}).printerState,/다른 작품/);
});
test('the UI expires readings after 15 seconds and never substitutes another printer telemetry',()=>{
 const ctx=vm.createContext({Date,ProductionStatus:{bound},console});
 vm.runInContext(`let job=null,local={printers:[]},pairing=null;const $=()=>({value:'two'});`+fs.readFileSync('src/production-workbench.js','utf8'),ctx);
 const run=s=>vm.runInContext(s,ctx);
 run("noteProductionFeed('list');");assert.equal(run("productionTelemetry({fresh:true}).fresh"),true);
 run('productionFeed.listAt-=15001;');assert.equal(run("productionTelemetry({fresh:true}).fresh"),false);
 run("job={state:'printing',printerId:'one',telemetry:{fresh:false}};noteProductionFeed('job');");assert.equal(run('productionTelemetry({id:"two",fresh:true}).fresh'),false);
 run("job.telemetry={fresh:true};productionFeed.jobFailed=true;");assert.equal(run('productionTelemetry(null).fresh'),false);
});
