// Screens for the installed Chromebook app: printer search/registration and Bambu Studio-style live controls.
// Does nothing on the public web page or the relay's pages.
(function(root){
if(!root.DirectRelay?.enabled())return;
document.documentElement.dataset.direct='1';
const $=id=>document.getElementById(id);
async function call(route,body){const r=await DirectRelay.fetch(route,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'요청을 처리하지 못했습니다.');return data;}
function paired(){const id=DirectRelay.store.pairing?.printerId;return id?DirectRelay.telemetry(id):null;}
function warning(t){
 if(!t)return '';if(t.error&&!t.fresh)return t.error;if(!t.fresh)return '';
 if(t.developerMode===false)return '프린터의 개발자 모드가 꺼져 있어요. 본체 설정 → LAN Only에서 개발자 모드를 켜야 출력 명령을 받을 수 있어요.';
 if(t.otherJob)return '이 미니는 다른 작업('+t.otherJob+')을 출력 중이에요. 끝난 뒤 사용하세요.';
 if(t.hms?.some(h=>h.severity==='fatal'||h.severity==='serious'))return '프린터에 확인이 필요한 알림이 있어요: '+t.hms.map(h=>h.code).join(', ');
 return '';
}
function describe(p){return (p.name?p.name+' · ':'')+'SN 끝 '+p.serial.slice(-4)+' · '+p.ip+(p.lanOnly?'':' · LAN Only 켜기 필요')+(p.bound?' · 클라우드 바인딩됨':'');}
async function search(onFound,status){
 status('같은 Wi-Fi의 A1 mini를 찾고 있어요… (최대 20초)');
 const result=await call('/api/discover-printers',{});
 if(!result.printers.length){status('찾지 못했어요. 전원·같은 Wi-Fi·LAN Only를 확인하거나 프린터 IP를 직접 입력하세요.'+(result.others?.length?' (A1 mini가 아닌 프린터 '+result.others.length+'대는 지원하지 않아요)':''));return;}
 onFound(result.printers);status(result.printers.length+'대를 찾았어요'+(result.method==='scan'?' (주소 검색)':'')+'. 본체의 IP·SN과 같은 미니를 고르세요.');
}

// --- Click Studio ---
function studio(){
 if(!$('printerSetup'))return;
 $('probePrinter').onclick=async()=>{try{$('probePrinter').disabled=true;$('discoveryStatus').textContent='이 주소의 프린터 인증서를 확인하고 있어요…';const r=await call('/api/discover-printers',{mode:'probe',ip:$('printerIP').value.trim()}),p=r.printers[0];$('printerSerial').value=p.serial;$('discoveryStatus').textContent=p.supported?'Bambu Lab 인증서를 확인했어요. 일련번호를 채웠으니 8자리 코드를 입력하세요.':'Bambu Lab 프린터지만 A1 mini가 아니에요. 현재 A1 mini만 지원합니다.';}catch(e){$('discoveryStatus').textContent=e.message;}finally{$('probePrinter').disabled=false;}};
 $('removePrinter').onclick=async()=>{const id=$('printerSelect').value;if(!id||!confirm('이 크롬북에서 이 프린터의 등록과 액세스 코드를 지울까요?'))return;try{await call('/api/connection-settings',{printerId:id,remove:true});await StudioAPI.refresh();$('printerSelect').value='';$('connectionError').textContent='';}catch(e){$('connectionError').textContent=e.message;}};
 const control=(action,value)=>call('/api/printer-control',{action,value}).catch(e=>studioToast(e.message));
 $('directPause').onclick=()=>control('pause');$('directResume').onclick=()=>control('resume');$('directSpeed').onchange=()=>control('speed',Number($('directSpeed').value));
 $('directLight').onclick=()=>control('light',$('directLight').getAttribute('aria-pressed')==='true'?'off':'on');
 const firstUse=()=>{if(!DirectRelay.store.printers.length)$('printerSetup').open=true;};firstUse();$('connectionButton').addEventListener('click',()=>setTimeout(firstUse,0));
 setInterval(()=>{
  const t=paired();$('directPrinterWarning').textContent=warning(t);$('removePrinter').hidden=!DirectRelay.store.printers.some(p=>p.id===$('printerSelect').value);
  const panel=$('directPrinterPanel'),show=!!t?.fresh&&!$('printMonitor').hidden;panel.hidden=!show;if(!show)return;
  const parts=[t.stageLabel||(t.state==='RUNNING'?'출력 중':t.state==='PAUSE'?'일시 정지':''),t.totalLayers?'층 '+(t.layer||0)+'/'+t.totalLayers:'',Number.isFinite(t.remainingMinutes)&&t.remainingMinutes>0?'남은 시간 약 '+(t.remainingMinutes>=60?Math.floor(t.remainingMinutes/60)+'시간 ':'')+t.remainingMinutes%60+'분':'',t.wifi?'Wi-Fi '+t.wifi:''].filter(Boolean);
  $('directStage').textContent=parts.join(' · ');$('directPause').hidden=!t.canPause;$('directResume').hidden=!t.canResume;$('directSpeed').disabled=!t.canPause&&!t.canResume;if(t.speedLevel&&document.activeElement!==$('directSpeed'))$('directSpeed').value=String(t.speedLevel);
  $('directLight').setAttribute('aria-pressed',String(t.light==='on'));
  const list=$('directHms');list.replaceChildren(...t.hms.map(h=>{const li=document.createElement('li'),a=document.createElement('a');a.href=h.url;a.target='_blank';a.rel='noopener';a.textContent=h.code+' 안내 보기';li.append(a);li.className=h.severity;return li;}));if(t.printError){const li=document.createElement('li');li.textContent='오류 코드 '+t.printError;list.append(li);}list.hidden=!list.childElementCount;
 },1500);
}

// --- 14mm booth ---
function booth(){
 if(!$('findPrinterBtn'))return;let found=[];
 const status=t=>{$('findPrinterState').textContent=t;};
 $('findPrinterBtn').onclick=async()=>{try{$('findPrinterBtn').disabled=true;await search(list=>{found=list;const select=$('foundPrinterSelect');select.replaceChildren(new Option('찾은 A1 mini를 고르세요',''),...list.map((p,i)=>new Option(describe(p),String(i))));select.hidden=false;},status);}catch(e){status(e.message);}finally{$('findPrinterBtn').disabled=false;}};
 $('foundPrinterSelect').onchange=()=>{const p=found[+$('foundPrinterSelect').value];if(!p||$('foundPrinterSelect').value==='')return;const records=printerConnectionSettings||[],existing=records.find(r=>r.serial===p.serial)||records.find(r=>r.blank);if(existing)$('printerConnectionSelect').value=existing.id;$('printerIpIn').value=p.ip;$('printerSerialIn').value=p.serial;$('printerAccessCodeIn').value='';$('printerAccessCodeIn').focus();status('주소와 일련번호를 채웠어요. 프린터 화면의 8자리 코드를 입력하고 저장하세요.');};
 setInterval(()=>{if($('boothDialog').open)$('directBoothWarning').textContent=warning(paired());},1500);
}
function init(){studio();booth();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(globalThis);
