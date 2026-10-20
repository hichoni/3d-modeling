// The participant browser only needs HTTP. Printer credentials stay on the booth PC.
let boothTarget=null;
let pairing=null,deviceToken='';
function prepareDevice(){if(deviceToken)return;try{deviceToken=localStorage.getItem('click-device-token-v1')||'';}catch{}if(!/^[a-f0-9]{64}$/.test(deviceToken)){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);deviceToken=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('click-device-token-v1',deviceToken);}catch{}}}
function parseBoothLink(value){
 const url=new URL(value),p=new URLSearchParams(url.hash.slice(1));
 if(!p.has('booth'))return null;
 const endpoint=new URL(p.get('booth')),host=endpoint.hostname,octets=host.split('.');
 const privateIP=octets.length===4&&octets.every(x=>/^\d{1,3}$/.test(x)&&Number(x)<=255)&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
 if(endpoint.protocol!=='http:'||!privateIP||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash||!/^[a-f0-9]{64}$/.test(p.get('key')||''))throw Error('운영자가 공유한 부스 링크를 그대로 붙여넣어 주세요.');
 return {base:endpoint.origin,key:p.get('key')};
}
function backendHeaders(extra={}){return {'X-Click-Token':local?.csrf||'',...(deviceToken?{'X-Client-Token':deviceToken}:{}),...(boothTarget?{'X-Booth-Key':boothTarget.key}:{}),...extra};}
function backendFetch(route,options={}){return fetch((boothTarget?.base||'')+route,{...options,headers:backendHeaders(options.headers||{}),...(boothTarget?{targetAddressSpace:'local'}:{})});}
function syncConnection(){
 const connected=!!local;
 $('boothBtn').textContent=connected?'● '+(local.operator?'출력 PC':'부스 연결됨'):'부스 연결';
 $('connection').textContent=connected?'● 공방 연결됨':'온라인 체험';
 $('boothStatus').textContent=connected?'연결됐어요. 웹에서 슬라이싱하고 부스 PC를 통해 매칭한 미니로 전송해요.':'운영자가 공유한 부스 링크로 접속하면 크롬북에서도 출력 대기표까지 받을 수 있어요.';
 $('disconnectBoothBtn').hidden=!boothTarget;
 $('operatorLocal').hidden=!(local?.operator||pairing?.printerId);
 $('localInstructions').hidden=connected;
 $('pairBtn').hidden=!connected;$('pairBtn').textContent=pairing?.printerId?'↔ '+pairedPrinterName():'미니 매칭';$('pairingBadge').hidden=!connected;
 $('pairingBadge').textContent=pairing?.printerId?(pairing.name+' ↔ '+pairedPrinterName()):'먼저 이 기기에서 사용할 미니를 선택해주세요.';
 if(connected&&!local.operator)$('operatorInfo').textContent=pairing?.printerId?pairedPrinterName()+'에 매칭되어 있어요. 운영자 PIN으로 이 미니의 출력만 시작할 수 있어요.':'미니를 먼저 매칭하면 이 크롬북에서 운영자 PIN으로 출력을 시작할 수 있어요.';
 else if(connected)$('operatorInfo').textContent='현장에서 크롬북과 미니를 1:1 매칭하고 필요할 때 해제·재매칭하세요.';
 $('boothSetupHint').hidden=!local?.operator||local?.booth;
}
function pairedPrinterName(){return local?.printers?.find(p=>p.id===pairing?.printerId)?.name||pairing?.printerId||'미니';}
async function connectWorkshop(target,{save=false,showError=false}={}){
 prepareDevice();clearInterval(jobTimer);job=null;pairing=null;boothTarget=target;local=null;lock();syncConnection();
 try{
  const data=await api('/api/bootstrap');if(data.app!=='click-workshop')throw Error('부스 공방을 찾지 못했어요.');if(data.version<5)throw Error('공방 PC의 설정 ZIP을 최신 버전으로 업데이트하고 서버를 다시 시작해주세요.');local=data;pairing=data.pairing||null;
  if(save&&target)try{localStorage.setItem('click-booth-v1',JSON.stringify(target));}catch{}
  syncConnection();renderSlice();renderTicket();
  try{const saved=JSON.parse(sessionStorage.getItem('click-current-job'));if(saved?.design===JSON.stringify(S)&&saved.backend===(boothTarget?.base||location.origin)){job=await api('/api/jobs/'+saved.id);renderSlice();renderTicket();clearInterval(jobTimer);jobTimer=setInterval(pollJob,2000);}}catch{}
  $('boothError').textContent='';$('boothFallback').hidden=true;return true;
 }catch(e){
  local=null;syncConnection();renderSlice();renderTicket();
  if(target){$('boothBtn').textContent='부스 연결 확인';$('boothStatus').textContent='부스에 아직 연결되지 않았어요.';$('boothError').textContent=e.message.includes('설정 ZIP')?e.message:'같은 Wi-Fi인지, 부스 PC가 켜져 있는지 확인해주세요. Chrome이 묻는 로컬 네트워크 연결을 허용해야 해요. 학교 정책이 차단하면 운영자에게 알려주세요.';
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
 $('disconnectBoothBtn').onclick=()=>{clearInterval(jobTimer);job=null;pairing=null;local=null;boothTarget=null;lock();try{localStorage.removeItem('click-booth-v1');sessionStorage.removeItem('click-current-job');}catch{}history.replaceState(null,'',location.pathname+location.search);$('boothError').textContent='';$('boothFallback').hidden=true;syncConnection();renderSlice();renderTicket();};
 $('copyBoothLinkBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('boothShareLink').value);toast('참가자 부스 링크를 복사했어요. 같은 Wi-Fi의 크롬북에 공유하세요.');}catch{$('boothShareLink').select();toast('선택된 링크를 복사해서 공유하세요.');}};
}
async function showBoothLinks(){
 if(!local?.operator)return;
 try{const data=await api('/api/booth-links',undefined,true);$('boothShare').hidden=!data.enabled;if(data.links){$('boothShareLink').value=data.links.pages;$('boothLanLink').value=data.links.lan;}$('boothSetupHint').hidden=data.enabled;}catch{}
}
async function refreshPairing(){
 if(!local)return;const source=local,data=await api('/api/printers');if(local!==source)return;const before=pairing;pairing=data.pairing;local.printers=data.printers;
 if(before&&(before.printerId!==pairing?.printerId||before.revision!==pairing?.revision)){lock();clearInterval(jobTimer);job=null;try{sessionStorage.removeItem('click-current-job');}catch{}renderSlice();renderTicket();}
 syncConnection();return data;
}
async function showPairing(){if(!local){$('boothDialog').showModal();return;}if(!$('pairDialog').open)$('pairDialog').showModal();$('pairError').textContent='';try{const data=await refreshPairing();$('deviceNameIn').value=pairing?.name||localStorage.getItem('click-device-name')||'크롬북';$('unpairBtn').hidden=!pairing?.printerId;$('pairCurrent').textContent=pairing?.printerId?'현재: '+pairing.name+' ↔ '+pairedPrinterName():'아직 매칭되지 않았어요. 현장의 미니 번호를 확인해 골라주세요.';$('printerChoices').replaceChildren();for(const p of data.printers){const b=document.createElement('button');b.className='printer-choice';const title=document.createElement('b');title.textContent=p.name;const status=document.createElement('small');status.textContent=(p.mine?'이 기기에 매칭됨':p.paired?'다른 크롬북이 사용 중':p.busy?'출력/확인 중':'매칭 가능')+' · '+(p.online?p.state||'연결됨':'연결 대기');b.append(title,status);b.disabled=p.paired&&!p.mine||p.busy&&!p.mine;b.setAttribute('aria-pressed',String(p.mine));b.onclick=()=>p.mine?$('pairDialog').close():setPairing(p.id);$('printerChoices').append(b);}}catch(e){$('pairError').textContent=e.message;}}
async function setPairing(printerId){try{const data=await api(printerId?'/api/pair':'/api/unpair',{printerId,name:$('deviceNameIn').value,discardPending:$('discardPendingIn').checked});pairing=data.pairing;local.printers=data.printers;lock();clearInterval(jobTimer);job=null;sessionStorage.removeItem('click-current-job');localStorage.setItem('click-device-name',$('deviceNameIn').value);syncConnection();renderSlice();renderTicket();$('discardPendingIn').checked=false;await showPairing();toast(printerId?'이 기기 ↔ '+pairedPrinterName()+' 매칭 완료!':'미니 매칭을 해제했어요.');}catch(e){$('pairError').textContent=e.message;}}
function bindPairing(){
 $('pairBtn').onclick=showPairing;$('refreshPairBtn').onclick=showPairing;$('unpairBtn').onclick=()=>setPairing(null);
 $('operatorPrinterSelect').onchange=()=>{selectedJob=null;operatorRefresh();};
 setInterval(()=>{if(local)refreshPairing().catch(()=>{});},5000);
}
