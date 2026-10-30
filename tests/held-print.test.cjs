const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/app.js','utf8').split("try{const saved=JSON.parse(localStorage.getItem('click-design-v2'));")[0];

// "다음 사람 미리 만들기": a running print is handed to heldJob so the next visitor can design while it finishes.
function fixture(){
 const elements=new Map(),calls=[],session=new Map();
 function element(){return {dataset:{},children:[],attributes:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false;}},listeners:{},hidden:true,value:'',textContent:'',
  setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},append(b){this.children.push(b);},replaceChildren(){this.children=[];},
  querySelectorAll(){return this.children;},querySelector(){return element();},addEventListener(k,f){this.listeners[k]=f;}};}
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const c=vm.createContext({console,innerWidth:1280,innerHeight:720,addEventListener(){},matchMedia:()=>({matches:false}),
  document:{documentElement:{style:{setProperty(){}}},getElementById:get,createElement:element,querySelectorAll:()=>[],querySelector:element},$:get,
  CHARACTERS:{},FRAMES:{},FONTS:[],EDGES:{},S:{kind:'keycap',content:'text',text:'수민',font:'jua',icon:'heart',decoration:'none',tag:'',color:'#ff7b92'},validText:()=>true,throughTextIssue:()=>'',
  sessionStorage:{setItem:(k,v)=>session.set(k,v),getItem:k=>session.get(k)??null,removeItem:k=>session.delete(k)},localStorage:{setItem(){}},
  workshopStats:{begin(){},next(){},complete:job=>calls.push('complete:'+job.id)},clearInterval(){},setInterval:()=>1,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  fontById:()=>({}),ensureFont:async()=>true,clearBrowserSlice(){},performance:{now:()=>0},THREE:{},location:{origin:'https://booth.test'},boothTarget:null,
  bindPrintPreparation(){},bindBoothConnection(){},bindPairing(){},sliceInBrowser(){},saveBrowserPaths(){}});
 vm.runInContext(fs.readFileSync('src/design-history.js','utf8')+'\n'+fs.readFileSync('src/design-workbench.js','utf8')+'\n'+source,c);
 c.calls=calls;
 vm.runInContext(`syncWorkbench=()=>{};reset=()=>calls.push('reset');toast=m=>calls.push('toast');beep=()=>{};renderTicket=()=>{};
  let reply=null;api=async url=>{calls.push('GET '+url);return reply;};globalThis.setReply=r=>{reply=r;};`,c);
 return {run:code=>vm.runInContext(code,c),calls,session,get};
}

test('handing a running print to the next visitor frees the design and keeps watching the print',async()=>{
 const f=fixture();
 f.run(`job={id:'j1',state:'printing',progress:37};`);
 assert.equal(f.run('printActive()'),true);
 f.run('holdPrint()');
 assert.equal(f.run('job'),null);
 assert.equal(f.run('printActive()'),false);
 assert.equal(f.run('heldJob.id'),'j1');
 assert.equal(f.run('heldActive()'),true);
 assert.ok(f.calls.includes('reset'));
 assert.deepEqual(JSON.parse(f.session.get('click-held-job')),{id:'j1',label:'수민',backend:'https://booth.test'});
 assert.equal(f.get('heldJob').hidden,false);
 assert.match(f.get('heldJob').textContent,/「수민」 출력 중 37%/);
 f.run('dropHeld()');
 assert.equal(f.run('heldJob.id'),'j1','a running print cannot be dismissed');
});

test('the held print is counted once when it completes, then can be dismissed',async()=>{
 const f=fixture();
 f.run(`job={id:'j1',state:'printing',progress:90};holdPrint();setReply({id:'j1',state:'complete',progress:100});`);
 await f.run('pollHeld()');
 await f.run('pollHeld()');
 assert.deepEqual(f.calls.filter(c=>c.startsWith('complete:')),['complete:j1']);
 assert.equal(f.run('heldActive()'),false);
 assert.equal(f.session.has('click-held-job'),false);
 assert.equal(f.get('heldJob').dataset.state,'done');
 f.run('dropHeld()');
 assert.equal(f.run('heldJob'),null);
 assert.equal(f.get('heldJob').hidden,true);
});

test('only a running print can be handed over, and a reload resumes the held print',async()=>{
 const f=fixture();
 f.run(`job={id:'j0',state:'ready'};holdPrint();`);
 assert.equal(f.run('heldJob'),null);
 assert.equal(f.calls.includes('reset'),false);
 f.run(`setReply({id:'j2',state:'printing',progress:12});`);
 f.run(`resumeHeld({id:'j2',label:'하늘',backend:'https://booth.test'})`);
 await new Promise(r=>setImmediate(r));
 assert.equal(f.run('heldJob.id'),'j2');
 assert.match(f.get('heldJob').textContent,/「하늘」 출력 중 12%/);
});
