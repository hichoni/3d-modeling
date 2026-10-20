const PrintLesson=(()=>{
 const steps=['bed','nozzle','filament','printing','cooling'];
 const lessons={
  bed:{name:'베드',title:'작품이 태어나는 따뜻한 바닥',body:'이 넓은 판이 베드예요. 첫 층이 잘 붙도록 따뜻하게 데워요. 출력 중에는 움직이니 손을 넣지 않아요.',focus:'bed'},
  nozzle:{name:'노즐',title:'작지만 아주 뜨거운 노즐!',body:'프린터 머리 아래의 작은 금속 끝이 노즐이에요. PLA를 녹일 만큼 뜨거워져요. 손으로 만지면 안 돼요.',focus:'nozzle'},
  filament:{name:'필라멘트',title:'이 가느다란 실이 작품이 된다고?',body:'실처럼 생긴 PLA가 튜브를 따라 머리로 들어가요. 안에서 녹은 뒤 노즐 끝으로 가늘게 나와요.',focus:'filament'},
  printing:{name:'한 층씩',title:'작은 길을 따라, 차곡차곡',body:'베드와 프린터 머리가 함께 움직여요. 녹은 PLA로 길을 그리고, 0.2mm씩 쌓아 내 작품을 만들어요.',focus:'printing'},
  cooling:{name:'식히기',title:'다 만든 뒤에는, 잠깐 식혀요',body:'출력이 끝나도 노즐과 베드는 뜨거울 수 있어요. 충분히 식은 뒤 작품을 꺼내고 받침에 끼워요.',focus:'bed'},
  transfer:{name:'전송 중',title:'내 작품의 길을 프린터에게 보내요',body:'웹에서 계산한 노즐 경로를 A1 mini로 보내고 있어요. 전송이 끝나면 프린터가 준비를 시작해요.',focus:'overview'},
  prepare:{name:'출력 준비',title:'출력 전에 꼼꼼하게 준비해요',body:'프린터가 베드 높이와 재료 흐름을 확인할 수 있어요. 본체에 안내가 뜨면 안내에 따라주세요.',focus:'overview'},
  paused:{name:'잠시 멈춤',title:'프린터가 도움을 기다려요',body:'프린터 본체에 나온 안내를 확인해주세요. 설명을 넘겨도 실제 프린터가 다시 시작되지는 않아요.',focus:'overview'},
  offline:{name:'연결 확인',title:'실제 상태를 다시 확인하고 있어요',body:'최신 상태가 도착하지 않아 온도와 움직임 표시를 멈췄어요. 다시 출력 버튼을 누르지 말고 본체를 확인해주세요.',focus:'overview'},
  uncertain:{name:'본체 확인',title:'시작 결과를 아직 확인하지 못했어요',body:'중복 출력을 막기 위해 자동으로 다시 보내지 않아요. A1 mini 본체에서 현재 작업을 확인해주세요.',focus:'overview'},
  failed:{name:'작업 확인',title:'프린터의 안내를 확인해주세요',body:'작업이 중단됐어요. 본체 안내와 재료를 확인해주세요. 원인을 확인하기 전에는 다시 출력하지 않아요.',focus:'overview'},
  complete:{name:'출력 완료',title:'내 상상이 진짜 작품이 됐어요!',body:'출력이 끝났어요. 노즐과 베드가 충분히 식었는지 확인하고 작품을 꺼내요. 받침과 스위치를 끼우면 딸깍!',focus:'printing'},
  idle:{name:'A1 mini',title:'내 작품은 어떻게 만들어질까?',body:'바로 출력을 누르면 이 프린터로 작품을 보내요. 기다리는 동안 베드·노즐·필라멘트의 비밀을 살펴봐요.',focus:'overview'}
 };
 function phase(job,t){
  if(!job||['ready','queued','slice_wait','slicing','cancelled'].includes(job.state))return 'idle';
  if(['failed','uncertain','paused'].includes(job.state))return job.state;
  if(['uploading','sent'].includes(job.state))return 'transfer';
  if(job.state==='complete')return t?.fresh&&((t.nozzleTemperature??0)>50||(t.bedTemperature??0)>40)?'cooling':'complete';
  if(!t?.fresh)return 'offline';
  if(job.state==='printing'&&Number(job.layer)>0)return 'printing';
  if(t.bedTarget>0&&t.bedTemperature!==null&&t.bedTemperature<t.bedTarget-2)return 'bed';
  if(t.nozzleTarget>0&&t.nozzleTemperature!==null&&t.nozzleTemperature<t.nozzleTarget-3)return 'nozzle';
  return 'prepare';
 }
 function temperature(value){return typeof value==='number'&&Number.isFinite(value)?Math.round(value)+'°':'—';}
 return {steps,lessons,phase,temperature};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PrintLesson;
