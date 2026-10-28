/* The inspector owns presentation and edit history; geometry and printing remain in app.js. */
const editHistories=[null,null,null];
let toolTab='content',thumbRevision=0,thumbTimer;
const MODE_LABELS={relief:'볼록',puffy:'말랑',engrave:'오목',through:'뚫림',stamp:'도장'};
const COLOR_LABELS={'#ff7b92':'딸기','#ffd45f':'레몬','#65baff':'하늘','#77cbb6':'민트','#b7a0e9':'포도','#f5f0e5':'크림'};
function activeHistory(){return editHistories[pairSlot]||=(new DesignHistory(S));}
function recordDesignEdit(group){activeHistory().record(S,group);syncHistory();}
function syncHistory(){
 const h=activeHistory(),locked=printActive()||composing;
 $('undoBtn').disabled=locked||!h.past.length;$('redoBtn').disabled=locked||!h.future.length;
 $('historyScope').textContent=slotted(fit)?(SLOT_NAMES[caseKeys(fit)]?.[pairSlot]||'현재')+' 칸의 편집 기록':'현재 작품의 편집 기록';
}
function undoDesign(redo=false){
 if(step!==0||printActive()||composing)return;
 const value=activeHistory()[redo?'redo':'undo']();if(!value)return;
 pendingPairSlot=null;Object.assign(S,value);change(true,{history:false});syncHistory();
 $('historyNotice').textContent=redo?'다시 적용했어요.':'이전 모습으로 되돌렸어요.';
}
function selectToolTab(tab,{focus=false}={}){
 if(!['content','depth','decor'].includes(tab))return;
 toolTab=tab;document.querySelectorAll('[data-tool-tab]').forEach(b=>{const on=b.dataset.toolTab===tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus();});
 document.querySelectorAll('[data-tool-panel]').forEach(p=>p.hidden=p.dataset.toolPanel!==tab);
 $('toolBody').scrollTop=0;scheduleWorkThumbnails();
}
function syncWorkbench(){
 syncHistory();
 const pic=S.content==='icon',host=$(pic?'pictureTools':'pointTools');
 if($('symbolGroup').parentElement!==host)host.append($('symbolGroup'));
 $('pictureTools').hidden=!pic;$('pointTools').hidden=pic;
 $('designSummary').textContent=[S.kind==='stamp20'?'20mm 도장':'14mm 키캡',pic?(symbolNames[S.icon]||'그림'):fontById(S.font).label,MODE_LABELS[S.mode],COLOR_LABELS[S.color]].join(' · ');
 $('stampDepthNote').hidden=S.kind!=='stamp20';
 syncSlotCards();scheduleWorkThumbnails();
}
function syncSlotCards(){
 const n=caseKeys(fitMode());
 document.querySelectorAll('[data-slot]').forEach(b=>{
  const i=+b.dataset.slot,on=i===pairSlot,d=on?S:pairSaved[i]?.design,label=SLOT_NAMES[n]?.[i]||'';
  b.hidden=i>=n;b.setAttribute('aria-pressed',String(on));
  b.setAttribute('aria-label',label+' 칸 · '+(on?'편집 중':d?'완성':'빈칸')+(d?' · '+designName(d):''));
  if(!b.querySelector('canvas')){const c=document.createElement('canvas');c.width=112;c.height=88;c.className='slot-thumb';c.setAttribute('aria-hidden','true');const name=document.createElement('span');name.className='slot-label';const status=document.createElement('small');status.className='slot-status';b.replaceChildren(c,name,status);}
  b.querySelector('.slot-label').textContent=label;
  b.querySelector('.slot-status').textContent=on?'편집 중':d?'완성':'빈칸';
  b.dataset.empty=String(!d);
 });
}
// Use the same face/layout drawing as the model, without constructing extra meshes for each option.
// These are lightweight comparisons; cut-through bridges and domed surfaces are checked in the main 3D view.
function withPreviewDesign(design,fn){
 const before={...S},part=characterPart,cell=lastCellMinMm;
 try{Object.assign(S,design);characterPart='flat';return fn();}
 finally{for(const key of Object.keys(S))if(!(key in before))delete S[key];Object.assign(S,before);characterPart=part;lastCellMinMm=cell;}
}
function paintWorkThumbnail(canvas,design){
 const key=JSON.stringify(design);if(canvas.dataset.preview===key)return;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 if(!design){ctx.strokeStyle='#cbd4cf';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.strokeRect(34,16,44,48);ctx.setLineDash([]);canvas.dataset.preview=key;delete canvas.dataset.workName;return;}
 withPreviewDesign(design,()=>{
  const size=plateSize(),px=128,ppm=px/(size+2),layered=pictureHasTop()&&['relief','puffy'].includes(S.mode);
  characterPart=layered||S.mode==='through'?'base':'flat';
  const mask=letterLayer(px,px,ppm,S.mode==='stamp',fontById(S.font),chars());
  let top;if(layered){characterPart='top';top=letterLayer(px,px,ppm,false,fontById(S.font),chars());}
  const tinted=(color,source=mask)=>{const c=mkCanvas(px,px),x=c.getContext('2d');x.drawImage(source,0,0);x.globalCompositeOperation='source-in';x.fillStyle=color;x.fillRect(0,0,px,px);return c;};
  ctx.save();ctx.scale(canvas.width/160,canvas.height/112);ctx.translate(80,47);ctx.transform(.72,.18,-.36,.43,0,0);ctx.translate(-64,-64);
  const plate=color=>{ctx.fillStyle=color;shapePath(ctx,64,64,size*ppm,size*ppm,'rounded',0,ppm);ctx.fill();};
  ctx.save();ctx.translate(0,9);plate('#b6b9b2');ctx.restore();plate(S.color);
  const cut=S.mode==='engrave'||S.mode==='through',lift=S.mode==='stamp'?10:S.mode==='puffy'?7:4;
  ctx.drawImage(tinted(cut?'#765b67':'#a36777'),0,cut?0:-lift+3);
  ctx.save();if(S.mode==='puffy'){ctx.shadowBlur=3;ctx.shadowColor='#fff2f7';}
  ctx.drawImage(tinted(cut?(S.mode==='through'?'#f7f5ee':'#c997a6'):'#fff1f3'),cut?1:0,cut?2:-lift);ctx.restore();
  if(top)ctx.drawImage(tinted('#a36777',top),0,-lift-2);
  ctx.restore();
 });
 canvas.dataset.preview=key;canvas.dataset.workName=designName(design);
}
function scheduleWorkThumbnails(){
 const mine=++thumbRevision;clearTimeout(thumbTimer);
 thumbTimer=setTimeout(async()=>{
  const design={...S},entries=[];
  if(toolTab==='content'&&S.content!=='icon')document.querySelectorAll('#fontTiles button').forEach(b=>entries.push([b.querySelector('canvas'),{...design,font:b.dataset.font}]));
  if(toolTab==='depth')document.querySelectorAll('[data-mode]').forEach(b=>entries.push([b.querySelector('canvas'),{...design,mode:b.dataset.mode}]));
  document.querySelectorAll('[data-slot]').forEach(b=>{if(!$('pairSlots').hidden&&!b.hidden)entries.push([b.querySelector('canvas'),+b.dataset.slot===pairSlot?design:pairSaved[+b.dataset.slot]?.design||null]);});
  const fonts=[...new Set(entries.filter(([,d])=>d).map(([,d])=>d.font))];
  await Promise.all(fonts.map(id=>ensureFont(fontById(id),design.content==='icon'?design.tag||'A':design.text||'A')));
  if(mine!==thumbRevision)return;
  for(const [canvas,d] of entries)if(canvas)try{paintWorkThumbnail(canvas,d);}catch{delete canvas.dataset.preview;}
 },120);
}
function bindWorkbench(){
 activeHistory();$('undoBtn').onclick=()=>undoDesign();$('redoBtn').onclick=()=>undoDesign(true);
 const footer=document.querySelector('.model-stage .stage-bottom');
 new ResizeObserver(()=>coachStage().style.setProperty('--stage-controls-height',Math.ceil(footer.getBoundingClientRect().height)+'px')).observe(footer);
 document.querySelectorAll('[data-tool-tab]').forEach((b,i,list)=>{
  b.onclick=()=>selectToolTab(b.dataset.toolTab);
  b.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%list.length;if(e.key==='ArrowLeft')next=(i+list.length-1)%list.length;if(e.key==='Home')next=0;if(e.key==='End')next=list.length-1;if(next!==undefined){e.preventDefault();selectToolTab(list[next].dataset.toolTab,{focus:true});}};
 });
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||!(e.ctrlKey||e.metaKey)||e.altKey||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const key=e.key.toLowerCase();if(key==='z'||key==='y'){if(step!==0||printActive())return;e.preventDefault();undoDesign(key==='y'||e.shiftKey);}
 });
 document.querySelectorAll('[data-mode]').forEach(b=>{const c=document.createElement('canvas');c.width=160;c.height=112;c.className='work-thumb';c.setAttribute('aria-hidden','true');b.querySelector('svg')?.replaceWith(c);});
 selectToolTab('content');
}
