// Direct Sockets transport. Only available inside the installed Isolated Web App (or a test polyfill).
(function(root){
function socketError(code,message){const e=Error(message);e.code=code;return e;}
function available(){return typeof root.TCPSocket==='function'&&typeof root.UDPSocket==='function';}
function streamTransport(open,socket){
 const reader=open.readable.getReader(),writer=open.writable.getWriter();let closed=false;
 return {info:{localAddress:open.localAddress,localPort:open.localPort,remoteAddress:open.remoteAddress,remotePort:open.remotePort},
  async read(){if(closed)return null;try{const {value,done}=await reader.read();return done?null:new Uint8Array(value.buffer?value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength):value);}catch(e){if(closed)return null;throw socketError('SOCKET_READ','프린터와의 연결이 끊겼습니다.');}},
  async write(data){if(closed)throw socketError('SOCKET_CLOSED','프린터와의 연결이 이미 닫혔습니다.');try{await writer.write(data);}catch{throw socketError('SOCKET_WRITE','프린터로 데이터를 보내지 못했습니다.');}},
  async close(){if(closed)return;closed=true;
   await Promise.race([writer.close().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);
   try{await reader.cancel();}catch{}try{reader.releaseLock();}catch{}try{writer.releaseLock();}catch{}try{await socket.close();}catch{}}};
}
async function openTcp(host,port,{timeout=8000}={}){
 if(!available())throw socketError('NO_DIRECT_SOCKETS','이 화면에서는 프린터에 직접 연결할 수 없습니다. 크롬북에 설치한 Click Studio 앱에서 열어주세요.');
 let socket,timer;
 try{socket=new root.TCPSocket(host,port,{noDelay:true,keepAliveDelay:30000});
  const open=await Promise.race([socket.opened,new Promise((_,reject)=>{timer=setTimeout(()=>reject(socketError('SOCKET_TIMEOUT','프린터 응답이 없습니다.')),timeout);})]);
  return streamTransport(open,socket);
 }catch(e){try{socket?.close();}catch{}if(e.code)throw e;throw socketError('SOCKET_CONNECT',e?.name==='NotAllowedError'||e?.name==='InvalidAccessError'?'크롬북이 로컬 네트워크 연결을 허용하지 않았습니다. 앱 권한을 확인하세요.':'이 주소의 프린터에 연결하지 못했습니다. 같은 Wi-Fi·전원·IP를 확인하세요.');}
 finally{clearTimeout(timer);}
}
const api={available,openTcp,streamTransport};root.DirectSockets=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
