const WorkshopCounts=(()=>{
 const timeZone='Asia/Seoul';
 const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 function day(at=new Date()){return dayFormat.format(new Date(at));}
 function empty(at=new Date()){return {version:1,timeZone,startedAt:new Date(at).toISOString(),experiences:{},prints:{}};}
 function summary(data,at=new Date()){
  const date=day(at),experiences=Object.values(data.experiences),prints=Object.values(data.prints);
  return {date,timeZone,startedAt:data.startedAt,todayParticipants:experiences.filter(e=>day(e.at)===date).length,totalParticipants:experiences.length,todayPrints:prints.filter(e=>e.at&&day(e.at)===date).length,totalPrints:prints.length,undatedPrints:prints.filter(e=>!e.at).length};
 }
 return {timeZone,day,empty,summary};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=WorkshopCounts;
