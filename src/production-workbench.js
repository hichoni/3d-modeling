let printView='work';
const productionFeed={listAt:0,jobAt:0,listFailed:false,jobFailed:false};
function noteProductionFeed(kind){productionFeed[kind+'At']=Date.now();productionFeed[kind+'Failed']=false;}
function productionListFresh(raw){return raw?.fresh===true&&!productionFeed.listFailed&&Date.now()-productionFeed.listAt<15000;}
function productionTelemetry(printer){
 const own=ProductionStatus.bound(job),kind=own?'job':'list',raw=own?job?.telemetry:printer;
 const age=Date.now()-productionFeed[kind+'At'];
 return {...raw,fresh:raw?.fresh===true&&!productionFeed[kind+'Failed']&&age<15000};
}
function productionConnectionFailed(kind){
 productionFeed[kind+'Failed']=true;renderTicket();
}
function productionPrinter(){
 const id=ProductionStatus.bound(job)?job.printerId:$('directPrinterSelect').value||pairing?.printerId;
 return local?.printers?.find(p=>p.id===id)||null;
}
function renderProductionTemperatures(t){
 const fresh=t?.fresh===true,temperature=value=>PrintLesson.temperature(fresh?value:null);
 $('tourBedValue').textContent=temperature(t?.bedTemperature);$('tourBedTarget').textContent=temperature(t?.bedTarget);
 $('tourNozzleValue').textContent=temperature(t?.nozzleTemperature);$('tourNozzleTarget').textContent=temperature(t?.nozzleTarget);
 $('nozzleHeatLabel').textContent=fresh&&t.nozzleTemperature>50?'뜨거워요!':'가열 시 주의';
 $('tourTelemetrySource').textContent=fresh?'● 실제 프린터에서 받은 온도':'○ 실제 온도 확인 전';
}
function renderProductionSummary(){
 if(step===0)return;
 const printer=productionPrinter(),t=productionTelemetry(printer),actual=activeSlice();
 const info=ProductionStatus.describe({job,printer,telemetry:t,connected:!!local,slice:actual,slicing:browserSliceBusy||['slice_wait','slicing'].includes(job?.state)});
 $('productionName').textContent=modelName();$('productionName').title=modelName();
 const n=printCount(),size=current?.w||plateSize(),height=current?fmt(printHeight()):'—';
 $('productionSize').textContent=n>1?'키링 '+n+'구 · 판 '+n+'개 · 각 '+size+' × '+size+' mm · 최대 높이 '+height+' mm':'판 1개 · '+size+' × '+size+' × '+height+' mm';
 $('productionPrinter').textContent=info.printerName;$('productionPrinter').title=info.printerName;
 $('productionConnection').textContent=info.printerState;$('productionConnection').dataset.tone=info.tone;
 $('productionTimeLabel').textContent=info.timeLabel;$('productionTime').textContent=info.timeValue;$('productionTimeNote').textContent=info.timeNote;
 $('summaryConnectBtn').disabled=printActive();$('summaryConnectBtn').textContent=printer?'연결 보기':'연결하기';
 const designs=printPair()?setSlots().map(p=>p.design):[S],host=$('productionThumbs');
 while(host.children.length>designs.length)host.lastElementChild.remove();
 designs.forEach((design,i)=>{let c=host.children[i];if(!c){c=document.createElement('canvas');c.width=160;c.height=112;c.setAttribute('aria-hidden','true');host.append(c);}try{paintWorkThumbnail(c,design);}catch{}});
 if(info.progress===null)$('printProgress').removeAttribute('value');else $('printProgress').value=info.progress;
 $('printProgress').hidden=!ProductionStatus.bound(job)||['failed','cancelled','paused','uncertain'].includes(job?.state);$('printPercent').textContent=info.progressText;
 if(ProductionStatus.bound(job)&&!t.fresh&&!['complete','failed','cancelled','uploading','sent','uncertain','paused'].includes(job.state)){
  $('printState').textContent='연결 확인 중 · 본체를 확인해주세요';$('printDetail').textContent='최신 상태를 받지 못했어요. 다시 전송하지 말고 프린터 본체를 확인해주세요.';
 }
 $('printCard').dataset.state=job?.state||'idle';
}
function setPrintView(view){
 printView=view==='tour'?'tour':'work';
 document.querySelectorAll('[data-print-view]').forEach(b=>{const on=b.dataset.printView===printView;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
 $('resultPanel').hidden=step!==2||printView!=='work';$('printerTour').hidden=step!==2||printView!=='tour';
 if(step===2&&printView==='tour'){
  printerTutorial||=new PrinterTutorial();printerTutorial.setPart?.(printPair()?pairParts():current.parts,S.color,printHeight());
  printerTutorial.setJob(job,productionTelemetry(productionPrinter()));
 }
 printerTutorial?.show(step===2&&printView==='tour');placeStage();
}
function bindProductionWorkbench(){
 $('summaryConnectBtn').onclick=()=>{if(!printActive())$('boothBtn').click();};
 document.querySelectorAll('[data-print-view]').forEach((b,i,list)=>{
  b.onclick=()=>setPrintView(b.dataset.printView);
  b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?list.length-1:1-i;setPrintView(list[next].dataset.printView);list[next].focus();};
 });
 // A teaching animation must never replace the live temperature readings on the output card.
 setInterval(()=>{if(step>0)renderTicket();},5000);
}
