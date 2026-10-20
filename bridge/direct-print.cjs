// A participant can start only their own file on their current paired printer.
// A repeat click observes the existing attempt; it never submits another command.
const {printOptions}=require('./print-preparation.cjs');
function ownJob(job,owner,pairings){
 if(!owner||job.clientId!==owner){const e=Error('이 기기의 작업을 찾을 수 없습니다.');e.status=404;throw e;}
 if(!pairings.matches(job))throw Error('프린터 선택이 바뀌었습니다. 작품을 다시 준비해주세요.');
}
function directPrint({job,owner,pairings,fleet,body,save}){
 ownJob(job,owner,pairings);
 if(body.ready!==true||body.sha256!==job.sha256)throw Error('빈 베드·텍스처 PEI·0.4mm 노즐·외부 PLA를 준비한 뒤 눌러주세요.');
 const active=fleet.item(job.printerId).active,options=printOptions(body.printOptions);
 if(job.mode==='direct'&&active===job&&['uploading','sent','accepted','printing','paused','uncertain'].includes(job.state)){if(JSON.stringify(printOptions(job.printOptions))!==JSON.stringify(options))throw Error('시작한 출력의 보정 설정은 바꿀 수 없습니다.');return null;}
 if(!['ready','queued'].includes(job.state)||job.startAttempted)throw Error('이미 처리한 작업입니다. 현재 출력 상태를 확인해주세요.');
 const previous=job.state,checks={sha256:job.sha256,bedClear:true,plaReady:true,browserProfileAcknowledged:true,printOptions:options};
 job.state='queued';
 try{fleet.check(job,checks);}catch(e){job.state=previous;throw e;}
 job.mode='direct';save(job);
 return fleet.start(job,checks).catch(e=>{
  if(job.state==='queued'){job.state='failed';job.error='출력 파일을 확인하지 못했습니다. 작품을 다시 준비해주세요.';save(job);}
  throw e;
 });
}
function stopOwnJob({job,owner,pairings,fleet}){
 ownJob(job,owner,pairings);
 if(fleet.item(job.printerId).active!==job)throw Error('현재 출력과 일치하지 않습니다. 프린터 본체를 확인하세요.');
 fleet.stop(job.printerId);
}
module.exports={directPrint,stopOwnJob};
