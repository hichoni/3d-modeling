const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const counts=require('../src/statistics-core.js');
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
class Statistics{
 constructor(file,{now=()=>new Date()}={}){
  this.file=file;this.now=now;this.data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):counts.empty(now());
  if(this.data.version!==1||!this.data.experiences||!this.data.prints)throw Error('공방 집계 파일을 확인하세요.');
 }
 save(next=this.data){fs.mkdirSync(path.dirname(this.file),{recursive:true});const temporary=this.file+'.tmp';fs.writeFileSync(temporary,JSON.stringify(next));fs.renameSync(temporary,this.file);this.data=next;}
 record(owner,experiences){
  if(!owner)throw Error('체험 기기의 연결 정보가 필요합니다.');
  if(!Array.isArray(experiences)||experiences.length<1||experiences.length>50)throw Error('체험 기록은 한 번에 1~50개씩 보내주세요.');
  const now=this.now().getTime();
  for(const e of experiences)if(!e||!/^[a-f0-9]{64}$/.test(e.id||'')||!validTime(e.at)||Date.parse(e.at)>now+300000||Date.parse(e.at)<Date.UTC(2020,0,1))throw Error('체험 시작 기록을 확인하세요.');
  const next={...this.data,experiences:{...this.data.experiences}};let changed=false;for(const e of experiences){const key=crypto.createHash('sha256').update(e.id).digest('hex');if(!next.experiences[key]){next.experiences[key]={at:new Date(e.at).toISOString()};changed=true;}}
  if(changed)this.save(next);return this.summary();
 }
 complete(job){return this.reconcile([job]);}
 reconcile(jobs){
  const next={...this.data,prints:{...this.data.prints}};let changed=false;
  for(const job of jobs){
   if(job.state!=='complete'||!/^[a-f0-9]{24}$/.test(job.id||''))continue;
   const timestamp=job.completedAt||job.completionEvidence?.at||job.completedRecordAt,at=validTime(timestamp)?new Date(timestamp).toISOString():null,previous=next.prints[job.id];
   if(previous&&(!at||previous.at))continue;
   next.prints[job.id]={at,source:job.completedAt?'printer_report':job.completionEvidence?.at?'completion_evidence':job.completedRecordAt?'legacy_completed_record':'undated'};changed=true;
  }
  if(changed)this.save(next);return changed;
 }
 summary(){return counts.summary(this.data,this.now());}
}
module.exports={Statistics};
