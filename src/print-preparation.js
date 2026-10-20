let preparationPrinter='',preparationStored={};
try{preparationStored=JSON.parse(localStorage.getItem('click-print-preparation')||'{}')||{};}catch{}
function sliceSelection(){return {quality:document.getElementById('sliceQuality').value,material:document.getElementById('sliceMaterial').value};}
function selectedPrintOptions(){return {bedLeveling:$('bedLevelingOption').checked,flowCalibration:$('flowCalibrationOption').checked};}
function renderPrintPreparation(telemetry,locked,printerId,submitted){
 if(preparationPrinter!==printerId){preparationPrinter=printerId;const stored=preparationStored[printerId];$('bedLevelingOption').checked=stored?.bedLeveling!==false;$('flowCalibrationOption').checked=stored?.flowCalibration!==false;}
 if(locked&&submitted){$('bedLevelingOption').checked=submitted.bedLeveling;$('flowCalibrationOption').checked=submitted.flowCalibration;}
 $('calibrationControls').disabled=locked||!local||local.version<7;
 const o=selectedPrintOptions();$('calibrationSummary').textContent=(locked?'이번 출력 · ':'선택한 보정 · ')+(o.bedLeveling?'레벨링 켬':'레벨링 끔')+' / '+(o.flowCalibration?'유량 보정 켬':'유량 보정 끔');
 const f=telemetry?.fresh&&telemetry.filament?.fresh?telemetry.filament:null,t=f?.external,type=t?.type,color=t?.color;
 const blocked=!!(type&&type.toUpperCase()!=='PLA'||f?.active?.source==='ams');
 $('filamentType').textContent=type||'재질 정보 없음';$('filamentColor').textContent=color||'색상 미등록';$('filamentSwatch').style.backgroundColor=color||'transparent';$('filamentSwatch').classList.toggle('unknown',!color);
 $('filamentStatus').textContent=!f?'최신 재료 정보를 받지 못했어요. 본체에서 외부 PLA를 확인해주세요.':blocked?'현재 웹 출력은 외부 PLA 전용이에요. 본체의 재료 설정과 실제 스풀을 맞춰주세요.':'본체에 저장된 재질·색상입니다. 실제 스풀을 자동 감지한 값은 아니에요.';
 $('filamentStatus').classList.toggle('material-warning',blocked);$('filamentProfile').textContent=((job?.slice?(job.slice.materialLabel||'Generic PLA'):browserSlice?.slice.materialLabel||WebPrintProfiles.get(sliceSelection().quality,sliceSelection().material).materialLabel))+' · 노즐 220°C / 베드 65°C'+(t?.nozzleMin&&t?.nozzleMax?' · 본체 권장 '+t.nozzleMin+'–'+t.nozzleMax+'°C':'');
 $('amsFilaments').hidden=!f?.slots?.length;$('amsFilamentList').replaceChildren();for(const slot of f?.slots||[]){const li=document.createElement('li');li.textContent='슬롯 '+(slot.slot+1)+' · '+(slot.type||'미등록')+' · '+(slot.color||'색상 없음')+(f.active?.slot===slot.slot?' · 사용 중':'');$('amsFilamentList').append(li);}
 return blocked;
}
function bindPrintPreparation(){
 try{const saved=JSON.parse(localStorage.getItem('click-slice-selection')||'null');if(saved){WebPrintProfiles.get(saved.quality,saved.material);$('sliceQuality').value=saved.quality;$('sliceMaterial').value=saved.material;}}catch{}
 for(const id of ['bedLevelingOption','flowCalibrationOption'])$(id).onchange=()=>{if(printActive())return;preparationStored[preparationPrinter]=selectedPrintOptions();try{localStorage.setItem('click-print-preparation',JSON.stringify(preparationStored));}catch{}renderTicket();};
 for(const id of ['sliceQuality','sliceMaterial'])$(id).onchange=()=>{if(printActive())return;try{localStorage.setItem('click-slice-selection',JSON.stringify(sliceSelection()));}catch{}clearBrowserSlice();job=null;clearInterval(jobTimer);sessionStorage.removeItem('click-current-job');layerSelection=null;renderSlice();renderTicket();if(step===1)void sliceInBrowser();};
}
