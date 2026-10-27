const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),dgram=require('node:dgram'),vm=require('node:vm');
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

for(const port of [2021,1990])test('SSDP listener receives and deduplicates announcements for UDP '+port+' over isolated loopback',async t=>{
 // Bambu Studio also binds 1990/2021. Sending a unicast beacon to those real ports can
 // reach Studio instead, while unrelated LAN printers pollute the result. Exercise the
 // real listener and UDP receive path on OS-assigned loopback ports, recording (rather
 // than joining/sending to) multicast so this test never discovers physical printers.
 const sockets=[],binds=[],groups=[],queries=[];
 const {UDPSocket}=require('./helpers/direct-sockets.cjs');
 class IsolatedUDPSocket extends UDPSocket{
  constructor(options){
   super({localAddress:'127.0.0.1',localPort:0});
   binds.push({...options});this.requestedPort=options.localPort;sockets.push(this);
   this.opened=this.opened.then(info=>({...info,
    multicastController:{async joinGroup(group){groups.push({port:options.localPort,group});}},
    writable:new WritableStream({write(message){queries.push({port:options.localPort,...message});}})
   }));
  }
 }
 // Keep the test transport out of the relay's global Direct Sockets implementation.
 const discovery=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/direct/discovery.js'),'utf8')+'\nDirectDiscovery;',
  {UDPSocket:IsolatedUDPSocket,TextDecoder,TextEncoder,setTimeout,clearTimeout});
 t.after(async()=>{await Promise.all(sockets.map(s=>s.close()));await Promise.all(sockets.map(s=>s.closed));});
 const pending=discovery.listen({timeoutMs:500});
 await Promise.all(sockets.map(s=>s.opened));
 assert.deepEqual(binds,[2021,1990].map(localPort=>({localAddress:'0.0.0.0',localPort,multicastAllowAddressSharing:true})));
 const endpoint=await sockets.find(s=>s.requestedPort===port).opened;
 const sender=dgram.createSocket('udp4');t.after(()=>sender.close());
 await new Promise((resolve,reject)=>{sender.once('error',reject);sender.bind(0,'127.0.0.1',resolve);});
 for(let n=0;n<2;n++)await new Promise((resolve,reject)=>sender.send(Buffer.from(NOTIFY),endpoint.localPort,'127.0.0.1',e=>e?reject(e):resolve()));
 const found=await pending;
 assert.deepEqual(Array.from(found,p=>[p.serial,p.ip,p.supported]),[['0309DA000000001','192.168.0.37',true]]);
 assert.deepEqual(groups.sort((a,b)=>b.port-a.port),[2021,1990].map(port=>({port,group:'239.255.255.250'})));
 assert.deepEqual(queries.map(q=>[q.port,q.remoteAddress,q.remotePort]),[[2021,'239.255.255.250',1990],[2021,'239.255.255.250',2021]]);
 assert.ok(queries.every(q=>new TextDecoder().decode(q.data).startsWith('M-SEARCH * HTTP/1.1\r\n')));
 await Promise.all(sockets.map(s=>s.closed));
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
