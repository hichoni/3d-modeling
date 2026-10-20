const {privateIPv4}=require('./access.cjs');
function printerDefinitions(config){
 const list=config.printers?.length?config.printers:[{id:'mini-01',name:config.printer?.name||'A1 mini 01',...config.printer}];
 if(list.length>32)throw Error('한 공방에서 최대 32대의 A1 mini를 설정할 수 있습니다.');
 const ids=new Set(),ips=new Set(),serials=new Set();
 return list.map(p=>{
  if(!/^[a-zA-Z0-9_-]{1,32}$/.test(p.id||'')||ids.has(p.id))throw Error('프린터 ID는 중복되지 않아야 합니다.');ids.add(p.id);
  if(p.ip&&(!privateIPv4(p.ip)||ips.has(p.ip)))throw Error('프린터 IP는 서로 다른 사설 IPv4 주소여야 합니다.');if(p.ip)ips.add(p.ip);
  if(p.serial&&(!/^[a-zA-Z0-9_-]{5,40}$/.test(p.serial)||serials.has(p.serial)))throw Error('프린터 일련번호가 잘못됐거나 중복됐습니다.');if(p.serial)serials.add(p.serial);
  if(p.operatorPin&&!/^\d{6,12}$/.test(p.operatorPin))throw Error('미니별 운영자 PIN은 6~12자리 숫자로 입력하세요.');
  return {...p,name:String(p.name||p.id).slice(0,40)};
 });
}
module.exports={printerDefinitions};
