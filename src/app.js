let step=0, preset='soft', view='3d', current=null, rendererState=null;
let revision=0, builtRevision=-1, rebuildTimer, startedAt=null, finishedAt=null, job=null, exporting=false;
let modelError='', fontReady=false, toastTimer, rotating=false;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTextReady=()=>chars().length>0&&chars().length<=6&&validText(S.text);
const isReady=()=>!!current&&builtRevision===revision&&isTextReady()&&fontReady&&!modelError;

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function startSession(){if(startedAt===null)startedAt=Date.now();}
function clockText(seconds){return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
function tick(){const elapsed=startedAt===null?0:Math.floor(((finishedAt??Date.now())-startedAt)/1000);$('timer').textContent=clockText(Math.max(0,300-elapsed));$('timerLabel').textContent=finishedAt?'디자인 완성':elapsed>=300?'천천히 마무리해요':startedAt?'나만의 5분':'나만의 5분';document.querySelector('.session-clock').classList.toggle('elapsed',elapsed>=300);}
setInterval(tick,1000);

function setStep(next){
  if(next===3&&!isReady()){toast('글자와 모델 준비 상태를 확인해주세요.');return;}
  startSession();
  if(next<3&&finishedAt!==null){finishedAt=null;job=null;}
  step=next;
  document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=+el.dataset.panel!==step);
  document.querySelectorAll('[data-step]').forEach(el=>{const n=+el.dataset.step;el.classList.toggle('active',n===step);el.classList.toggle('done',n<step);if(n===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  $('backBtn').hidden=step===0;$('stepIndicator').hidden=step>0;$('stepIndicator').textContent=`STEP 0${step+1} / 04`;
  $('nextBtn').innerHTML=(['내 글자 새기기','입체로 다듬기','내 작품 완성하기','다음 참가자 시작'][step])+` <svg><use href="#icon-arrow"/></svg>`;
  $('restartBtn').innerHTML=`<svg><use href="#icon-reset"/></svg> ${step===3?'다음 참가자 시작':'처음부터 만들기'}`;
  const tips=[['작은 선택이, 나만의 디자인이 돼요.','같은 이름도 모양과 글꼴에 따라 전혀 다른 작품이 되죠.'],['거꾸로 새겨야, 바르게 찍혀요.','3D 도장의 글자는 자동으로 좌우 반전됩니다. 찍힌 모양도 확인해보세요.'],['높이를 더하면, 평면이 입체가 돼요.','슬라이더를 움직여 새김 높이가 어떻게 달라지는지 관찰해보세요.'],['디자인 끝! 이제 손으로 만날 차례예요.','운영자가 출력 파일을 확인한 뒤 제작과 수령 방법을 안내합니다.']][step];
  $('learningCopy').replaceChildren();const b=document.createElement('b');b.textContent=tips[0];$('learningCopy').append(b,document.createTextNode(' '+tips[1]));
  if(step===3){finishedAt=finishedAt??Date.now();job=job||makeJobId();$('resultName').textContent=chars().join('');$('jobId').textContent=job;$('elapsedResult').textContent=clockText(Math.round((finishedAt-startedAt)/1000));$('resultSize').textContent=`${dims().w} × ${dims().h} × ${fmt(current.totalH)} mm`;tick();}
  updateReadiness();
  if(window.innerWidth<=650){document.querySelector('.editor').scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'start'});}
}
function changed({tiles=false,interact=true}={}){
  if(interact)startSession();
  if(finishedAt!==null){finishedAt=null;job=null;}
  revision++;const mine=revision;builtRevision=-1;fontReady=false;modelError='';clearTimeout(rebuildTimer);
  $('busy').hidden=false;syncUI();updateReadiness();
  ensureFont(fontById(S.font),chars().join('')||'가').then(ok=>{
    if(mine!==revision)return;
    fontReady=ok;
    if(!ok)modelError='글꼴을 불러오지 못했어요. 파일을 다시 열어주세요.';
    drawProofs();
    rebuildTimer=setTimeout(()=>rebuild(mine),120);
  });
}
function rebuild(mine){
  if(mine!==revision)return;
  try{
    if(typeof THREE==='undefined')throw Error('3D 엔진을 불러오지 못했어요. 완전한 HTML 파일을 다시 열어주세요.');
    const next=buildGeometries();
    if(!next.parts.relief.length&&chars().length)throw Error('새김 면을 만들 수 없어요. 글자나 크기를 바꿔주세요.');
    next.stats=meshStats(next.parts.plate.concat(next.parts.relief));
    const old=current;current=next;builtRevision=mine;
    show3D(next);
    if(old)old.parts.plate.concat(old.parts.relief).forEach(g=>g.dispose());
  }catch(error){modelError=error.message||'모델을 만들지 못했어요. 설정을 바꿔주세요.';builtRevision=-1;}
  $('busy').hidden=true;updateReadiness();
}
function updateReadiness(){
  const list=[];
  if(!chars().length)list.push('새길 이름이나 별명을 입력해주세요.');
  else if(!validText(S.text))list.push('한글, 영문, 숫자로 입력해주세요. 이모지와 특수기호는 지원하지 않아요.');
  if(chars().length>6)list.push('글자는 6자까지 새길 수 있어요.');
  if(modelError)list.push(modelError);
  if(lastCellMinMm<4&&isTextReady())list.push('글자 칸이 작아요. 이름을 줄이거나 도장 크기를 키우면 더 또렷하게 나와요.');
  if(['myeongjo','gaegu'].includes(S.font)&&S.bold<.15)list.push('가는 획이 있는 글꼴이에요. ‘글자 획 보강’을 0.15 mm 이상 권장해요.');
  if(S.handle!=='none')list.push('손잡이를 더하면 출력량이 늘어요. 운영자가 판 아래의 서포트 필요 여부를 확인해주세요.');
  if(S.mode==='engrave'&&S.border<.6)list.push('오목한 글씨는 테두리를 0.6 mm 이상 두는 것이 좋아요.');
  $('warnings').replaceChildren(...list.map(text=>{const p=document.createElement('div');p.className='warning';p.textContent=text;return p;}));
  $('nextBtn').disabled=(step===1&&!isTextReady())||(step===2&&!isReady());
  document.querySelector('[data-step="3"]').disabled=!isReady();
  ['packageBtn','stlBtn','cardBtn'].forEach(id=>$(id).disabled=!isReady()||exporting);
  const invalid=!!S.text&&!isTextReady();$('textIn').setAttribute('aria-invalid',String(invalid));$('textHelp').classList.toggle('error',invalid);
  $('textHelp').textContent=invalid?'한글·영문·숫자를 최대 6자까지 입력해주세요.':'한글·영문·숫자 1~6자. 2~4자가 또렷하게 나와요.';
}
function syncUI(){
  $('charCount').textContent=chars().length+' / 6';
  ['layout','shape','mode','handle'].forEach(key=>document.querySelectorAll(`[data-${key}]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===S[key]))));
  document.querySelectorAll('[data-font]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.font===S.font)));
  document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===S.color)));
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===preset)));
  const rangeKeys={w:'w',h:'h',relief:'relief',hh:'handleH',border:'border',bold:'bold',base:'base'};
  for(const [id,key] of Object.entries(rangeKeys)){$(id+'In').value=S[key];$(id+'Out').textContent=fmt(S[key],2)+' mm';}
  $('hRow').hidden=isSquareish(S.shape);$('handleRow').hidden=S.handle==='none';$('widthLabel').textContent=S.shape==='circle'?'도장 지름':isSquareish(S.shape)?'도장 크기':'가로 길이';
  $('fillIn').checked=S.fill;
  const {w,h}=dims();$('sizeStat').innerHTML=`${w} × ${h} <small>mm</small>`;
  $('handleStat').textContent=S.handle==='none'?'가벼운 판형':S.handle==='hex'?'육각 손잡이':'둥근 손잡이';
}
function choosePreset(p){preset=p.id;for(const k of ['shape','font','layout','mode','color'])S[k]=p[k];S.border=1.2;S.bold=.15;changed();}
function buildChoices(){
  PRESETS.forEach(p=>{const b=document.createElement('button');b.className='preset-card';b.dataset.preset=p.id;b.setAttribute('aria-pressed',String(p.id===preset));const c=document.createElement('canvas');c.width=200;c.height=210;c.setAttribute('aria-hidden','true');const t=document.createElement('b');t.textContent=p.title;const desc=document.createElement('small');desc.textContent=p.desc;b.append(c,t,desc);b.addEventListener('click',()=>choosePreset(p));$('presets').append(b);});
  FONTS.forEach(f=>{const b=document.createElement('button');b.className='font-tile';b.dataset.font=f.id;b.style.fontFamily=`'${f.family}'`;b.style.fontWeight=f.weight;b.innerHTML=`<strong>가나다</strong><small>${f.label}</small>`;b.addEventListener('click',()=>{S.font=f.id;preset=null;changed();});$('fontTiles').append(b);});
  for(const [shape,label] of Object.entries(SHAPE_LABELS)){const b=document.createElement('button');b.dataset.shape=shape;b.innerHTML=`<span class="shape-icon ${shape}" aria-hidden="true"></span><small>${label}</small>`;$('shapeChoices').append(b);}
  [['#b7a5dc','라일락'],['#e9b17e','살구'],['#9abb9f','세이지'],['#cd8d8a','로즈'],['#e3d6b6','크림'],['#9aafc7','블루']].forEach(([color,label])=>{const b=document.createElement('button');b.dataset.color=color;b.setAttribute('aria-label',label);b.style.setProperty('--swatch',color);b.title=label;b.addEventListener('click',()=>{startSession();S.color=color;syncUI();if(rendererState)rendererState.mats.plate.color.set(color);});$('swatches').append(b);});
}
function drawPresetCards(){
  const saved={...S},keep=lastCellMinMm;
  PRESETS.forEach(p=>{Object.assign(S,DEFAULTS,p,{text:'나다움'});const cv=document.querySelector(`[data-preset="${p.id}"] canvas`);const ctx=cv.getContext('2d');const {w,h}=dims();drawFace(ctx,cv.width,cv.height,Math.min(155/w,165/h),false,'#b9554d',fontById(p.font));});
  Object.keys(S).forEach(k=>delete S[k]);Object.assign(S,saved);lastCellMinMm=keep;
}
function drawProofs(){
  for(const id of ['proofCanvas','largeProofCanvas']){const c=$(id);c.width=400;c.height=400;drawFace(c.getContext('2d'),400,400,310/Math.max(dims().w,dims().h),false,'#bf4b43',fontById(S.font));}
}
function setView(next){view=next;$('view3d').setAttribute('aria-pressed',String(next==='3d'));$('viewProof').setAttribute('aria-pressed',String(next==='proof'));$('largeProof').hidden=next!=='proof';$('stage').hidden=next!=='3d';$('proofInset').hidden=next!=='3d';$('previewControls').hidden=next!=='3d';$('stageHint').hidden=next!=='3d';if(next==='proof')stampAgain();}
function stampAgain(){const c=$('largeProofCanvas');c.classList.remove('stamping');void c.offsetWidth;c.classList.add('stamping');}

function init3D(){
  try{
    if(typeof THREE==='undefined')throw Error('3D 라이브러리를 불러오지 못했어요.');
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0,0);renderer.outputEncoding=THREE.sRGBEncoding;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label','내 도장 3D 미리보기');$('stage').append(renderer.domElement);
    const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(32,1,.1,2000);camera.up.set(0,0,1);
    scene.add(new THREE.HemisphereLight(0xffffff,0x8d8694,1.0));const key=new THREE.DirectionalLight(0xfff8ee,1.1);key.position.set(-40,-40,90);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-50;key.shadow.camera.right=50;key.shadow.camera.top=50;key.shadow.camera.bottom=-50;key.shadow.camera.near=1;key.shadow.camera.far=200;key.shadow.bias=-.0004;scene.add(key);
    const fill=new THREE.DirectionalLight(0xece1ff,.4);fill.position.set(40,40,50);scene.add(fill);
    const grid=new THREE.GridHelper(180,36,0xc9c7be,0xdedbd0);grid.rotation.x=Math.PI/2;grid.position.z=-.15;grid.material.transparent=true;grid.material.opacity=.55;scene.add(grid);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.1}));ground.position.z=-.1;ground.receiveShadow=true;scene.add(ground);
    const group=new THREE.Group();scene.add(group);
    const mats={plate:new THREE.MeshStandardMaterial({color:S.color,roughness:.62,metalness:0}),relief:new THREE.MeshStandardMaterial({color:0x8a5b79,roughness:.65})};
    const controls=new THREE.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.enablePan=false;controls.minDistance=25;controls.maxDistance=220;controls.maxPolarAngle=Math.PI*.48;controls.autoRotateSpeed=1.3;
    rendererState={renderer,scene,camera,controls,group,mats,fitKey:''};
    const resize=()=>{const box=$('stage').getBoundingClientRect();if(!box.width||!box.height)return;renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe($('stage'));resize();
    (function animate(){requestAnimationFrame(animate);if(document.hidden||view!=='3d')return;controls.update();renderer.render(scene,camera);})();
  }catch(e){const p=document.createElement('div');p.className='fallback3d';p.textContent='이 브라우저에서 3D 화면을 열 수 없어요. ‘찍어 보기’로 디자인을 확인하거나 Chrome / Edge에서 다시 열어주세요.';$('stage').append(p);$('previewControls').hidden=true;}
}
function show3D(model){
  $('heightStat').innerHTML=`${fmt(model.totalH)} <small>mm</small>`;
  if(!rendererState)return;
  const R=rendererState;R.group.clear();R.mats.plate.color.set(S.color);
  model.parts.plate.forEach(g=>{const mesh=new THREE.Mesh(g,R.mats.plate);mesh.castShadow=true;mesh.receiveShadow=true;R.group.add(mesh);});
  model.parts.relief.forEach(g=>{const mesh=new THREE.Mesh(g,R.mats.relief);mesh.castShadow=true;mesh.receiveShadow=true;R.group.add(mesh);});
  const key=[model.w,model.h,model.totalH].join('|');if(key!==R.fitKey){R.fitKey=key;resetCamera();}
}
function resetCamera(){
  if(!current||!rendererState)return;const R=rendererState,c=new THREE.Vector3(0,0,current.totalH*.4);
  const size=Math.max(current.w,current.h,current.totalH*1.15);const dist=size*2.7*(R.camera.aspect<.9?1.25:1);
  const dir=new THREE.Vector3(.48,-.85,1.15).normalize();R.camera.position.copy(c).addScaledVector(dir,dist);R.controls.target.copy(c);R.controls.update();
}

function makeJobId(){const d=new Date();const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d).replaceAll('-','');const nonce=new Uint32Array(1);crypto.getRandomValues(nonce);return `SG-${date}-${nonce[0].toString(36).toUpperCase().padStart(7,'0')}`;}
function metadata(){return {schemaVersion:1,jobId:job,createdAt:new Date().toISOString(),units:'mm',text:chars().join(''),design:{...S},dimensions:{...dims(),height:current.totalH},designSeconds:Math.round(((finishedAt??Date.now())-(startedAt??Date.now()))/1000),geometry:{triangles:current.stats.tris,volumeMm3:Math.round(current.stats.vol),representation:'overlapping closed shells; merge in slicer'},printing:{orientation:'letter face up, Z=0 on build plate',color:'Preview only. Choose the physical filament separately.',status:'not sliced; operator review required'}};}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function cardCanvas(){
  const c=mkCanvas(1200,1600),ctx=c.getContext('2d');ctx.fillStyle='#f7f2e7';ctx.fillRect(0,0,1200,1600);
  ctx.fillStyle='#bd5148';ctx.font='700 25px sans-serif';ctx.textAlign='center';ctx.fillText('SAEGIM / MADE BY ME',600,120);
  ctx.fillStyle='#48383b';ctx.font='400 70px Jua';ctx.fillText('이건, 내가 만든 거야.',600,260);
  ctx.fillStyle='#a89487';ctx.font='25px sans-serif';ctx.fillText('세상에 하나뿐인 나의 첫 번째 3D 작품',600,325);
  const face=mkCanvas(720,720);drawFace(face.getContext('2d'),720,720,530/Math.max(dims().w,dims().h),false,'#bd5148',fontById(S.font));ctx.drawImage(face,240,410);
  ctx.strokeStyle='#d6c7b3';ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(150,1190);ctx.lineTo(1050,1190);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#715e54';ctx.font='500 30px sans-serif';ctx.fillText(`${chars().join('')}  ·  ${dims().w} × ${dims().h} mm`,600,1280);
  ctx.fillStyle='#ab9685';ctx.font='22px monospace';ctx.fillText(job||'MY FIRST STAMP',600,1350);
  ctx.font='22px sans-serif';ctx.fillText('나를 새기는 작은 공방, 새김',600,1490);return c;
}
async function pngBytes(){const blob=await new Promise(resolve=>cardCanvas().toBlob(resolve,'image/png'));if(!blob)throw Error('작품 카드를 만들지 못했어요.');return new Uint8Array(await blob.arrayBuffer());}
async function exportWork(kind){
  if(!isReady()||exporting){toast('모델을 다듬고 있어요. 잠시 뒤 다시 저장해주세요.');return;}
  exporting=true;updateReadiness();const exportRevision=revision;job=job||makeJobId();
  try{
    const name=job+'_'+safeName(chars().join(''));
    const stl=kind!=='card'?toSTL(current.parts.plate.concat(current.parts.relief)):null;
    if(kind==='stl')download(new Blob([stl],{type:'model/stl'}),name+'.stl');
    else{
      const png=await pngBytes();if(exportRevision!==revision)throw Error('설정이 변경됐어요. 완성 후 다시 저장해주세요.');
      if(kind==='card')download(new Blob([png],{type:'image/png'}),name+'_작품카드.png');
      else{
        const info=metadata();const readme=['새김 — 현장 출력 접수','제작 번호: '+job,'글자: '+info.text,`크기: ${info.dimensions.w} × ${info.dimensions.h} × ${fmt(info.dimensions.height)} mm`,'글꼴: '+fontById(S.font).label,'손잡이: '+HANDLE_LABELS[S.handle],'새김: '+(S.mode==='relief'?'볼록한 글씨 (양각)':'오목한 글씨 (음각)'),'', '1. STL을 슬라이서에서 mm 단위로 엽니다. 글자 면이 위, 바닥이 Z=0입니다.','2. 여러 닫힌 메쉬가 겹치는 모델입니다. 슬라이서의 겹치는 볼륨 결합/병합을 적용하고 오류를 검사합니다.','3. 프린터와 소재에 맞는 프로필로 슬라이스하고 레이어 미리보기에서 획과 바닥의 연결을 확인합니다.','4. 손잡이 모델은 판 아래 서포트와 오버행을 확인합니다.','5. 예상 출력 시간과 수령 방법을 안내한 후 출력합니다.','6. 미리보기 색상은 STL에 저장되지 않습니다. 실제 색상은 장착한 필라멘트로 결정됩니다.','','5분은 디자인 체험 시간입니다. 출력 시간은 크기·장비·설정에 따라 달라집니다.','실제 출력 품질은 사전 테스트가 필요합니다. 작품 카드는 결과 이미지이며 실물 크기 견본이 아닙니다.','제작설정.json은 기록용이며 현재 앱에서 다시 불러오는 기능은 없습니다.'].join('\r\n');
        const zip=makeZip([{name:name+'.stl',data:stl},{name:'작품카드.png',data:png},{name:'제작설정.json',data:new TextEncoder().encode(JSON.stringify(info,null,2))},{name:'출력안내.txt',data:new TextEncoder().encode('\uFEFF'+readme)}]);download(zip,name+'.zip');
      }
    }
    toast('다운로드를 요청했어요. 브라우저 다운로드 목록을 확인해주세요.');
  }catch(e){toast(e.message||'저장 중 문제가 생겼어요. 다시 시도해주세요.');}
  finally{exporting=false;updateReadiness();}
}
function resetSession(){
  Object.assign(S,DEFAULTS);preset='soft';startedAt=null;finishedAt=null;job=null;rotating=false;
  if(rendererState){rendererState.controls.autoRotate=false;rendererState.fitKey='';}$('rotateBtn').setAttribute('aria-pressed','false');$('textIn').value=S.text;document.querySelector('.advanced').open=false;
  setView('3d');step=0;setStep(0);startedAt=null;changed({interact:false});tick();toast('새로운 작품을 시작해볼까요?');
}

buildChoices();
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>setStep(+b.dataset.step)));
$('nextBtn').addEventListener('click',()=>step===3?$('resetDialog').showModal():setStep(step+1));$('backBtn').addEventListener('click',()=>setStep(Math.max(0,step-1)));
$('restartBtn').addEventListener('click',()=>$('resetDialog').showModal());$('resetDialog').addEventListener('close',()=>{if($('resetDialog').returnValue==='reset')resetSession();});
$('operatorBtn').addEventListener('click',()=>$('operatorDialog').showModal());
$('fullscreenBtn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('전체 화면이 지원되지 않아요. 브라우저의 F11 키를 사용해주세요.');}});
function readText(){const input=$('textIn');const normalized=Array.from(input.value.normalize('NFC').replace(/\s/g,'')).slice(0,6).join('');S.text=normalized;if(input.value!==normalized)input.value=normalized;changed();}
$('textIn').addEventListener('input',e=>{if(!e.isComposing)readText();});$('textIn').addEventListener('compositionend',readText);
document.querySelectorAll('[data-word]').forEach(b=>b.addEventListener('click',()=>{$('textIn').value=b.dataset.word;readText();}));
['shape','layout','mode','handle'].forEach(key=>document.querySelectorAll(`[data-${key}]`).forEach(b=>b.addEventListener('click',()=>{S[key]=b.dataset[key];preset=null;changed();})));
for(const [id,key] of Object.entries({w:'w',h:'h',relief:'relief',hh:'handleH',border:'border',bold:'bold',base:'base'}))$(id+'In').addEventListener('input',e=>{S[key]=Number(e.target.value);changed();});
$('fillIn').addEventListener('change',e=>{S.fill=e.target.checked;changed();});
$('view3d').addEventListener('click',()=>setView('3d'));$('viewProof').addEventListener('click',()=>setView('proof'));$('stampAgain').addEventListener('click',stampAgain);
$('resetView').addEventListener('click',resetCamera);$('rotateBtn').addEventListener('click',()=>{if(!rendererState)return;rotating=!rotating;rendererState.controls.autoRotate=rotating;$('rotateBtn').setAttribute('aria-pressed',String(rotating));});
$('packageBtn').addEventListener('click',()=>exportWork('package'));$('stlBtn').addEventListener('click',()=>exportWork('stl'));$('cardBtn').addEventListener('click',()=>exportWork('card'));
init3D();changed({interact:false});
Promise.all(FONTS.map(f=>ensureFont(f,'나다움가나다'))).then(()=>{drawPresetCards();});
