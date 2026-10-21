// Test-only Direct Sockets polyfill: the same TCPSocket stream contract as the Isolated Web App, backed by node:net.
const net=require('node:net'),dgram=require('node:dgram');
// Hand-rolled instead of Duplex.toWeb, whose adapter throws when the peer closes while both streams are still open.
function streams(s){
 let done=false;const readable=new ReadableStream({start(c){s.on('data',b=>{c.enqueue(new Uint8Array(b));if(c.desiredSize<=0)s.pause();});const end=()=>{if(!done){done=true;try{c.close();}catch{}}};s.on('end',end);s.on('close',end);s.on('error',()=>{if(!done){done=true;try{c.error(Error('socket error'));}catch{}}});},pull(){s.resume();},cancel(){s.destroy();}},{highWaterMark:8});
 const writable=new WritableStream({write(chunk){return new Promise((resolve,reject)=>{if(s.destroyed)return reject(Error('socket closed'));s.write(chunk,e=>e?reject(e):resolve());});},close(){return new Promise(r=>s.end(r));},abort(){s.destroy();}});
 return {readable,writable};
}
class TCPSocket{
 constructor(host,port){
  const s=net.connect(port,host);this.socket=s;
  this.opened=new Promise((resolve,reject)=>{s.once('connect',()=>{const {readable,writable}=streams(s);resolve({readable,writable,remoteAddress:s.remoteAddress,remotePort:s.remotePort,localAddress:s.localAddress,localPort:s.localPort});});s.once('error',reject);});
  this.closed=new Promise(resolve=>s.once('close',resolve));this.opened.catch(()=>{});
 }
 async close(){this.socket.destroy();}
}
// Bound-mode UDP with a multicast controller, enough for SSDP discovery tests.
class UDPSocket{
 constructor({localAddress,localPort,remoteAddress,remotePort}={}){
  const s=dgram.createSocket({type:'udp4',reuseAddr:true});this.socket=s;let controller;
  const readable=new ReadableStream({start(c){controller=c;s.on('message',(data,rinfo)=>c.enqueue({data:new Uint8Array(data),remoteAddress:rinfo.address,remotePort:rinfo.port}));s.on('close',()=>{try{c.close();}catch{}});}});
  const writable=new WritableStream({write(m){return new Promise((resolve,reject)=>s.send(m.data,m.remotePort??remotePort,m.remoteAddress??remoteAddress,e=>e?reject(e):resolve()));}});
  this.opened=new Promise((resolve,reject)=>{s.once('error',reject);s.bind(localPort||0,localAddress&&localAddress!=='0.0.0.0'?localAddress:undefined,()=>{const a=s.address();resolve({readable,writable,localAddress:a.address,localPort:a.port,multicastController:{joinedGroups:[],async joinGroup(g){try{s.addMembership(g);}catch{}},async leaveGroup(g){try{s.dropMembership(g);}catch{}}}});});});
  this.closed=new Promise(resolve=>s.once('close',resolve));this.opened.catch(()=>{});
 }
 async close(){try{this.socket.close();}catch{}}
}
function install(){globalThis.TCPSocket=TCPSocket;globalThis.UDPSocket=UDPSocket;}
module.exports={TCPSocket,UDPSocket,install};
