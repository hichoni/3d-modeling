// Only the two reviewed firmware flags are configurable. Machine/profile settings stay fixed.
function printOptions(input){
 if(input===undefined)return {bedLeveling:true,flowCalibration:true};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['bedLeveling','flowCalibration'].includes(k))||Object.values(input).some(v=>typeof v!=='boolean'))throw Error('출력 전 보정 설정을 다시 확인해주세요.');
 return {bedLeveling:input.bedLeveling??true,flowCalibration:input.flowCalibration??true};
}
const text=v=>typeof v==='string'?v.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,40):'';
function tray(value,source,slot){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const raw=text(value.tray_color).toUpperCase(),color=/^[A-F0-9]{8}$/.test(raw)&&raw.slice(6)!=='00'?'#'+raw.slice(0,6):/^[A-F0-9]{6}$/.test(raw)?'#'+raw:null;
 const temp=v=>Number.isFinite(Number(v))&&Number(v)>=80&&Number(v)<=400?Number(v):null;
 return {source,slot,type:text(value.tray_type)||null,color,nozzleMin:temp(value.nozzle_temp_min),nozzleMax:temp(value.nozzle_temp_max)};
}
function filament(state,fresh){
 if(!fresh)return {fresh:false,external:null,slots:[],active:null};
 const external=tray(state.vt_tray,'external',254),slots=[];
 for(const ams of (Array.isArray(state.ams?.ams)?state.ams.ams:[]).slice(0,16)){
  const id=Number(ams.id);if(!Number.isInteger(id)||id<0||id>15)continue;
  for(const item of (Array.isArray(ams.tray)?ams.tray:[]).slice(0,4)){const slot=Number(item.id);if(!Number.isInteger(slot)||slot<0||slot>3)continue;const t=tray(item,'ams',id*4+slot);if(t)slots.push(t);}
 }
 const now=state.ams?.tray_now,id=now===undefined||now===null||now===''?null:Number(now);
 return {fresh:true,external,slots,active:id===254?external:slots.find(t=>t.slot===id)||null};
}
function checkFilament(state){
 const f=filament(state,true),type=f.external?.type;
 if(type&&type.toUpperCase()!=='PLA')throw Error('현재 웹 프로필은 외부 PLA 전용입니다. 본체의 외부 스풀 설정과 실제 재료를 PLA로 맞춰주세요.');
 if(f.active?.source==='ams')throw Error('현재 웹 출력은 외부 스풀 전용입니다. 본체에서 외부 PLA를 준비해주세요.');
}
module.exports={printOptions,filament,checkFilament};
