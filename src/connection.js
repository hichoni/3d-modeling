// The participant browser only needs HTTP. Printer credentials stay on the booth PC.
let boothTarget=null;
function parseBoothLink(value){
 const url=new URL(value),p=new URLSearchParams(url.hash.slice(1));
 if(!p.has('booth'))return null;
 const endpoint=new URL(p.get('booth')),host=endpoint.hostname,octets=host.split('.');
 const privateIP=octets.length===4&&octets.every(x=>/^\d{1,3}$/.test(x)&&Number(x)<=255)&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
 if(endpoint.protocol!=='http:'||!privateIP||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash||!/^[a-f0-9]{64}$/.test(p.get('key')||''))throw Error('운영자가 공유한 부스 링크를 그대로 붙여넣어 주세요.');
 return {base:endpoint.origin,key:p.get('key')};
}
function backendHeaders(extra={}){return {'X-Click-Token':local?.csrf||'',...(boothTarget?{'X-Booth-Key':boothTarget.key}:{}),...extra};}
function backendFetch(route,options={}){return fetch((boothTarget?.base||'')+route,{...options,headers:backendHeaders(options.headers||{}),...(boothTarget?{targetAddressSpace:'local'}:{})});}
function syncConnection(){
 const connected=!!local;
 $('boothBtn').textContent=connected?'● '+(local.operator?'출력 PC':'부스 연결됨'):'부스 연결';
 $('connection').textContent=connected?'● 공방 연결됨':'온라인 체험';
 $('boothStatus').textContent=connected?'연결됐어요. 이 기기에서 만든 작품을 부스 PC가 슬라이싱해요.':'운영자가 공유한 부스 링크로 접속하면 크롬북에서도 출력 대기표까지 받을 수 있어요.';
 $('disconnectBoothBtn').hidden=!boothTarget;
 $('operatorLocal').hidden=!local?.operator;
 $('localInstructions').hidden=connected;
 if(connected&&!local.operator)$('operatorInfo').textContent='출력 시작은 부스의 운영자 PC에서 확인해요. 이 기기는 모델링·슬라이싱·내 작품 진행 확인을 할 수 있어요.';
 else if(connected)$('operatorInfo').textContent='참가자 링크를 공유하고, 접수된 작품의 출력 준비를 확인하세요.';
}
async function connectWorkshop(target,{save=false,showError=false}={}){
 clearInterval(jobTimer);job=null;boothTarget=target;local=null;lock();syncConnection();
 try{
  const data=await api('/api/bootstrap');if(data.app!=='click-workshop')throw Error('부스 공방을 찾지 못했어요.');local=data;
  if(save&&target)try{localStorage.setItem('click-booth-v1',JSON.stringify(target));}catch{}
  syncConnection();renderSlice();renderTicket();
  try{const saved=JSON.parse(sessionStorage.getItem('click-current-job'));if(saved?.design===JSON.stringify(S)&&saved.backend===(boothTarget?.base||location.origin)){job=await api('/api/jobs/'+saved.id);renderSlice();renderTicket();clearInterval(jobTimer);jobTimer=setInterval(pollJob,2000);}}catch{}
  $('boothError').textContent='';$('boothFallback').hidden=true;return true;
 }catch(e){
  local=null;syncConnection();renderSlice();renderTicket();
  if(target){$('boothBtn').textContent='부스 연결 확인';$('boothStatus').textContent='부스에 아직 연결되지 않았어요.';$('boothError').textContent='같은 Wi-Fi인지, 부스 PC가 켜져 있는지 확인해주세요. Chrome이 묻는 로컬 네트워크 연결을 허용해야 해요. 학교 정책이 차단하면 운영자에게 알려주세요.';
   const fragment=new URLSearchParams({booth:target.base,key:target.key});$('boothFallback').href=target.base+'/#'+fragment;$('boothFallback').hidden=false;
   if(showError&&!$('boothDialog').open)$('boothDialog').showModal();
  }
  return false;
 }
}
async function discoverLocal(){
 let target=null;
 try{target=parseBoothLink(location.href);
  if(!target&&['127.0.0.1','localhost'].includes(location.hostname))return connectWorkshop(null);
  if(!target){const saved=JSON.parse(localStorage.getItem('click-booth-v1'));if(saved)target=parseBoothLink(location.origin+location.pathname+'#'+new URLSearchParams({booth:saved.base,key:saved.key}));}}catch(e){$('boothError').textContent=e.message;}
 if(target)return connectWorkshop(target,{save:true,showError:true});
 if(['127.0.0.1','localhost'].includes(location.hostname))return connectWorkshop(null);
 syncConnection();
}
function bindBoothConnection(){
 $('boothBtn').onclick=()=>{$('boothLinkIn').value='';syncConnection();$('boothDialog').showModal();};
 $('joinBoothBtn').onclick=async()=>{try{const target=$('boothLinkIn').value.trim()?parseBoothLink($('boothLinkIn').value.trim()):boothTarget;if(!target)throw Error('운영자의 부스 링크를 붙여넣어 주세요.');$('joinBoothBtn').disabled=true;if(await connectWorkshop(target,{save:true,showError:true})){$('boothDialog').close();toast('부스와 연결됐어요! 설치 없이 만들고 출력 대기표를 받아요.');}}catch(e){$('boothError').textContent=e.message;}finally{$('joinBoothBtn').disabled=false;}};
 $('disconnectBoothBtn').onclick=()=>{clearInterval(jobTimer);job=null;local=null;boothTarget=null;lock();try{localStorage.removeItem('click-booth-v1');sessionStorage.removeItem('click-current-job');}catch{}history.replaceState(null,'',location.pathname+location.search);$('boothError').textContent='';$('boothFallback').hidden=true;syncConnection();renderSlice();renderTicket();};
 $('copyBoothLinkBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('boothShareLink').value);toast('참가자 부스 링크를 복사했어요. 같은 Wi-Fi의 크롬북에 공유하세요.');}catch{$('boothShareLink').select();toast('선택된 링크를 복사해서 공유하세요.');}};
}
async function showBoothLinks(){
 try{const data=await api('/api/booth-links',undefined,true);$('boothShare').hidden=!data.enabled;if(data.links){$('boothShareLink').value=data.links.pages;$('boothLanLink').value=data.links.lan;}$('boothSetupHint').hidden=data.enabled;}catch{}
}
