const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),dgram=require('node:dgram');
require('./helpers/direct-sockets.cjs').install();
const memory=new Map();globalThis.localStorage={getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.BAMBU_CA_PEM=fs.readFileSync(path.join(__dirname,'fixtures/direct-tls/rsa-ca.pem'),'utf8');
globalThis.A1_MINI_MACHINE=JSON.parse(fs.readFileSync(path.join(__dirname,'../bridge/profiles/a1-mini-pla.json'),'utf8'));
for(const m of ['print-job','direct/sockets','direct/tls','direct/printer-link','direct/discovery','direct/relay'])require('../src/'+m+'.js');
test.after(()=>DirectRelay.reset());
const call=async(route,body)=>{const r=await DirectRelay.fetch(route,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
const NOTIFY='NOTIFY * HTTP/1.1\r\nHost: 239.255.255.250:1990\r\nLocation: 192.168.0.37\r\nNT: urn:bambulab-com:device:3dprinter:1\r\nUSN: 0309DA000000001\r\nDevModel.bambu.com: N1\r\nDevName.bambu.com: Mini\x07 01\r\nDevConnect.bambu.com: lan\r\nDevBind.bambu.com: free\r\nDevVersion.bambu.com: 01.07.00.00\r\n\r\n';

test('SSDP NOTIFY parsing keeps only private, well-formed Bambu announcements',()=>{
 const p=DirectDiscovery.parseNotify(NOTIFY,'192.168.0.37');
 assert.deepEqual({...p},{ip:'192.168.0.37',serial:'0309DA000000001',model:'A1 mini',supported:true,name:'Mini 01',lanOnly:true,bound:false,firmware:'01.07.00.00',source:'ssdp'});
 assert.equal(DirectDiscovery.parseNotify(NOTIFY.replace('Location: 192.168.0.37','Location: 8.8.8.8'),'8.8.4.4'),null);
 assert.equal(DirectDiscovery.parseNotify(NOTIFY.replace('USN: 0309DA000000001','USN: ../../x'),'192.168.0.37'),null);
 assert.equal(DirectDiscovery.parseNotify(NOTIFY.replace('N1','C12'),'192.168.0.37').supported,false);
 assert.equal(DirectDiscovery.parseNotify(NOTIFY.replace('DevConnect.bambu.com: lan','DevConnect.bambu.com: cloud'),'192.168.0.37').lanOnly,false);
});

test('SSDP listener hears the printer announcement on UDP 2021',async t=>{
 const sender=dgram.createSocket('udp4');t.after(()=>sender.close());
 const beacon=setInterval(()=>sender.send(Buffer.from(NOTIFY),2021,'127.0.0.1',()=>{}),200);t.after(()=>clearInterval(beacon));
 const found=await DirectDiscovery.listen({timeoutMs:1200});
 assert.deepEqual(found.map(p=>[p.serial,p.ip,p.supported]),[['0309DA000000001','192.168.0.37',true]]);
});

test('in-app relay bootstraps as a direct, single-device workshop and validates registration',async()=>{
 const boot=await call('/api/bootstrap');assert.equal(boot.status,200);
 assert.equal(boot.data.direct,true);assert.equal(boot.data.version,8);assert.equal(boot.data.operator,true);assert.deepEqual(boot.data.printers,[]);assert.equal(boot.data.pairing.printerId,null);
 const settings=await call('/api/connection-settings');assert.deepEqual(settings.data.printers.map(p=>[p.id,!!p.blank]),[['mini-01',true]]);
 assert.match((await call('/api/connection-settings',{printerId:'mini-01',ip:'8.8.8.8',serial:'0309DA000000001',accessCode:'12345678'})).data.error,/사설|IP/);
 assert.match((await call('/api/connection-settings',{printerId:'mini-01',ip:'192.168.0.37',serial:'0309DA000000001',accessCode:'1234'})).data.error,/8자리/);
 assert.match((await call('/api/connection-settings',{printerId:'mini-07',ip:'192.168.0.37',serial:'0309DA000000001',accessCode:'12345678'})).data.error,/칸/);
 assert.equal((await call('/api/studio-jobs',{})).status,409);
 assert.match((await call('/api/printer-control',{action:'pause'})).data.error,/연결된 프린터/);
 assert.match((await call('/api/unlock',{pin:'123456'})).data.error,/운영자 PIN/);
 assert.equal(JSON.stringify([...memory.values()]).includes('12345678'),false,'rejected codes are never stored');
});

test('probe refuses public addresses before opening a socket',async()=>{
 await assert.rejects(DirectDiscovery.probe('8.8.8.8',{ca:BAMBU_CA_PEM}),e=>e.code==='BAD_IP');
});
