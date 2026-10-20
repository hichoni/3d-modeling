const crypto=require('node:crypto');
const net=require('node:net');
const PAGES='https://hichoni.github.io';
const SITE=PAGES+'/3d-modeling/';
function privateIPv4(ip){return net.isIP(ip)===4&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);}
function equalSecret(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return !!y.length&&x.length===y.length&&crypto.timingSafeEqual(x,y);}
function makeAccess(config,port){
 const origin='http://127.0.0.1:'+port,booth=config.booth?.enabled===true;
 if(booth&&(!privateIPv4(config.booth.host)||!/^[a-f0-9]{64}$/.test(config.booth.key||'')))throw Error('부스 모드는 setup.cjs --booth로 PC 주소와 접속 키를 설정하세요.');
 const lanOrigin=booth?'http://'+config.booth.host+':'+port:null;
 const hosts=new Set(['127.0.0.1:'+port,...(booth?[config.booth.host+':'+port]:[])]);
 function isOperator(req){return req.headers.host==='127.0.0.1:'+port&&['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)&&(!req.headers.origin||req.headers.origin===origin);}
 function participant(req){return isOperator(req)||booth&&equalSecret(req.headers['x-booth-key'],config.booth.key);}
 function allowedOrigin(value){return value===origin||booth&&(value===lanOrigin||value===PAGES);}
 function cors(req,res){
  const source=req.headers.origin;
  if(source&&source!==origin){if(!booth||![PAGES,lanOrigin].includes(source))return false;
   res.setHeader('Access-Control-Allow-Origin',source);res.setHeader('Vary','Origin');
   res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
   res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Click-Token, X-Booth-Key, X-Model-Name');
   res.setHeader('Access-Control-Max-Age','600');
   // Compatibility for older Chrome PNA preflights; current Chrome also requires LNA permission.
   res.setHeader('Access-Control-Allow-Private-Network','true');
  }
  return true;
 }
 function links(){if(!booth)return null;const fragment=new URLSearchParams({booth:lanOrigin,key:config.booth.key});return {pages:SITE+'#'+fragment,lan:lanOrigin+'/#'+fragment};}
 return {origin,booth,lanOrigin,hosts,isOperator,participant,allowedOrigin,cors,links,bind:booth?'0.0.0.0':'127.0.0.1'};
}
module.exports={makeAccess,privateIPv4,equalSecret};
