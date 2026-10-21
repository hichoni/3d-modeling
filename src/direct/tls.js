// TLS 1.2 client on top of a raw byte transport (Direct Sockets in the Isolated Web App, net.Socket in tests).
// Web pages cannot open TLS to a printer, so the app verifies the A1 mini's certificate chain against the
// Bambu CA bundle itself, exactly like the relay's Node tls.connect({ca, servername: serial}).
(function(root){
const subtle=globalThis.crypto.subtle,enc=new TextEncoder();
const HS={hello:1,serverHello:2,ticket:4,certificate:11,keyExchange:12,certRequest:13,helloDone:14,clientKeyExchange:16,finished:20};
const SUITES={
 0xc02b:{kx:'ecdhe',auth:'ecdsa',key:16,hash:'SHA-256'},0xc02c:{kx:'ecdhe',auth:'ecdsa',key:32,hash:'SHA-384'},
 0xc02f:{kx:'ecdhe',auth:'rsa',key:16,hash:'SHA-256'},0xc030:{kx:'ecdhe',auth:'rsa',key:32,hash:'SHA-384'},
 0x009c:{kx:'rsa',key:16,hash:'SHA-256'},0x009d:{kx:'rsa',key:32,hash:'SHA-384'}
};
const GROUPS={0x001d:{name:'X25519',bits:256},0x0017:{name:'ECDH',namedCurve:'P-256',bits:256},0x0018:{name:'ECDH',namedCurve:'P-384',bits:384}};
const SUITE_ORDER=[0xc02f,0xc02b,0xc030,0xc02c,0x009c,0x009d],SIG_ORDER=[0x0403,0x0804,0x0401,0x0503,0x0805,0x0501,0x0603,0x0806,0x0601,0x0201,0x0203];
const SIGALGS={0x0403:['ecdsa','SHA-256'],0x0503:['ecdsa','SHA-384'],0x0603:['ecdsa','SHA-512'],0x0804:['pss','SHA-256'],0x0805:['pss','SHA-384'],0x0806:['pss','SHA-512'],0x0401:['rsa','SHA-256'],0x0501:['rsa','SHA-384'],0x0601:['rsa','SHA-512'],0x0201:['rsa','SHA-1'],0x0203:['ecdsa','SHA-1']};
const CERT_SIG={'1.2.840.113549.1.1.11':['rsa','SHA-256'],'1.2.840.113549.1.1.12':['rsa','SHA-384'],'1.2.840.113549.1.1.13':['rsa','SHA-512'],'1.2.840.113549.1.1.5':['rsa','SHA-1'],'1.2.840.10045.4.3.2':['ecdsa','SHA-256'],'1.2.840.10045.4.3.3':['ecdsa','SHA-384'],'1.2.840.10045.4.3.4':['ecdsa','SHA-512']};
const CURVES={'1.2.840.10045.3.1.7':['P-256',32],'1.3.132.0.34':['P-384',48],'1.3.132.0.35':['P-521',66]};
function tlsError(code,message){const e=Error(message);e.code=code;return e;}
function concat(...parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
const u16=n=>Uint8Array.of(n>>8&255,n&255),u24=n=>Uint8Array.of(n>>16&255,n>>8&255,n&255);
const vec8=b=>concat(Uint8Array.of(b.length),b),vec16=b=>concat(u16(b.length),b),vec24=b=>concat(u24(b.length),b);
const read16=(b,o)=>b[o]<<8|b[o+1],read24=(b,o)=>b[o]<<16|b[o+1]<<8|b[o+2];
const random=n=>globalThis.crypto.getRandomValues(new Uint8Array(n));
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
async function digest(hash,data){return new Uint8Array(await subtle.digest(hash,data));}
async function prf(hash,secret,label,seed,length){
 const key=await subtle.importKey('raw',secret,{name:'HMAC',hash},false,['sign']),s=concat(enc.encode(label),seed),out=[];
 let a=s,size=0;while(size<length){a=new Uint8Array(await subtle.sign('HMAC',key,a));const p=new Uint8Array(await subtle.sign('HMAC',key,concat(a,s)));out.push(p);size+=p.length;}
 return concat(...out).slice(0,length);
}

// --- Minimal DER/X.509 reader: only what chain, hostname and key checks need. ---
function node(b,o=0){const tag=b[o];let len=b[o+1],off=o+2;if(len&128){const n=len&127;if(!n||n>4)throw tlsError('TLS_BAD_CERT','인증서 형식이 올바르지 않습니다.');len=0;for(let i=0;i<n;i++)len=len*256+b[off++];}if(off+len>b.length)throw tlsError('TLS_BAD_CERT','인증서 길이가 올바르지 않습니다.');return {tag,start:o,off,end:off+len,bytes:b.subarray(o,off+len),body:b.subarray(off,off+len)};}
function kids(b,n){const out=[];for(let o=n.off;o<n.end;){const k=node(b,o);out.push(k);o=k.end;}return out;}
function oid(body){const parts=[Math.floor(body[0]/40),body[0]%40];let v=0;for(let i=1;i<body.length;i++){v=v*128+(body[i]&127);if(!(body[i]&128)){parts.push(v);v=0;}}return parts.join('.');}
function time(n){const s=new TextDecoder().decode(n.body),m=n.tag===0x17?/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(s):/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(s);if(!m)throw tlsError('TLS_BAD_CERT','인증서 유효기간을 읽지 못했습니다.');let y=+m[1];if(n.tag===0x17)y+=y<50?2000:1900;return Date.UTC(y,m[2]-1,+m[3],+m[4],+m[5],+m[6]);}
function names(b,n){const out={};for(const set of kids(b,n))for(const atv of kids(b,set)){const [k,v]=kids(b,atv);out[oid(k.body)]=new TextDecoder().decode(v.body);}return out;}
function parseCertificate(der){
 const b=der instanceof Uint8Array?der:new Uint8Array(der),root=node(b),[tbs,alg,sig]=kids(b,root),t=kids(b,tbs);let i=t[0].tag===0xa0?1:0;
 const sigAlg=kids(b,alg)[0],issuer=t[i+2],validity=kids(b,t[i+3]),subject=t[i+4],spki=t[i+5],cert={der:b,tbs:tbs.bytes,sigAlg:oid(sigAlg.body),signature:sig.body.subarray(1),issuer:issuer.bytes,subject:subject.bytes,subjectNames:names(b,subject),notBefore:time(validity[0]),notAfter:time(validity[1]),spki:spki.bytes,dns:[],ca:false};
 const [keyAlg]=kids(b,spki),[keyOid,param]=kids(b,keyAlg);cert.keyType=oid(keyOid.body)==='1.2.840.10045.2.1'?'ec':'rsa';if(cert.keyType==='ec')cert.curve=CURVES[oid(param.body)];
 else{const bits=kids(b,spki)[1],rsa=node(b,bits.off+1),[n,e]=kids(b,rsa);cert.modulus=n.body[0]===0?n.body.subarray(1):n.body;cert.exponent=e.body;}
 const ext=t.find(x=>x.tag===0xa3);if(ext)for(const item of kids(b,kids(b,ext)[0])){const parts=kids(b,item),id=oid(parts[0].body),value=node(b,parts.at(-1).off);
  if(id==='2.5.29.17')for(const g of kids(b,value))if(g.tag===0x82)cert.dns.push(new TextDecoder().decode(g.body).toLowerCase());
  if(id==='2.5.29.19'){const c=kids(b,value);cert.ca=c[0]?.tag===1&&c[0].body[0]!==0;}}
 return cert;
}
function parsePem(text){return [...String(text).matchAll(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/g)].map(m=>Uint8Array.from(atob(m[1].replace(/\s+/g,'')),c=>c.charCodeAt(0)));}
function rawEcdsa(der,size){const b=node(der),[r,s]=kids(der,b),fit=v=>{v=v.body;while(v.length>size&&v[0]===0)v=v.subarray(1);const out=new Uint8Array(size);out.set(v,size-v.length);return out;};return concat(fit(r),fit(s));}
async function verify(cert,kind,hash,data,signature){
 if(kind==='ecdsa'){if(cert.keyType!=='ec'||!cert.curve)return false;const key=await subtle.importKey('spki',cert.spki,{name:'ECDSA',namedCurve:cert.curve[0]},false,['verify']);return subtle.verify({name:'ECDSA',hash},key,rawEcdsa(signature,cert.curve[1]),data);}
 if(cert.keyType!=='rsa')return false;
 if(kind==='pss'){const key=await subtle.importKey('spki',cert.spki,{name:'RSA-PSS',hash},false,['verify']);return subtle.verify({name:'RSA-PSS',saltLength:{'SHA-256':32,'SHA-384':48,'SHA-512':64}[hash]},key,signature,data);}
 const key=await subtle.importKey('spki',cert.spki,{name:'RSASSA-PKCS1-v1_5',hash},false,['verify']);return subtle.verify('RSASSA-PKCS1-v1_5',key,signature,data);
}
async function signedBy(cert,issuer){const alg=CERT_SIG[cert.sigAlg];if(!alg||!equal(cert.issuer,issuer.subject))return false;try{return await verify(issuer,alg[0],alg[1],cert.tbs,cert.signature);}catch{return false;}}
async function verifyChain(chain,anchors,{serverName,now=Date.now()}={}){
 if(!chain.length)throw tlsError('TLS_BAD_CERT','프린터가 인증서를 보내지 않았습니다.');
 for(const c of chain)if(now<c.notBefore||now>c.notAfter)throw tlsError('TLS_CERT_EXPIRED','프린터 인증서의 유효기간이 맞지 않습니다. 크롬북의 날짜·시간을 확인하세요.');
 let current=chain[0];const pool=chain.slice(1);
 for(let depth=0;depth<8;depth++){
  if(anchors.some(a=>equal(a.der,current.der)))return checkName(chain[0],serverName);
  for(const a of anchors)if(await signedBy(current,a))return checkName(chain[0],serverName);
  let next=null;for(const c of pool)if(c.ca&&await signedBy(current,c)){next=c;break;}
  if(!next)break;current=next;
 }
 throw tlsError('TLS_UNTRUSTED','Bambu Lab 인증서로 확인되지 않는 장치입니다. 프린터 주소를 확인하세요.');
}
function checkName(cert,serverName){
 if(!serverName)return cert;const want=String(serverName).toLowerCase(),cn=(cert.subjectNames['2.5.4.3']||'').toLowerCase();
 if(cert.dns.length?cert.dns.includes(want):cn===want)return cert;
 throw tlsError('TLS_NAME_MISMATCH','이 주소의 프린터 일련번호가 입력한 일련번호와 다릅니다.');
}
function rsaEncrypt(cert,message){
 const k=cert.modulus.length,toBig=b=>b.reduce((n,v)=>n*256n+BigInt(v),0n),n=toBig(cert.modulus),e=toBig(cert.exponent);
 const pad=new Uint8Array(k-message.length-3);for(let i=0;i<pad.length;i++){let v=0;while(!v)v=random(1)[0];pad[i]=v;}
 let m=toBig(concat(Uint8Array.of(0,2),pad,Uint8Array.of(0),message)),r=1n;
 for(let base=m%n,x=e;x>0n;x>>=1n,base=base*base%n)if(x&1n)r=r*base%n;
 const out=new Uint8Array(k);for(let i=k-1;i>=0;i--,r>>=8n)out[i]=Number(r&255n);return out;
}

let x25519=null;async function groups(){if(x25519===null)try{await subtle.generateKey({name:'X25519'},true,['deriveBits']);x25519=true;}catch{x25519=false;}return x25519?[0x001d,0x0017,0x0018]:[0x0017,0x0018];}

class TlsConnection{
 constructor(transport,{serverName,ca=[],session=null,now}){this.transport=transport;this.serverName=serverName;this.anchors=ca.map(parseCertificate);this.resume=session;this.now=now;this.inbox=new Uint8Array(0);this.hsBuffer=new Uint8Array(0);this.transcript=[];this.readSeq=0;this.writeSeq=0;this.reader=null;this.writer=null;this.writeChain=Promise.resolve();this.closed=false;this.app=[];}
 async fill(n){while(this.inbox.length<n){const chunk=await this.transport.read();if(!chunk)return false;this.inbox=concat(this.inbox,chunk);}return true;}
 async record(){
  if(!await this.fill(5))return null;const type=this.inbox[0],length=read16(this.inbox,3);if(length>18432)throw tlsError('TLS_PROTOCOL','TLS 레코드가 너무 큽니다.');
  if(!await this.fill(5+length))throw tlsError('TLS_EOF','프린터와의 보안 연결이 끊겼습니다.');
  const header=this.inbox.slice(0,5),body=this.inbox.slice(5,5+length);this.inbox=this.inbox.slice(5+length);
  return {type,data:this.reader?await this.decrypt(type,header,body):body};
 }
 nonce(iv,explicit){return concat(iv,explicit);}
 seqBytes(n){const b=new Uint8Array(8);for(let i=7;i>=0;i--){b[i]=n%256;n=Math.floor(n/256);}return b;}
 async decrypt(type,header,body){
  if(body.length<24)throw tlsError('TLS_PROTOCOL','TLS 레코드가 손상됐습니다.');const explicit=body.subarray(0,8),aad=concat(this.seqBytes(this.readSeq++),Uint8Array.of(type,3,3),u16(body.length-24));
  try{return new Uint8Array(await subtle.decrypt({name:'AES-GCM',iv:concat(this.reader.iv,explicit),additionalData:aad,tagLength:128},this.reader.key,body.subarray(8)));}catch{throw tlsError('TLS_BAD_RECORD','암호화된 응답을 확인하지 못했습니다.');}
 }
 async send(type,data){
  if(!this.writer)return this.transport.write(concat(Uint8Array.of(type,3,3),u16(data.length),data));
  const explicit=this.seqBytes(this.writeSeq),aad=concat(explicit,Uint8Array.of(type,3,3),u16(data.length));this.writeSeq++;
  const sealed=new Uint8Array(await subtle.encrypt({name:'AES-GCM',iv:concat(this.writer.iv,explicit),additionalData:aad,tagLength:128},this.writer.key,data));
  return this.transport.write(concat(Uint8Array.of(type,3,3),u16(8+sealed.length),explicit,sealed));
 }
 queue(type,data){const p=this.writeChain.then(()=>this.send(type,data));this.writeChain=p.catch(()=>{});return p;}
 async alert(record){const [level,code]=record.data;if(code===0){this.closed=true;return null;}if(level===2)throw tlsError('TLS_ALERT_'+code,code===40||code===71?'프린터가 보안 연결 방식을 거절했습니다.':'프린터가 보안 연결을 거절했습니다. (TLS '+code+')');return undefined;}
 async message(){
  for(;;){
   if(this.hsBuffer.length>=4){const len=read24(this.hsBuffer,1);if(this.hsBuffer.length>=4+len){const raw=this.hsBuffer.slice(0,4+len);this.hsBuffer=this.hsBuffer.slice(4+len);return {type:raw[0],body:raw.subarray(4),raw};}}
   const r=await this.record();if(!r)throw tlsError('TLS_EOF','프린터가 보안 연결을 닫았습니다.');
   if(r.type===22)this.hsBuffer=concat(this.hsBuffer,r.data);else if(r.type===21){if(await this.alert(r)===null)throw tlsError('TLS_EOF','프린터가 보안 연결을 닫았습니다.');}
   else if(r.type===20)return {type:'ccs'};else throw tlsError('TLS_PROTOCOL','예상하지 못한 TLS 응답입니다.');
  }
 }
 async expect(type){const m=await this.message();if(m.type!==type)throw tlsError('TLS_PROTOCOL','TLS 협상 순서가 올바르지 않습니다.');if(type!=='ccs')this.transcript.push(m.raw);return m;}
 async hash(){return digest(this.suite.hash,concat(...this.transcript));}
 async handshakeMessage(type,body){const raw=concat(Uint8Array.of(type),vec24(body));this.transcript.push(raw);await this.queue(22,raw);}
 async keys(){
  const s=this.suite,block=await prf(s.hash,this.master,'key expansion',concat(this.serverRandom,this.clientRandom),2*s.key+8),imp=k=>subtle.importKey('raw',k,'AES-GCM',false,['encrypt','decrypt']);
  this.pendingWriter={key:await imp(block.slice(0,s.key)),iv:block.slice(2*s.key,2*s.key+4)};this.pendingReader={key:await imp(block.slice(s.key,2*s.key)),iv:block.slice(2*s.key+4,2*s.key+8)};
 }
 async finished(label){return prf(this.suite.hash,this.master,label,await this.hash(),12);}
 async sendFinished(){await this.queue(20,Uint8Array.of(1));this.writer=this.pendingWriter;this.writeSeq=0;await this.handshakeMessage(HS.finished,await this.finished('client finished'));}
 async receiveFinished(){
  let m=await this.message();if(m.type===HS.ticket){this.transcript.push(m.raw);this.ticket(m.body);m=await this.message();}
  if(m.type!=='ccs')throw tlsError('TLS_PROTOCOL','TLS 협상 순서가 올바르지 않습니다.');this.reader=this.pendingReader;this.readSeq=0;
  const expected=await this.finished('server finished'),f=await this.expect(HS.finished);if(!equal(f.body,expected))throw tlsError('TLS_BAD_FINISHED','보안 연결 확인값이 다릅니다.');
 }
 ticket(body){const len=read16(body,4);this.newTicket=body.slice(6,6+len);}
 async handshake(){
  this.clientRandom=random(32);const r=this.resume,sessionId=r?(r.ticket?random(32):r.id):new Uint8Array(0),suites=SUITE_ORDER.filter(id=>!r||id===r.suite),groupIds=await groups();
  const ext=(type,body)=>concat(u16(type),vec16(body));
  const extensions=concat(
   ...(this.serverName?[ext(0,vec16(concat(Uint8Array.of(0),vec16(enc.encode(this.serverName)))))]:[]),
   ext(10,vec16(concat(...groupIds.map(u16)))),ext(11,vec8(Uint8Array.of(0))),ext(13,vec16(concat(...SIG_ORDER.map(u16)))),
   ext(23,new Uint8Array(0)),ext(35,r?.ticket||new Uint8Array(0)),ext(0xff01,Uint8Array.of(0)));
  await this.handshakeMessage(HS.hello,concat(Uint8Array.of(3,3),this.clientRandom,vec8(sessionId),vec16(concat(...suites.map(u16))),Uint8Array.of(1,0),vec16(extensions)));
  const sh=(await this.expect(HS.serverHello)).body;if(sh[0]!==3||sh[1]!==3)throw tlsError('TLS_VERSION','프린터가 TLS 1.2를 사용하지 않습니다.');
  this.serverRandom=sh.slice(2,34);const idLen=sh[34],serverId=sh.slice(35,35+idLen),suiteId=read16(sh,35+idLen);this.suite=SUITES[suiteId];if(!this.suite)throw tlsError('TLS_SUITE','지원하지 않는 암호 방식입니다.');
  let o=38+idLen,ems=false;if(o<sh.length){const end=o+2+read16(sh,o);for(o+=2;o<end;){const type=read16(sh,o),len=read16(sh,o+2);if(type===23)ems=true;o+=4+len;}}
  this.session={id:serverId,suite:suiteId,ems,ticket:null,master:null};
  if(r&&idLen&&equal(serverId,sessionId)){
   if(r.ems!==ems)throw tlsError('TLS_RESUME','세션 재사용 조건이 다릅니다.');this.master=r.master;Object.assign(this.session,{master:r.master,ticket:r.ticket,id:serverId});this.resumed=true;
   await this.keys();await this.receiveFinished();await this.sendFinished();
  }else{
   const certs=[],cm=(await this.expect(HS.certificate)).body;for(let p=3;p<3+read24(cm,0);){const len=read24(cm,p);certs.push(parseCertificate(cm.slice(p+3,p+3+len)));p+=3+len;}
   const leaf=await verifyChain(certs,this.anchors,{serverName:this.serverName,now:this.now?.()??Date.now()});this.peerCertificate=leaf;
   let pms,cke;
   if(this.suite.kx==='ecdhe'){
    const ske=(await this.expect(HS.keyExchange)).body;if(ske[0]!==3)throw tlsError('TLS_PROTOCOL','지원하지 않는 키 교환입니다.');const group=GROUPS[read16(ske,1)];if(!group)throw tlsError('TLS_GROUP','지원하지 않는 키 교환 곡선입니다.');
    const pointEnd=4+ske[3],params=ske.subarray(0,pointEnd),sigAlg=SIGALGS[read16(ske,pointEnd)],sigLen=read16(ske,pointEnd+2),sig=ske.subarray(pointEnd+4,pointEnd+4+sigLen);
    if(!sigAlg||(sigAlg[0]==='ecdsa')!==(this.suite.auth==='ecdsa')||!await verify(leaf,sigAlg[0],sigAlg[1],concat(this.clientRandom,this.serverRandom,params),sig))throw tlsError('TLS_BAD_SIGNATURE','프린터의 키 교환 서명을 확인하지 못했습니다.');
    const algorithm=group.name==='X25519'?{name:'X25519'}:{name:'ECDH',namedCurve:group.namedCurve},pair=await subtle.generateKey(algorithm,true,['deriveBits']),peer=await subtle.importKey('raw',ske.slice(4,pointEnd),algorithm,true,[]);
    pms=new Uint8Array(await subtle.deriveBits({name:algorithm.name,public:peer},pair.privateKey,group.bits));cke=vec8(new Uint8Array(await subtle.exportKey('raw',pair.publicKey)));
   }else{pms=concat(Uint8Array.of(3,3),random(46));cke=vec16(rsaEncrypt(leaf,pms));}
   let m=await this.message();if(m.type===HS.certRequest)throw tlsError('TLS_CLIENT_CERT','프린터가 클라이언트 인증서를 요구합니다.');if(m.type!==HS.helloDone)throw tlsError('TLS_PROTOCOL','TLS 협상 순서가 올바르지 않습니다.');this.transcript.push(m.raw);
   await this.handshakeMessage(HS.clientKeyExchange,cke);
   this.master=ems?await prf(this.suite.hash,pms,'extended master secret',await this.hash(),48):await prf(this.suite.hash,pms,'master secret',concat(this.clientRandom,this.serverRandom),48);this.session.master=this.master;
   await this.keys();await this.sendFinished();await this.receiveFinished();
  }
  if(this.newTicket)this.session.ticket=this.newTicket;this.transcript=null;return this;
 }
 getSession(){return this.session&&this.session.master&&(this.session.id.length||this.session.ticket)?{...this.session}:null;}
 async read(){
  if(this.app.length)return this.app.shift();
  for(;;){if(this.closed)return null;const r=await this.record();if(!r)return null;
   if(r.type===23){if(r.data.length)return r.data;continue;}
   if(r.type===21){if(await this.alert(r)===null)return null;continue;}
   if(r.type===22){if(r.data[0]===0)await this.queue(21,Uint8Array.of(1,100));continue;}
   throw tlsError('TLS_PROTOCOL','예상하지 못한 TLS 응답입니다.');}
 }
 write(data){const parts=[];for(let o=0;o<data.length;o+=16384)parts.push(this.queue(23,data.subarray(o,o+16384)));return Promise.all(parts).then(()=>{});}
 async notify(){if(!this.closing){this.closing=true;try{if(this.writer)await this.queue(21,Uint8Array.of(1,0));}catch{}}}
 // close_notify + FIN while still reading, so the peer finishes reading before either side closes.
 async end(){await this.notify();try{await this.transport.end?.();}catch{}}
 async close(){await this.notify();try{await this.transport.close();}catch{}}
}
async function connect(transport,options={}){const t=new TlsConnection(transport,options);try{return await t.handshake();}catch(e){try{await transport.close();}catch{}throw e;}}
const api={connect,parsePem,parseCertificate,verifyChain};root.DirectTLS=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
