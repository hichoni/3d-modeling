const {equalSecret}=require('./access.cjs');
function desktopControl({input,output,nonce,busy,close}){
 if(!/^[a-f0-9]{64}$/.test(nonce||''))return;
 let buffer='';input.setEncoding('utf8');input.on('data',chunk=>{
  buffer+=chunk;if(buffer.length>4096){buffer='';return;}
  let split;while((split=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,split);buffer=buffer.slice(split+1);let request;try{request=JSON.parse(line);}catch{continue;}
   if(request.type!=='shutdown'||!equalSecret(request.nonce,nonce))continue;
   if(busy()){output.write('@desktop:'+JSON.stringify({ok:false,reason:'busy'})+'\n');continue;}
   output.write('@desktop:'+JSON.stringify({ok:true})+'\n',()=>close());
  }
 });
}
module.exports={desktopControl};
