const fs=require('node:fs');
const crypto=require('node:crypto');
function clientId(token){return /^[a-f0-9]{64}$/.test(token||'')?crypto.createHash('sha256').update(token).digest('hex'):null;}
class Pairings {
 constructor(file,printers,{busy=()=>false,pending=()=>[],cancel=()=>{}}={}){
  this.file=file;this.printers=new Set(printers.map(p=>p.id));this.busy=busy;this.pending=pending;this.cancel=cancel;this.devices=new Map();
  if(fs.existsSync(file)){const saved=JSON.parse(fs.readFileSync(file,'utf8'));for(const d of saved){if(!/^[a-f0-9]{64}$/.test(d.id)||this.devices.has(d.id))continue;if(d.printerId&&!this.printers.has(d.printerId))d.printerId=null;if(d.printerId&&[...this.devices.values()].some(x=>x.printerId===d.printerId))throw Error('저장된 매칭에 중복 프린터가 있습니다. 운영자 확인이 필요합니다.');this.devices.set(d.id,d);}}
 }
 save(){const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify([...this.devices.values()],null,2));fs.renameSync(temp,this.file);}
 get(id){return this.devices.get(id)||null;}
 owner(printerId){return [...this.devices.values()].find(d=>d.printerId===printerId)||null;}
 publicDevice(id){const d=this.get(id);return d?{id:d.id,name:d.name,printerId:d.printerId,revision:d.revision,pendingJobs:this.pending(id).length}:null;}
 pair(id,printerId,name,discard=false){
  if(!id)throw Error('이 기기의 연결 정보를 다시 준비해주세요.');if(!this.printers.has(printerId))throw Error('등록된 프린터를 선택하세요.');
  const owner=this.owner(printerId);if(owner&&owner.id!==id)throw Error('이 미니는 다른 크롬북과 매칭되어 있어요. 운영자에게 해제를 요청하세요.');
  const old=this.get(id);if(old?.printerId===printerId){old.name=String(name||old.name).trim().slice(0,30);this.save();return this.publicDevice(id);}
  if(this.busy(printerId)||old?.printerId&&this.busy(old.printerId))throw Error('출력 중이거나 결과 확인이 필요한 미니의 매칭은 변경할 수 없어요.');
  const pending=this.pending(id);if(pending.some(j=>['slice_wait','slicing'].includes(j.state)))throw Error('슬라이싱이 끝난 뒤 매칭을 변경해주세요.');
  if(pending.length&&!discard)throw Error('기존 미출력 접수 취소에 체크한 뒤 매칭을 변경해주세요.');
  for(const j of pending)this.cancel(j);
  const d={id,name:String(name||old?.name||'체험 기기').trim().slice(0,30),printerId,revision:(old?.revision||0)+1};this.devices.set(id,d);this.save();return this.publicDevice(id);
 }
 release(id,discard=false){const d=this.get(id);if(!d?.printerId)return this.publicDevice(id);if(this.busy(d.printerId))throw Error('출력 중이거나 결과 확인이 필요한 미니는 먼저 본체 상태를 확인하세요.');const pending=this.pending(id);if(pending.some(j=>['slice_wait','slicing'].includes(j.state)))throw Error('슬라이싱이 끝난 뒤 매칭을 해제해주세요.');if(pending.length&&!discard)throw Error('기존 미출력 접수 취소에 체크해주세요.');for(const j of pending)this.cancel(j);d.printerId=null;d.revision++;this.save();return this.publicDevice(id);}
 matches(job){const d=this.get(job.clientId);return !!d?.printerId&&d.printerId===job.printerId&&d.revision===job.pairingRevision;}
}
module.exports={Pairings,clientId};
