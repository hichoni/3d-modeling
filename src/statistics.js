class WorkshopStatistics{
 constructor(){
  this.key='click-statistics-v1';this.visitKey='click-experience-v1';this.remote=null;this.busy=false;this.pending=new Set();
  this.data=this.read();this.render();setInterval(()=>{this.render();void this.sync();},15000);
  addEventListener('storage',event=>{if(event.key===this.key){this.data=this.read();this.render();}});
 }
 read(){try{const d=JSON.parse(localStorage.getItem(this.key));if(d?.version===1&&d.experiences&&d.prints){const valid=e=>e&&Number.isFinite(Date.parse(e.at));return {...d,experiences:Object.fromEntries(Object.entries(d.experiences).filter(([,e])=>valid(e))),prints:Object.fromEntries(Object.entries(d.prints).filter(([,e])=>e&&(e.at===null||valid(e))))};}}catch{}return this.data||WorkshopCounts.empty();}
 save(){try{localStorage.setItem(this.key,JSON.stringify(this.data));}catch{}}
 begin(){
  this.data=this.read();let visit;try{visit=JSON.parse(localStorage.getItem(this.visitKey));}catch{}
  if(!/^[a-f0-9]{64}$/.test(visit?.id||'')||!Number.isFinite(Date.parse(visit.at))||WorkshopCounts.day(visit.at)!==WorkshopCounts.day()){
   const bytes=crypto.getRandomValues(new Uint8Array(32));visit={id:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),at:new Date().toISOString()};
   try{localStorage.setItem(this.visitKey,JSON.stringify(visit));}catch{}
  }
  this.data.experiences[visit.id]||={at:visit.at};this.save();this.render();void this.sync();
 }
 next(){try{localStorage.removeItem(this.visitKey);}catch{}}
 connected(snapshot){this.remote=snapshot||null;this.pending.clear();this.render();void this.sync();}
 complete(job){this.data=this.read();this.data.prints[job.id]||={at:job.completedAt||new Date().toISOString(),...(WorkshopCounts.pieces(job)>1?{pieces:2}:{})};this.save();this.render();void this.sync();}
 async sync(){
  if(!local||this.busy)return;this.busy=true;const source=local;
  try{
   const data=await api('/api/statistics');if(local!==source)return;this.remote=data;
   this.data=this.read();const pending=Object.entries(this.data.experiences).filter(([id])=>!this.pending.has(id));
   for(let offset=0;offset<pending.length;offset+=50){const batch=pending.slice(offset,offset+50),result=await api('/api/experiences',{experiences:batch.map(([id,e])=>({id,at:e.at}))});if(local!==source)return;this.remote=result;batch.forEach(([id])=>this.pending.add(id));}
   this.render();
  }catch{this.remote=null;this.render();}finally{this.busy=false;}
 }
 render(){
  const date=new Date(),remote=local&&this.remote?.date===WorkshopCounts.day(date)?this.remote:null,s=remote||WorkshopCounts.summary(this.data,date);
  $('workshopDate').dateTime=WorkshopCounts.day(date);$('workshopDate').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:WorkshopCounts.timeZone,year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(date);
  const format=new Intl.NumberFormat('ko-KR');for(const [id,key]of [['todayParticipants','todayParticipants'],['todayPrints','todayPrints'],['totalParticipants','totalParticipants'],['totalPrints','totalPrints']]){const value=format.format(s[key]);if($(id).textContent!==value)$(id).textContent=value;}
  $('statisticsScope').textContent=remote?'공방 전체':'이 기기';$('statisticsScope').title=remote?'같은 공방에 연결된 체험과 완료 출력의 합계':'이 브라우저의 체험 기록 · 공방에 연결하면 전체 집계와 합쳐져요';
  $('statisticsInfo').textContent='체험 시작 1회당 1명 · 출력 완료 기준(판 1장당 1개) · 한국 시간';
  $('statisticsInfo').title='같은 체험의 새로고침·수정은 중복 집계하지 않아요. 새 작품 만들기로 시작하면 다음 체험으로 셉니다. 인원 기록은 집계 기능 적용 시점부터 보관합니다.';
 }
}
