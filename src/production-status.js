/* Presentation only: no printer commands, estimates or simulated progress are generated here. */
(function(root){
 const boundStates=['uploading','sent','accepted','printing','paused','uncertain','complete','failed','cancelled'];
 const bound=job=>!!job&&boundStates.includes(job.state);
 const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
 const duration=seconds=>{const n=Math.round(seconds);return Math.floor(n/60)+'분 '+String(n%60).padStart(2,'0')+'초';};
 function describe({job=null,printer=null,telemetry=null,connected=false,slice=null,slicing=false}={}){
  const owns=bound(job),fresh=telemetry?.fresh===true,printing=job?.state==='printing';
  const printerName=owns?(job.printerName||printer?.name||'작업 프린터'):printer?.name||'아직 연결하지 않았어요';
  let printerState=!connected?'프린터 연결 필요':!printer?'프린터를 선택해주세요':!fresh?'최신 상태 확인 필요':printer.paired&&!printer.mine?'다른 기기에서 사용 중':printer.busy&&!owns?'다른 작품 출력 중':'연결됨',tone=fresh?'ok':'muted';
  if(owns&&['uploading','sent'].includes(job.state))printerState=job.state==='uploading'?'파일 전송 중':'시작 응답 확인 중';
  else if(owns&&!fresh&&!['complete','failed','cancelled'].includes(job.state)){printerState='연결 확인 중 · 본체를 확인해요';tone='warning';}
  else if(owns&&fresh&&['accepted','printing','paused'].includes(job.state)){printerState={accepted:'출력 준비 중',printing:'내 작품 출력 중',paused:'본체 확인 필요'}[job.state];tone=job.state==='paused'?'warning':'ok';}
  if(job?.state==='uncertain'){printerState='시작 결과 확인 필요';tone='warning';}
  let timeLabel='작품 경로 예상',timeValue=slicing?'계산 중…':'슬라이싱 후 확인',timeNote='예열·보정 시간은 별도예요.';
  if(slice&&finite(slice.seconds)){timeValue=duration(slice.seconds);if(slice.source!=='browser'){timeLabel='준비 포함 예상';timeNote='슬라이서 예상값 · 실제 시간은 달라질 수 있어요.';}}
  if(printing){
   if(fresh&&finite(telemetry.remainingMinutes)){timeLabel='프린터가 알려준 남은 시간';timeValue=telemetry.remainingMinutes===0?'곧 완료 예정':Math.ceil(telemetry.remainingMinutes)+'분';timeNote='실제 프린터의 최신 예상값이에요.';}
   else if(!fresh){timeLabel='남은 시간';timeValue='확인 중';timeNote='연결이 돌아오면 최신 시간을 보여줘요.';}
   else timeNote='전체 경로 예상값이에요. 남은 시간은 아직 받지 못했어요.';
  }
  if(job?.state==='paused'){timeLabel='남은 시간';timeValue='일시 정지';timeNote='본체 안내를 확인해주세요.';}
  if(job?.state==='uncertain'){timeLabel='진행 상태';timeValue='본체 확인 필요';timeNote='중복 전송하지 말고 현재 작업을 확인해주세요.';}
  if(job?.state==='complete'){timeLabel='출력 상태';timeValue='출력 완료';timeNote='베드가 식으면 작품을 꺼내요.';}
  if(job?.state==='failed'||job?.state==='cancelled'){timeLabel='출력 상태';timeValue=job.state==='failed'?'작업 중단':'작업 취소';timeNote='본체와 작품을 확인한 뒤 다시 준비해요.';}
  const progress=job?.state==='complete'?100:printing&&fresh&&finite(job.progress)?Math.min(100,job.progress):null;
  const progressText=job?.state==='complete'?'100% · 출력 완료':printing&&!fresh?'최신 진행률 확인 중':printing&&progress!==null?progress+'% · '+(job.layer||0)+' / '+(job.slice?.layers||'—')+'층':({paused:'일시 정지',failed:'작업 중단',cancelled:'작업 취소',uncertain:'본체 확인 필요'})[job?.state]||(owns?'프린터 상태 확인 중':'아직 출력하지 않았어요');
  return {printerName,printerState,tone,timeLabel,timeValue,timeNote,progress,progressText};
 }
 root.ProductionStatus={bound,describe};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.ProductionStatus;
})(globalThis);
