'use strict';
const $=id=>document.getElementById(id);
const FONTS=[{id:'jua',label:'동글',family:'Jua',weight:400},{id:'dohyeon',label:'또박',family:'Do Hyeon',weight:400},{id:'gaegu',label:'손글씨',family:'Gaegu',weight:700}];
const fontById=id=>FONTS.find(f=>f.id===id)||FONTS[0];
const DEFAULTS=Object.freeze({text:'수민',content:'text',icon:'heart',decoration:'none',font:'jua',mode:'relief',shape:'rounded',layout:'auto',w:14,h:14,base:1.5,relief:.8,border:0,bold:.15,fill:false,mirror:false,handle:'none',handleH:0,color:'#ff7b92'});
const S={...DEFAULTS};
function safeName(value){return String(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'').trim().slice(0,32)||'나의키캡';}
function validText(text){return /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+$/.test(text.replace(/\s/g,''));}
function restoreDesign(input){
 const out={...DEFAULTS};
 const enums={content:['text','initials','icon'],icon:['heart','star','smile','leaf'],decoration:['none','heart','star','smile','leaf'],font:FONTS.map(f=>f.id),mode:['relief','engrave'],layout:['auto','row'],color:['#ff7b92','#ffd45f','#65baff','#77cbb6','#b7a0e9','#f5f0e5']};
 for(const [key,allowed] of Object.entries(enums))if(allowed.includes(input?.[key]))out[key]=input[key];
 if(typeof input?.text==='string'&&validText(input.text)&&Array.from(input.text).length<=4)out.text=input.text;
 if([.6,.8,1].includes(input?.relief))out.relief=input.relief;
 return out;
}
