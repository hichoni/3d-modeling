'use strict';
const $ = id => document.getElementById(id);
const FONTS = [
  {id:'jua',label:'동글동글',family:'Jua',weight:400},
  {id:'dohyeon',label:'또박또박',family:'Do Hyeon',weight:400},
  {id:'gaegu',label:'손글씨',family:'Gaegu',weight:700},
  {id:'myeongjo',label:'고전적인',family:'Nanum Myeongjo',weight:800}
];
const fontById = id => FONTS.find(f=>f.id===id)||FONTS[0];
const DEFAULTS = Object.freeze({text:'나다움',font:'jua',mode:'relief',shape:'rounded',layout:'auto',w:24,h:30,base:3,relief:1.2,border:1.2,bold:0.15,fill:true,mirror:true,handle:'none',handleH:12,color:'#b7a5dc'});
const S = {...DEFAULTS};
const PRESETS = [
  {id:'soft',title:'동글한 나',desc:'부드러운 모서리, 귀여운 글씨',shape:'rounded',font:'jua',layout:'auto',mode:'relief',color:'#b7a5dc'},
  {id:'classic',title:'반듯한 나',desc:'정갈한 사각형, 단단한 인상',shape:'square',font:'dohyeon',layout:'auto',mode:'relief',color:'#e9b17e'},
  {id:'round',title:'자유로운 나',desc:'동그란 도장 속 내 손글씨',shape:'circle',font:'gaegu',layout:'auto',mode:'relief',color:'#9abb9f'},
  {id:'heritage',title:'멋스러운 나',desc:'전통 세로쓰기, 클래식한 분위기',shape:'oval',font:'myeongjo',layout:'trad',mode:'engrave',color:'#cd8d8a'}
];
const SHAPE_LABELS = {square:'정사각',rounded:'둥근 사각',circle:'원형',oval:'타원',rect:'직사각'};
const HANDLE_LABELS = {none:'판만 만들기',round:'둥근 손잡이',hex:'육각 손잡이'};
function safeName(value){return String(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'').trim().slice(0,32)||'나의도장';}
function validText(text){return /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+$/.test(text.replace(/\s/g,''));}
