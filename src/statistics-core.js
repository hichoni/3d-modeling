const WorkshopCounts=(()=>{
 const timeZone='Asia/Seoul';
 const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 function day(at=new Date()){return dayFormat.format(new Date(at));}
 function empty(at=new Date()){return {version:1,timeZone,startedAt:new Date(at).toISOString(),experiences:{},prints:{}};}
 // Prints count pieces, not jobs: a 2-key keychain pair is two plates in one job (dimensions.pair from print-job.js).
 function pieces(job){return job?.dimensions?.pair||job?.pieces===2?2:1;}
 function summary(data,at=new Date()){
  const date=day(at),experiences=Object.values(data.experiences),prints=Object.values(data.prints),count=list=>list.reduce((n,e)=>n+(e.pieces===2?2:1),0);
  return {date,timeZone,startedAt:data.startedAt,todayParticipants:experiences.filter(e=>day(e.at)===date).length,totalParticipants:experiences.length,todayPrints:count(prints.filter(e=>e.at&&day(e.at)===date)),totalPrints:count(prints),undatedPrints:count(prints.filter(e=>!e.at))};
 }
 return {timeZone,day,empty,summary,pieces};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WorkshopCounts;
