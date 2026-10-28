const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/app.js','utf8').split("try{const saved=JSON.parse(localStorage.getItem('click-design-v2'));")[0];

function fixture(){
 const elements=new Map(),timers=new Map(),frames=new Map(),calls=[],fonts=[];let sequence=0;
 function element(){return {dataset:{},children:[],attributes:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false;}},listeners:{},hidden:true,value:'',textContent:'',
  setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},append(b){this.children.push(b);},replaceChildren(){this.children=[];this.replacements=(this.replacements||0)+1;},
  querySelectorAll(){return this.children;},querySelector(){return element();},addEventListener(k,f){this.listeners[k]=f;}};}
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const c=vm.createContext({console,innerWidth:1280,innerHeight:720,addEventListener(){},matchMedia:()=>({matches:false}),
  document:{documentElement:{style:{setProperty(){}}},getElementById:get,createElement:element,querySelectorAll:()=>[],querySelector:element},$:get,
  CHARACTERS:{cat:{name:'고양이',label:'고양이'}},FRAMES:{badge:{name:'뱃지',label:'뱃지'}},FONTS:[],EDGES:{},S:{kind:'keycap',content:'text',text:'AB',font:'jua',icon:'heart',decoration:'none',tag:'',color:'#ff7b92'},validText:()=>true,throughTextIssue:()=>'',
  sessionStorage:{removeItem(){}},localStorage:{setItem(){}},workshopStats:{begin(){}},clearInterval(){},setInterval(){},
  setTimeout:f=>{const id=++sequence;timers.set(id,f);return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:f=>{const id=++sequence;frames.set(id,f);return id;},cancelAnimationFrame:id=>frames.delete(id),
  fontById:()=>({}),ensureFont:()=>new Promise(resolve=>fonts.push(resolve)),clearBrowserSlice(){},
  performance:{now:()=>0},THREE:{},bindPrintPreparation(){},bindBoothConnection(){},bindPairing(){},sliceInBrowser(){},saveBrowserPaths(){}});
 vm.runInContext(fs.readFileSync('src/design-history.js','utf8')+'\n'+fs.readFileSync('src/design-workbench.js','utf8')+'\n'+source,c);
 vm.runInContext('syncWorkbench=()=>{};activeHistory();',c);
 c.calls=calls;c.fakeElement=element;
 vm.runInContext(`characterThumb=()=>{calls.push('thumbnail');return fakeElement();};`,c);
 const run=code=>vm.runInContext(code,c);
 const frame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(f=>f());};
 const timer=async()=>{const pending=[...timers.values()];timers.clear();pending.forEach(f=>f());await Promise.resolve();await Promise.resolve();};
 const prepareBuild=()=>run(`sync=()=>calls.push('sync');showModel=()=>calls.push('model');renderSlice=()=>{};
  buildGeometries=()=>{calls.push('build:'+S.text);return {parts:{plate:[],relief:[{dispose(){}}]},totalH:2.3};};`);
 return {c,calls,fonts,get,run,frame,timer,prepareBuild,timers,frames};
}

test('picture tiles survive edits, preserve focus targets, and update the selected picture',()=>{
 const f=fixture();f.run(`S.content='icon';syncSymbols();`);
 const host=f.get('symbols'),first=host.children[0],cat=host.children.find(b=>b.dataset.symbol==='cat'),thumbnails=f.calls.length;
 f.run(`S.icon='cat';S.tag='SM';S.color='#65baff';syncSymbols();`);
 assert.equal(host.children[0],first);assert.equal(host.children.find(b=>b.dataset.symbol==='cat'),cat);
 assert.equal(cat.getAttribute('aria-pressed'),'true');assert.equal(first.getAttribute('aria-pressed'),'false');
 assert.equal(host.replacements,1);assert.equal(f.calls.length,thumbnails,'colour and text edits must not redraw all thumbnails');
 f.run(`S.content='text';syncSymbols();`);assert.equal(host.replacements,2);assert.equal(host.children.length,5);
});

test('button selection syncs before the paint boundary, then only the latest build runs',async()=>{
 const f=fixture();f.prepareBuild();f.run(`change();S.text='CD';change();`);
 assert.deepEqual(f.calls,['sync','sync']);assert.equal(f.frames.size,1);
 f.frame();await f.timer();assert.equal(f.fonts.length,1);assert.ok(!f.calls.some(v=>v.startsWith('build:')));
 f.fonts[0](true);await Promise.resolve();await Promise.resolve();
 assert.deepEqual(f.calls.filter(v=>v.startsWith('build:')),['build:CD']);assert.equal(f.run('built===revision'),true);
});

test('a stale font completion cannot replace a more recent selection',async()=>{
 const f=fixture();f.prepareBuild();f.run('change();');f.frame();await f.timer();
 f.run(`S.text='NEW';change();`);f.frame();await f.timer();
 f.fonts[1](true);await Promise.resolve();await Promise.resolve();
 f.fonts[0](true);await Promise.resolve();await Promise.resolve();
 assert.deepEqual(f.calls.filter(v=>v.startsWith('build:')),['build:NEW']);assert.equal(f.run('built===revision'),true);
});

test('typing coalesces work while a following button can request the next frame immediately',async()=>{
 const f=fixture();f.prepareBuild();f.run('change(true,{delay:100});change(true,{delay:100});');
 assert.equal(f.timers.size,1);assert.equal(f.frames.size,0);
 f.run('change();');assert.equal(f.timers.size,0);assert.equal(f.frames.size,1);
 f.frame();await f.timer();assert.equal(f.fonts.length,1);
});

test('the last keychain slot clicked while building is applied after the current model finishes',async()=>{
 const f=fixture();f.prepareBuild();f.run(`fit='case3';change();choosePairSlot(1);choosePairSlot(2);`);
 assert.equal(f.run('pendingPairSlot'),2);assert.match(f.get('busy').textContent,/오른쪽/);
 f.run('choosePairSlot=i=>calls.push("slot:"+i);');f.frame();await f.timer();f.fonts[0](true);await Promise.resolve();await Promise.resolve();
 assert.ok(f.calls.indexOf('slot:2')>f.calls.indexOf('build:AB'));assert.equal(f.run('pendingPairSlot'),null);
});

test('returning to the current slot cancels a queued switch and early preview clicks do not crash',()=>{
 const f=fixture();f.run(`fit='case3';choosePairSlot(2);choosePairSlot(0);showModel();`);
 assert.equal(f.run('pendingPairSlot'),null);
});

test('Korean composition is left alone until the input method commits the text',()=>{
 const f=fixture();f.run(`change=()=>calls.push('change');bind();`);const input=f.get('textIn');
 input.value='ㅎ';input.listeners.compositionstart();input.listeners.input({target:input,isComposing:true});assert.equal(f.c.S.text,'AB');
 input.value='한';input.listeners.compositionend({target:input});assert.equal(f.c.S.text,'한');assert.deepEqual(f.calls,['change']);
});

test('keychain slots retain the finished design even when WebGL is unavailable',()=>{
 const f=fixture();f.c.THREE.MeshStandardMaterial=class{constructor(){this.color={set(){return this;},offsetHSL(){return this;},convertSRGBToLinear(){return this;}};}dispose(){}};
 f.run(`fit='case3';current={totalH:2.3,parts:{plate:[{clone(){return {dispose(){}};}}],relief:[]}};built=revision;change=()=>{};showModel=()=>{};choosePairSlot(2);`);
 assert.equal(f.run('pairSlot'),2);assert.equal(f.run('pairSaved[0].design.text'),'AB');
 assert.equal(f.run('pairSaved[0].parts.plate[0]!==current.parts.plate[0]'),true);
});

test('undo before a pending build completes prevents it from restoring the wrong design',async()=>{
 const f=fixture();f.prepareBuild();f.run(`S.text='CD';change();`);f.frame();await f.timer();
 f.run('undoDesign();');assert.equal(f.c.S.text,'AB');f.frame();await f.timer();
 f.fonts[0](true);await Promise.resolve();await Promise.resolve();assert.equal(f.calls.filter(v=>v.startsWith('build:')).length,0);
 f.fonts[1](true);await Promise.resolve();await Promise.resolve();assert.deepEqual(f.calls.filter(v=>v.startsWith('build:')),['build:AB']);
 f.run('undoDesign(true);');assert.equal(f.c.S.text,'CD');
});

test('slot switching preserves separate undo and redo records without recording navigation',()=>{
 const f=fixture();f.c.THREE.MeshStandardMaterial=class{constructor(){this.color={set(){return this;},offsetHSL(){return this;},convertSRGBToLinear(){return this;}};}dispose(){}};
 f.run(`fit='case3';showModel=()=>{};current={totalH:2.3,parts:{plate:[],relief:[]}};built=revision;
  S.text='LEFT';recordDesignEdit();change=()=>{};choosePairSlot(2);S.text='RIGHT';recordDesignEdit();
  choosePairSlot(0);undoDesign();`);
 assert.equal(f.c.S.text,'AB');assert.equal(f.run('editHistories[0].future.length'),1);
 f.run('choosePairSlot(2);undoDesign();');assert.equal(f.c.S.text,'LEFT');
 f.run('choosePairSlot(0);undoDesign(true);');assert.equal(f.c.S.text,'LEFT');
});

test('undo cancels a queued slot request and is blocked while composing or printing',()=>{
 const f=fixture();f.run(`S.text='CD';recordDesignEdit();change=()=>{};pendingPairSlot=2;composing=true;undoDesign();`);
 assert.equal(f.c.S.text,'CD');f.run(`composing=false;job={state:'printing'};undoDesign();`);assert.equal(f.c.S.text,'CD');
 f.run('job=null;undoDesign();');assert.equal(f.c.S.text,'AB');assert.equal(f.run('pendingPairSlot'),null);
});

test('switching to fewer keyring slots moves the active history together with its plate',()=>{
 const f=fixture();f.run(`editHistories[2]=new DesignHistory({...S,text:'RIGHT'});editHistories[2].record({...S,text:'NEW'});pairSlot=2;fit='case2';fitSlots();`);
 assert.equal(f.run('pairSlot'),1);assert.equal(f.run('activeHistory().undo().text'),'RIGHT');
});

test('thumbnail rendering restores all model state even if canvas rendering fails',()=>{
 const f=fixture();f.run('let characterPart="top",lastCellMinMm=7;');const before=JSON.stringify(f.c.S);
 assert.throws(()=>f.run(`withPreviewDesign({...S,text:'THUMB',mode:'stamp'},()=>{lastCellMinMm=2;throw Error('canvas');});`),/canvas/);
 assert.equal(JSON.stringify(f.c.S),before);assert.equal(f.run('characterPart'),'top');assert.equal(f.run('lastCellMinMm'),7);
});
