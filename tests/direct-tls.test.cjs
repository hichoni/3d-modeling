const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),tls=require('node:tls'),crypto=require('node:crypto');
require('./helpers/direct-sockets.cjs').install();
const DirectTLS=require('../src/direct/tls.js'),DirectSockets=require('../src/direct/sockets.js');
const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures/direct-tls',name),'utf8');
const bambuCA=fs.readFileSync(path.join(__dirname,'../bridge/bambu-ca.pem'),'utf8');
function server(options,onSocket){return new Promise(resolve=>{const s=tls.createServer({minVersion:'TLSv1.2',maxVersion:'TLSv1.2',...options},onSocket);s.listen(0,'127.0.0.1',()=>resolve(s));});}
async function client(port,{serverName,ca,session}={}){const t=await DirectSockets.openTcp('127.0.0.1',port);return DirectTLS.connect(t,{serverName,ca:DirectTLS.parsePem(ca),session});}
async function readAll(conn){const parts=[];for(;;){const b=await conn.read();if(!b)break;parts.push(Buffer.from(b));}return Buffer.concat(parts).toString();}
const echo=socket=>socket.on('data',d=>socket.end('echo:'+d));

test('Bambu CA bundle parses into RSA and ECC anchors',()=>{
 const certs=DirectTLS.parsePem(bambuCA).map(DirectTLS.parseCertificate);
 assert.equal(certs.length,5);assert.deepEqual([...new Set(certs.map(c=>c.keyType))].sort(),['ec','rsa']);
 assert.ok(certs.every(c=>c.ca&&/BBL/.test(c.subjectNames['2.5.4.3'])));
});

for(const [name,key,cert,ca,serial,ciphers] of [
 ['RSA device, ECDHE-RSA-AES128-GCM','rsa-device.key.pem','rsa-device.pem','rsa-ca.pem','TESTSERIAL01','ECDHE-RSA-AES128-GCM-SHA256'],
 ['RSA device, ECDHE-RSA-AES256-GCM-SHA384','rsa-device.key.pem','rsa-device.pem','rsa-ca.pem','TESTSERIAL01','ECDHE-RSA-AES256-GCM-SHA384'],
 ['RSA device, static RSA key exchange','rsa-device.key.pem','rsa-device.pem','rsa-ca.pem','TESTSERIAL01','AES128-GCM-SHA256'],
 ['ECC device, ECDHE-ECDSA-AES128-GCM','ecc-device.key.pem','ecc-device.pem','ecc-ca.pem','TESTSERIAL02','ECDHE-ECDSA-AES128-GCM-SHA256'],
 ['intermediate chain with SAN','chain-device.key.pem','chain-device.pem+rsa-int.pem','rsa-ca.pem','TESTSERIAL03','ECDHE-RSA-AES128-GCM-SHA256']
])test('TLS 1.2 handshake and data: '+name,async t=>{
 const srv=await server({key:fixture(key),cert:cert.split('+').map(fixture).join('\n'),ciphers},echo);t.after(()=>srv.close());
 const conn=await client(srv.address().port,{serverName:serial,ca:fixture(ca)+bambuCA});
 await conn.write(new TextEncoder().encode('hello'));assert.equal(await readAll(conn),'echo:hello');await conn.close();
});

for(const curve of ['X25519','prime256v1','secp384r1'])test('ECDHE group '+curve,async t=>{
 const srv=await server({key:fixture('rsa-device.key.pem'),cert:fixture('rsa-device.pem'),ecdhCurve:curve},echo);t.after(()=>srv.close());
 const conn=await client(srv.address().port,{serverName:'TESTSERIAL01',ca:fixture('rsa-ca.pem')});await conn.write(Buffer.from('x'));assert.equal(await readAll(conn),'echo:x');
});

test('large payloads span many TLS records in both directions',async t=>{
 const big=crypto.randomBytes(300000),received=[];let size=0;
 const srv=await server({key:fixture('rsa-device.key.pem'),cert:fixture('rsa-device.pem')},s=>s.on('data',d=>{received.push(d);size+=d.length;if(size===big.length)s.end(crypto.createHash('sha256').update(Buffer.concat(received)).digest('hex')+':'+'z'.repeat(70000));}));t.after(()=>srv.close());
 const conn=await client(srv.address().port,{serverName:'TESTSERIAL01',ca:fixture('rsa-ca.pem')});
 await conn.write(big);const reply=await readAll(conn);
 assert.equal(reply.split(':')[0],crypto.createHash('sha256').update(big).digest('hex'));assert.equal(reply.split(':')[1].length,70000);
});

test('rejects untrusted devices, wrong serials and Bambu-only trust for a test CA',async t=>{
 const rogue=await server({key:fixture('rogue.key.pem'),cert:fixture('rogue.pem')},echo);t.after(()=>rogue.close());
 await assert.rejects(client(rogue.address().port,{serverName:'TESTSERIAL01',ca:fixture('rsa-ca.pem')+bambuCA}),e=>e.code==='TLS_UNTRUSTED');
 const good=await server({key:fixture('rsa-device.key.pem'),cert:fixture('rsa-device.pem')},echo);t.after(()=>good.close());
 await assert.rejects(client(good.address().port,{serverName:'OTHERSERIAL',ca:fixture('rsa-ca.pem')}),e=>e.code==='TLS_NAME_MISMATCH');
 await assert.rejects(client(good.address().port,{serverName:'TESTSERIAL01',ca:bambuCA}),e=>e.code==='TLS_UNTRUSTED');
});

for(const mode of ['ticket','session id'])test('resumes the control session on a new connection ('+mode+'), as FTPS data channels require',async t=>{
 const cache=new Map(),reused=[];
 const srv=await server({key:fixture('rsa-device.key.pem'),cert:fixture('rsa-device.pem'),...(mode==='ticket'?{}:{secureOptions:crypto.constants.SSL_OP_NO_TICKET})},s=>{reused.push(s.isSessionReused());echo(s);});t.after(()=>srv.close());
 if(mode!=='ticket'){srv.on('newSession',(id,data,cb)=>{cache.set(id.toString('hex'),data);cb();});srv.on('resumeSession',(id,cb)=>cb(null,cache.get(id.toString('hex'))||null));}
 const first=await client(srv.address().port,{serverName:'TESTSERIAL01',ca:fixture('rsa-ca.pem')});await first.write(Buffer.from('a'));assert.equal(await readAll(first),'echo:a');
 const session=first.getSession();assert.ok(session);assert.equal(mode==='ticket',!!session.ticket);
 const second=await client(srv.address().port,{serverName:'TESTSERIAL01',ca:fixture('rsa-ca.pem'),session});assert.equal(second.resumed,true);
 await second.write(Buffer.from('b'));assert.equal(await readAll(second),'echo:b');assert.deepEqual(reused,[false,true]);
});
