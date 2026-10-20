// Shared, allowlisted web presets. Names do not claim Bambu Studio engine equivalence.
(function(root){
 const qualities={fine:{label:'0.12mm · 정밀',height:.12,top:5,bottom:5},balanced:{label:'0.16mm · 균형',height:.16,top:6,bottom:4},standard:{label:'0.20mm · 표준',height:.2,top:5,bottom:3}};
 const materials={generic:{label:'Generic PLA',flow:.98,maxFlow:12,fan:255,minLayerTime:4},matte:{label:'Bambu PLA Matte',flow:.98,maxFlow:12,fan:204,minLayerTime:6}};
 function get(quality='standard',material='generic'){
  if(!Object.hasOwn(qualities,quality)||!Object.hasOwn(materials,material))throw Error('지원하지 않는 웹 슬라이싱 설정입니다.');
  return {id:`click-paths-0.4-${qualities[quality].height}-${material}-v3`,quality,material,...qualities[quality],materialLabel:materials[material].label,...materials[material],label:qualities[quality].label,firstHeight:.2,width:.42,nozzle:220,bed:65};
 }
 function fromId(id){if(id==='click-paths-0.4-0.2-v2')return {...get(),id};for(const q of Object.keys(qualities))for(const m of Object.keys(materials)){const p=get(q,m);if(p.id===id)return p;}throw Error('웹 슬라이싱 프로필이 다릅니다. 최신 웹에서 다시 계산해주세요.');}
 const api={qualities,materials,get,fromId};root.WebPrintProfiles=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
