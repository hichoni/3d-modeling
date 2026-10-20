const dgram=require('node:dgram');
const os=require('node:os');
function verifyMini(device){return new Promise((resolve,reject)=>{
 const sockets=[],nic=Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal);let done=false;
 const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);for(const s of sockets)try{s.close();}catch{}error?reject(error):resolve(result);};
 const timer=setTimeout(()=>finish(Error('A1 mini의 LAN 모드를 발견하지 못했습니다. 같은 네트워크, LAN Only, Developer Mode와 방화벽의 로컬 검색 허용을 확인하세요.')),6500);
 for(const port of [2021,1990]){const s=dgram.createSocket({type:'udp4',reuseAddr:true});sockets.push(s);s.on('error',()=>{});s.on('message',(data,remote)=>{if(remote.address!==device.ip)return;const h={};for(const line of data.toString().split(/\r?\n/)){const i=line.indexOf(':');if(i>0)h[line.slice(0,i).trim().toLowerCase()]=line.slice(i+1).trim();}if(h.usn!==device.serial)return;if(h['devmodel.bambu.com']!=='N1')return finish(Error('이 공방은 A1 mini만 지원합니다.'));if(h['devconnect.bambu.com']!=='lan')return finish(Error('프린터의 LAN Only와 Developer Mode를 켜주세요.'));finish(null,{model:'A1 mini',firmware:h['devversion.bambu.com']});});
 s.bind(port,'0.0.0.0',()=>{s.setMulticastTTL(1);const query=Buffer.from('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:2021\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:bambulab-com:device:3dprinter:1\r\n\r\n');for(const n of nic)try{s.addMembership('239.255.255.250',n.address);s.setMulticastInterface(n.address);s.send(query,2021,'239.255.255.250',()=>{});}catch{}});
 }
});}
module.exports={verifyMini};
