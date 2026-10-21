// Test-only Direct Sockets polyfill: the same TCPSocket stream contract as the Isolated Web App, backed by node:net.
const net=require('node:net'),dgram=require('node:dgram'),{Duplex}=require('node:stream');
class TCPSocket{
 constructor(host,port){
  const s=net.connect(port,host);this.socket=s;
  this.opened=new Promise((resolve,reject)=>{s.once('connect',()=>{const {readable,writable}=Duplex.toWeb(s);resolve({readable,writable,remoteAddress:s.remoteAddress,remotePort:s.remotePort,localAddress:s.localAddress,localPort:s.localPort});});s.once('error',reject);});
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
