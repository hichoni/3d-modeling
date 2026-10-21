// A procedural A1 mini teaching model. Animation illustrates mechanics; telemetry
// comes only from the relay, and preview mode never calls the printer API.
class PrinterTutorial{
 constructor(){
  this.visible=false;this.job=null;this.telemetry=null;this.demo=false;this.cursor=-1;this.auto=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.reduced=!this.auto;this.lastAdvance=performance.now();this.phase='idle';this.key='';this.cameraAuto=true;
  document.querySelectorAll('[data-tour-part]').forEach(b=>b.onclick=()=>this.select(Number(b.dataset.tourPart)));
  $('tourPreviewBtn').onclick=()=>{this.demo=true;this.cursor=0;this.auto=!this.reduced;this.cameraAuto=true;this.lastAdvance=performance.now();this.updateCopy();};
  $('tourLiveBtn').onclick=()=>{this.demo=false;this.cursor=-1;this.cameraAuto=true;this.updateCopy();};
  $('tourPauseBtn').onclick=()=>{this.auto=!this.auto;this.cameraAuto=true;this.lastAdvance=performance.now();this.updateCopy();};
  $('tourNextBtn').onclick=()=>this.select(Math.min(4,Math.max(-1,this.cursor)+1));
  $('tourReplayBtn').onclick=()=>{this.cursor=0;this.auto=!this.reduced;this.cameraAuto=true;this.lastAdvance=performance.now();this.updateCopy();};
  try{this.build();}catch{$('tourFallback').hidden=false;}
  this.updateCopy();
 }
 select(index){this.cursor=index;this.auto=false;this.cameraAuto=true;this.lastAdvance=performance.now();this.updateCopy();}
 show(visible){this.visible=visible;if(visible){this.lastAdvance=performance.now();this.resize?.();this.updateCopy();}}
 setJob(job,telemetry){
  const started=job&&job.id!==this.startedId&&!['ready','queued','slice_wait','slicing','cancelled'].includes(job.state);
  this.job=job;this.telemetry=telemetry;this.phase=PrintLesson.phase(job,telemetry);
  if(started){this.startedId=job.id;this.demo=false;this.cursor=['complete','failed','uncertain','paused'].includes(job.state)?-1:0;this.auto=!this.reduced;this.cameraAuto=true;this.lastAdvance=performance.now();}
  if(['failed','uncertain','paused','offline'].includes(this.phase)&&!this.demo)this.cursor=-1;
  if(job?.state==='complete'&&!this.demo)this.cursor=-1;
  this.updateCopy();
 }
 updateCopy(){
  const selected=this.cursor>=0?PrintLesson.steps[this.cursor]:this.phase,lesson=PrintLesson.lessons[selected]||PrintLesson.lessons.idle;
  this.focus=lesson.focus;
  $('tourMode').textContent=this.demo?'원리 미리보기 · 전송하지 않아요':this.job&&!['ready','queued','cancelled'].includes(this.job.state)?'실제 출력과 함께 알아보기':'A1 mini · 프린터 탐험';
  $('tourMode').classList.toggle('is-demo',this.demo);
  $('tourStepNumber').textContent=this.cursor>=0?String(this.cursor+1).padStart(2,'0'):'●';
  // A stopped or unconfirmed job shows its actual reason, not only the generic lesson text.
  const reason=!this.demo&&this.cursor<0&&['failed','uncertain'].includes(this.phase)?(this.job?.attention||this.job?.error||''):'';
  $('tourTitle').textContent=lesson.title;$('tourBody').textContent=reason?lesson.body.split('.')[0]+'. '+reason:lesson.body;
  $('tourFocusLabel').textContent=lesson.name;
  $('tourPauseBtn').textContent=this.auto?'Ⅱ 설명 멈추기':'▶ 설명 이어보기';
  $('tourNextBtn').disabled=this.cursor===4;
  $('tourLiveBtn').hidden=!this.demo;$('tourPreviewBtn').hidden=!!this.job&&!['ready','queued','cancelled','complete','failed'].includes(this.job.state);
  $('tourReplayBtn').hidden=this.cursor<0&&this.phase==='idle';
  for(const b of document.querySelectorAll('[data-tour-part]')){const on=PrintLesson.steps[Number(b.dataset.tourPart)]===selected;b.setAttribute('aria-pressed',String(on));if(on)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');}
  const fresh=this.telemetry?.fresh&&!this.demo,t=this.telemetry,hasTemperature=fresh&&(typeof t.nozzleTemperature==='number'||typeof t.bedTemperature==='number');
  const example=this.demo?[{b:45,bt:65,n:24,nt:0},{b:65,bt:65,n:165,nt:220},{b:65,bt:65,n:220,nt:220},{b:65,bt:65,n:220,nt:220},{b:39,bt:0,n:48,nt:0}][Math.max(0,this.cursor)]:null;
  $('tourBedValue').textContent=PrintLesson.temperature(example?.b??(fresh?t.bedTemperature:null));$('tourBedTarget').textContent=PrintLesson.temperature(example?.bt??(fresh?t.bedTarget:null));
  $('nozzleHeatLabel').textContent=(example?.n??(fresh?t.nozzleTemperature:null))>50?'뜨거워요!':'가열 시 주의';$('tourNozzleValue').textContent=PrintLesson.temperature(example?.n??(fresh?t.nozzleTemperature:null));$('tourNozzleTarget').textContent=PrintLesson.temperature(example?.nt??(fresh?t.nozzleTarget:null));
  $('tourTelemetrySource').textContent=this.demo?'예시 온도 · 실제 기기와 무관':hasTemperature?'● 실제 프린터에서 받은 온도':'○ 실제 온도 확인 중';
  const live=PrintLesson.lessons[this.phase]||PrintLesson.lessons.idle;
  let status=live.title;
  if(fresh&&this.phase==='bed')status='베드 가열 중 · '+PrintLesson.temperature(t.bedTemperature)+' → '+PrintLesson.temperature(t.bedTarget);
  if(fresh&&this.phase==='nozzle')status='노즐 가열 중 · '+PrintLesson.temperature(t.nozzleTemperature)+' → '+PrintLesson.temperature(t.nozzleTarget)+' · 만지지 않아요';
  if(fresh&&this.phase==='printing')status=(this.job.layer||0)+' / '+(this.job.slice?.layers||'—')+'층을 쌓고 있어요';
  $('tourLiveStatus').textContent=this.demo?'설명용 3D 애니메이션 · 실제 출력은 시작하지 않아요':this.job?(this.job.attention||this.job.error||status):'작동 원리를 미리 둘러보세요';
  $('tourMotionHint').textContent=this.cameraAuto?'↔ 드래그해 돌려보기 · 부위를 누르면 가까이 보여요':'직접 둘러보는 중 · 설명 이어보기로 시점 복귀';
 }
 build(){
  const host=$('printerViewport'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.domElement.setAttribute('aria-label','A1 mini의 베드, 노즐, 필라멘트를 살펴보는 3D 설명 모형');host.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,1,3000);camera.position.set(-470,365,570);
  scene.add(new THREE.HemisphereLight(0xffffff,0x78858a,1.0));const sun=new THREE.DirectionalLight(0xfff5e6,1.15);sun.position.set(-250,600,300);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-330,right:330,top:350,bottom:-350,near:1,far:1100});sun.shadow.bias=-.001;scene.add(sun);const fill=new THREE.DirectionalLight(0xd1f6ff,.4);fill.position.set(300,200,-200);scene.add(fill);
  const model=new THREE.Group();scene.add(model);const focusMeshes={bed:[],nozzle:[],filament:[],printing:[]};
  const materials={white:0xe8e9e3,dark:0x343e42,metal:0xaeb9b8,black:0x263236,mint:0x62bba6,gold:0xc89c4b};
  const material=(color,part)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.43,metalness:color===materials.metal?.6:.05});m.color.convertSRGBToLinear();if(part)focusMeshes[part].push(m);return m;};
  const box=(w,h,d,x,y,z,color,parent=model,part)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,part));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const cylinder=(r1,r2,h,x,y,z,color,parent=model,part)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,40),material(color,part));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
  // Cantilever X arm, moving Y bed and compact base are characteristic of A1 mini.
  box(246,35,230,0,25,10,materials.white);box(224,10,214,0,7,10,materials.dark);
  for(const x of [-95,95])for(const z of [-75,95])cylinder(11,12,10,x,5,z,materials.black);
  box(43,288,45,100,175,-60,materials.white);box(14,259,7,89,180,-34,materials.metal);box(11,268,5,111,180,-34,materials.dark);
  for(const x of [-65,25])box(9,12,164,x,54,-17,materials.metal);
  const bed=new THREE.Group();bed.position.set(-20,68,-17);model.add(bed);box(190,10,190,0,0,0,materials.dark,bed,'bed');box(180,2,180,0,6,0,0x303d3c,bed,'bed');box(94,10,32,0,-7,-7,materials.black,bed);
  for(let i=-3;i<=3;i++)box(.4,.25,166,i*23,7.2,0,0x7b8785,bed);
  const bedLine=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(184,3,184)),new THREE.LineBasicMaterial({color:0xffb850,transparent:true,opacity:.8}));bedLine.position.y=8;bed.add(bedLine);
  const arm=new THREE.Group();arm.position.set(0,255,-40);model.add(arm);box(231,27,32,-1,0,0,materials.white,arm);box(220,7,6,-2,5,18,materials.metal,arm);box(220,4,3,-2,-8,18,materials.dark,arm);
  const head=new THREE.Group();head.position.set(-45,-17,23);arm.add(head);box(43,48,39,0,0,0,materials.white,head,'nozzle');box(27,25,3,0,1,21,materials.dark,head,'nozzle');cylinder(9,9,5,0,1,24,materials.black,head,'nozzle').rotation.x=Math.PI/2;box(14,10,13,0,-29,0,materials.dark,head,'nozzle');cylinder(5,1.2,9,0,-38,0,materials.gold,head,'nozzle');
  const melt=cylinder(.9,.6,5,0,-44,0,0xe6a54b,head,'nozzle');melt.material.emissive.set(0xe86a25);melt.material.emissiveIntensity=.5;
  // Filament spool behind the tower and a visible feed tube into the extruder.
  box(88,9,12,143,243,-60,materials.dark);const spool=new THREE.Group();spool.position.set(161,259,-60);spool.rotation.z=Math.PI/2;model.add(spool);
  cylinder(44,44,25,0,0,0,materials.mint,spool,'filament');for(const y of [-15,15])cylinder(49,49,4,0,y,0,materials.white,spool);cylinder(12,12,38,0,0,0,materials.dark,spool);
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(163,294,-60),new THREE.Vector3(117,353,-25),new THREE.Vector3(-28,343,10),new THREE.Vector3(-45,264,-17)]);
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,70,3,8,false),material(0xc1d5ce,'filament'));model.add(tube);const feed=[];for(let i=0;i<9;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(2.7,10,8),material(0x35876f,'filament'));model.add(dot);feed.push(dot);}
  // Front touchscreen, bed warning and discreet A1 mini nameplate.
  const screen=box(52,31,5,-68,38,129,materials.dark);screen.rotation.x=-.25;box(41,21,2,-68,39,132,0x9edbd0);box(28,3,2,-68,34,134,materials.white);
  const nameCanvas=document.createElement('canvas');nameCanvas.width=512;nameCanvas.height=96;const ctx=nameCanvas.getContext('2d');ctx.fillStyle='#e8e9e3';ctx.fillRect(0,0,512,96);ctx.fillStyle='#344644';ctx.font='bold 52px sans-serif';ctx.fillText('A1 mini',30,66);const nameTexture=new THREE.CanvasTexture(nameCanvas);const name=new THREE.Mesh(new THREE.PlaneGeometry(65,12),new THREE.MeshBasicMaterial({map:nameTexture}));name.position.set(51,28,125.2);model.add(name);
  const piece=new THREE.Group();piece.position.y=9;bed.add(piece);let partKey='';
  this.setPart=(parts,color,totalH)=>{if(partKey===parts)return;partKey=parts;while(piece.children.length){const child=piece.children[0];piece.remove(child);child.geometry.dispose();child.material.dispose();}for(const g of (parts?.plate||[]).concat(parts?.relief||[])){const geometry=g.clone();geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:color||0xff7b92,roughness:.5}));mesh.castShadow=true;piece.add(mesh);}this.partHeight=totalH||2.1;};
  const halo=new THREE.Mesh(new THREE.TorusGeometry(38,1.5,8,80),new THREE.MeshBasicMaterial({color:0xffad38,transparent:true,opacity:.9}));scene.add(halo);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.ShadowMaterial({opacity:.12}));ground.rotation.x=-Math.PI/2;ground.position.y=-1;ground.receiveShadow=true;scene.add(ground);const grid=new THREE.GridHelper(1000,25,0xcbd9d1,0xe1e8df);grid.position.y=-.5;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
  const controls=new THREE.OrbitControls(camera,renderer.domElement);controls.target.set(0,170,25);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=180;controls.maxDistance=1100;controls.maxPolarAngle=Math.PI*.49;controls.addEventListener('start',()=>{this.cameraAuto=false;this.auto=false;this.updateCopy();});
  const poses={overview:[[-490,375,650],[15,170,30]],bed:[[-350,330,500],[-5,139,-17]],nozzle:[[-250,299,385],[-45,220,-17]],filament:[[-330,402,510],[40,276,-25]],printing:[[-160,200,270],[-20,95,-17]]};
  this.resize=()=>{const b=host.getBoundingClientRect();if(!b.width||!b.height)return;renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();};new ResizeObserver(this.resize).observe(host);this.resize();
  const v=new THREE.Vector3(),target=new THREE.Vector3();let previous=performance.now(),motion=0;
  const animate=now=>{requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.1);previous=now;if(!this.visible||document.hidden)return;
   if(this.auto&&this.cursor>=0&&now-this.lastAdvance>8500){if(!this.demo&&this.cursor>=2)this.cursor=-1;else if(this.cursor<4){this.cursor++;this.lastAdvance=now;}else{if(this.demo)this.auto=false;else this.cursor=-1;}this.updateCopy();}
   const printing=this.demo&&this.cursor===3||!this.demo&&this.phase==='printing',moving=printing&&!this.reduced;if(moving)motion+=dt;
   bed.position.z=-17+(moving?Math.sin(motion*.9)*4:0);head.position.x=moving?-20+Math.sin(motion*2.7)*5:-45;
   const lowering=printing||this.demo&&this.cursor===2;arm.position.y=THREE.MathUtils.lerp(arm.position.y,lowering?138:255,this.reduced?1:Math.min(1,dt*3));melt.visible=printing;
   tube.visible=true;feed.forEach((dot,i)=>dot.position.copy(curve.getPoint((i/9+(moving?motion*.15:0))%1)));
   // The tube end follows the toolhead, including its vertical travel.
   const end=curve.points[3];end.set(head.position.x,arm.position.y+14,-17);if(now-(this.tubeAt||0)>100&&(Math.abs(end.y-(this.tubeY||0))>.4||moving)){tube.geometry.dispose();tube.geometry=new THREE.TubeGeometry(curve,70,3,8,false);this.tubeY=end.y;this.tubeAt=now;}
   const ratio=this.demo?this.cursor===3?.6:this.cursor===4?1:0:this.job?.state==='complete'?1:this.phase==='printing'?Math.max(.04,Math.min(1,Number(this.job.layer)/(this.job.slice?.layers||1))):0;piece.visible=ratio>0;piece.scale.y=ratio;
   const focus=this.focus||'overview',fp=focus==='bed'?bed.localToWorld(v.set(0,10,0)):focus==='nozzle'?head.localToWorld(v.set(0,-37,0)):focus==='filament'?v.set(75,326,-5):focus==='printing'?bed.localToWorld(v.set(0,15,0)):v.set(0,170,20);
   halo.visible=focus!=='overview';halo.position.copy(fp);halo.rotation.x=focus==='bed'||focus==='printing'?Math.PI/2:0;halo.scale.setScalar(focus==='bed'?2.35:focus==='filament'?1.2:focus==='printing'?.6:.45);
   halo.material.opacity=this.reduced?.8:.65+Math.sin(now*.003)*.2;
   for(const [part,mats]of Object.entries(focusMeshes))for(const mat of mats){mat.emissive.setHex(part===focus||part==='nozzle'&&focus==='printing'?0xc16a13:0);mat.emissiveIntensity=part===focus?.12:0;}
   if(this.cameraAuto){const pose=poses[focus]||poses.overview,alpha=this.reduced?1:Math.min(1,dt*2.2);camera.position.lerp(target.fromArray(pose[0]),alpha);controls.target.lerp(target.fromArray(pose[1]),alpha);}
   controls.update();renderer.render(scene,camera);
   const projected=fp.clone().project(camera);const label=$('tourFocusLabel');label.style.left=Math.max(12,Math.min(host.clientWidth-110,(projected.x+1)*host.clientWidth/2+22))+'px';label.style.top=Math.max(58,Math.min(host.clientHeight-40,(-projected.y+1)*host.clientHeight/2-15))+'px';label.hidden=focus==='overview';
  };requestAnimationFrame(animate);
 }
}
