const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {Statistics}=require('../bridge/statistics.cjs'),counts=require('../src/statistics-core.js');
function fixture(){let time='2026-10-20T14:59:00Z';const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'click-counts-')),'statistics.json');return {file,stats:new Statistics(file,{now:()=>new Date(time)}),setTime:t=>time=t};}
const visit=(id,at='2026-10-20T14:59:00Z')=>({id:id.repeat(64),at});
test('experiences deduplicate across refresh, retry, devices and relay restart; Korean midnight changes only today totals',()=>{
 const f=fixture();f.stats.record('device-a',[visit('a'),visit('a')]);f.stats.record('device-b',[visit('a')]);assert.equal(f.stats.summary().totalParticipants,1);
 const restored=new Statistics(f.file,{now:()=>new Date('2026-10-20T15:01:00Z')});assert.equal(restored.summary().date,'2026-10-21');assert.equal(restored.summary().todayParticipants,0);assert.equal(restored.summary().totalParticipants,1);
 restored.record('device-b',[visit('b','2026-10-20T15:00:00Z')]);assert.equal(restored.summary().todayParticipants,1);assert.equal(restored.summary().totalParticipants,2);
 assert.equal(counts.day('2026-10-20T14:59:59Z'),'2026-10-20');assert.equal(counts.day('2026-10-20T15:00:00Z'),'2026-10-21');
});
test('only completed jobs count once; recorded completion date controls today, and undated history counts only toward total',()=>{
 const f=fixture(),id='a'.repeat(24);f.stats.complete({id,state:'accepted'});f.stats.complete({id,state:'failed'});assert.equal(f.stats.summary().totalPrints,0);
 f.stats.complete({id,state:'complete',completedAt:'2026-10-20T14:59:00Z'});f.stats.complete({id,state:'complete',completedAt:'2026-10-20T14:59:30Z'});assert.equal(f.stats.summary().todayPrints,1);
 f.setTime('2026-10-20T15:01:00Z');f.stats.reconcile([{id:'b'.repeat(24),state:'complete',completedRecordAt:'2026-10-20T15:00:10Z'},{id:'c'.repeat(24),state:'complete'}]);const s=f.stats.summary();assert.equal(s.todayPrints,1);assert.equal(s.totalPrints,3);assert.equal(s.undatedPrints,1);
 assert.equal(new Statistics(f.file).data.prints['b'.repeat(24)].source,'legacy_completed_record');
});
test('invalid and partially invalid batches are rejected without changing counts; persistence failures do not acknowledge unsaved records',()=>{
 const f=fixture();for(const [owner,batch]of [[null,[visit('a')]],['owner',[]],['owner',[{id:'bad',at:'bad'}]],['owner',[visit('a'),visit('b','2030-01-01')]],['owner',Array(51).fill(visit('a'))]])assert.throws(()=>f.stats.record(owner,batch));assert.equal(f.stats.summary().totalParticipants,0);
 const rename=fs.renameSync;try{fs.renameSync=(from,to)=>{if(to===f.file)throw Error('test disk failure');return rename(from,to);};assert.throws(()=>f.stats.record('owner',[visit('a')]));assert.equal(f.stats.summary().totalParticipants,0);}finally{fs.renameSync=rename;}
 f.stats.record('owner',[visit('a')]);assert.equal(new Statistics(f.file).summary().totalParticipants,1);assert.ok(!fs.readFileSync(f.file,'utf8').includes('owner'));
});
test('browser counts meaningful starts once, restores after reload, counts next participant, and merges offline records into the hub once',async()=>{
 const store=new Map(),nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',title:''});return nodes.get(id);};
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const f=fixture();f.setTime(new Date().toISOString());let writes=0;
 const context=vm.createContext({Date,Intl,Set,Map,console,crypto:require('node:crypto').webcrypto,localStorage:storage,$:get,setInterval:()=>0,addEventListener:()=>{},local:null,api:async(route,body)=>{if(route==='/api/statistics')return f.stats.summary();writes++;return f.stats.record('browser',body.experiences);}});
 vm.runInContext(fs.readFileSync('src/statistics-core.js','utf8')+'\n'+fs.readFileSync('src/statistics.js','utf8')+'\nglobalThis.counter=new WorkshopStatistics();',context);
 assert.equal(get('totalParticipants').textContent,'0');context.counter.begin();context.counter.begin();assert.equal(get('totalParticipants').textContent,'1');
 vm.runInContext('globalThis.counter=new WorkshopStatistics();counter.begin();',context);assert.equal(get('totalParticipants').textContent,'1');context.counter.next();context.counter.begin();assert.equal(get('totalParticipants').textContent,'2');assert.equal(writes,0);
 context.local={csrf:'test'};await context.counter.sync();assert.equal(get('statisticsScope').textContent,'공방 전체');assert.equal(f.stats.summary().totalParticipants,2);await context.counter.sync();assert.equal(writes,1);
 context.counter.complete({id:'a'.repeat(24),completedAt:new Date().toISOString()});assert.equal(context.counter.data.prints['a'.repeat(24)].at.length,24);
});
test('a 2-key keychain pair counts as two prints in the hub, on a direct device and in the browser; old records stay one each',()=>{
 const f=fixture();f.stats.complete({id:'a'.repeat(24),state:'complete',completedAt:'2026-10-20T14:59:00Z',dimensions:{size:14,pair:true}});f.stats.complete({id:'b'.repeat(24),state:'complete',completedAt:'2026-10-20T14:59:10Z',dimensions:{size:14,pair:false}});
 const s=f.stats.summary();assert.equal(s.todayPrints,3);assert.equal(s.totalPrints,3);assert.equal(new Statistics(f.file).summary().totalPrints,3);
 assert.equal(counts.pieces({dimensions:{pair:true}}),2);assert.equal(counts.pieces({pieces:2}),2);assert.equal(counts.pieces({}),1);assert.equal(counts.pieces({pieces:7}),1);
 assert.equal(counts.summary({experiences:{},prints:{x:{at:null,pieces:2},y:{at:null,pieces:99}}}).undatedPrints,3);
});
