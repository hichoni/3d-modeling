// The operator learns about an old booth PC program even on the page that program serves itself (src/hub-update.js).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/hub-update.js','utf8');
function load(hostname,reply){const calls=[];const c=vm.createContext({location:{hostname},setInterval:()=>1,fetch:async(url,options)=>{calls.push({url,options});return reply;}});vm.runInContext(source,c);return {H:c.HubUpdate,calls};}
test('a page served by the booth PC checks the public latest version and flags an older program',async()=>{
 const {H,calls}=load('127.0.0.1',{ok:true,json:async()=>({hub:H_NEXT})});let changed=0;
 H.watch(()=>changed++);assert.equal(H.stale(null),false);assert.equal(H.stale({version:H.HUB_VERSION,direct:true}),false);assert.equal(calls.length,0,'no booth PC, no check');
 assert.equal(H.stale({version:H.HUB_VERSION}),false);await new Promise(r=>setImmediate(r));
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://hichoni.github.io/3d-modeling/downloads/booth-version.json');assert.equal(calls[0].options.credentials,'omit');
 assert.equal(changed,1);assert.equal(H.latest,H_NEXT);assert.equal(H.stale({version:H.HUB_VERSION}),true);assert.match(H.note({version:H.HUB_VERSION}),new RegExp(`v${H.HUB_VERSION} · 최신 v${H_NEXT}`));
 assert.equal(H.stale({version:H.HUB_VERSION,direct:true}),false,'direct Chromebook mode has no booth PC');assert.equal(H.stale(null),false);
});
const H_NEXT=Number(/HUB_VERSION=(\d+)/.exec(source)[1])+1;
test('offline, broken or odd replies keep this page\'s own version as the floor; the public site never fetches itself',async()=>{
 for(const reply of [{ok:false},{ok:true,json:async()=>({hub:'99'})},{ok:true,json:async()=>({hub:5})},{ok:true,json:async()=>{throw Error('bad');}}]){const {H}=load('127.0.0.1',reply);H.stale({version:H.HUB_VERSION});await new Promise(r=>setImmediate(r));assert.equal(H.latest,H.HUB_VERSION);assert.equal(H.stale({version:H.HUB_VERSION-1}),true);}
 const {H,calls}=load('hichoni.github.io',{ok:true,json:async()=>({hub:H_NEXT})});H.stale({version:H.HUB_VERSION});await new Promise(r=>setImmediate(r));assert.equal(calls.length,0);
});
test('the published version, the booth PC program and its page policy agree',()=>{
 const v=Number(/HUB_VERSION=(\d+)/.exec(source)[1]);assert.deepEqual(JSON.parse(fs.readFileSync('downloads/booth-version.json','utf8')),{hub:v});
 const server=fs.readFileSync('bridge/server.cjs','utf8');assert.ok(server.includes(`version:${v},`));assert.match(server,/connect-src 'self' https:\/\/hichoni\.github\.io;/);
});
