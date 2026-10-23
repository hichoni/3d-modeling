// Puffy (말랑) relief and two-level characters: the dome profile and the saved-design rules.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three.min.js');
const c=vm.createContext({THREE,Blob,TextEncoder,Uint8Array,Uint32Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,DataView,Math,document:{}});vm.runInContext(fs.readFileSync('src/state.js','utf8')+fs.readFileSync('src/engine.js','utf8'),c);
const run=code=>vm.runInContext(code,c);
// A 40 x 40 px square (2 mm at 20 px/mm) inside a 60 x 60 canvas.
function bar(){const W=60,H=60,a=new Float32Array(W*H);for(let y=10;y<50;y++)for(let x=10;x<50;x++)a[y*W+x]=1;return {a,W,H};}
test('distance to the outline is exact inside a bar and zero outside',()=>{
 const {a,W,H}=bar();c.a=a;const d=run(`distanceInside(a,${W},${H})`);
 assert.equal(d[0],0);assert.ok(Math.abs(d[30*W+30]-19.5)<1e-9,String(d[30*W+30]));assert.ok(Math.abs(d[10*W+30]-.5)<1e-9);assert.ok(Math.abs(d[30*W+11]-1.5)<1e-9);
});
test('puffy slabs keep a straight wall, then shrink inward as they rise to a flat top',()=>{
 const {a,W,H}=bar();c.a=a;const slabs=run(`puffSlabs(a,${W},${H},20,1.2)`);
 assert.equal(slabs.length,6);assert.deepEqual(Array.from(slabs,s=>+s.z1.toFixed(2)),[.2,.4,.6,.8,1,1.2]);
 const areas=Array.from(slabs,s=>s.alpha.reduce((n,v)=>n+(v>=.5),0));assert.equal(areas[0],1600);assert.equal(areas[1],1600,'0.4 mm wall');
 for(let i=1;i<areas.length;i++)assert.ok(areas[i]<=areas[i-1],JSON.stringify(areas));assert.ok(areas[5]>0&&areas[5]<areas[2],JSON.stringify(areas));
});
test('saved designs accept the puffy mode and the characters, nothing else',()=>{
 assert.equal(run(`restoreDesign({mode:'puffy'}).mode`),'puffy');
 for(const id of ['click','bear','cat','rabbit','chick','frog','puppy','panda','penguin','pig','ghost','whale','badge','cloud','bubble'])assert.equal(run(`restoreDesign({content:'icon',icon:'${id}'}).icon`),id);
 assert.equal(run(`restoreDesign({icon:'dragon'}).icon`),'heart');assert.equal(run(`restoreDesign({mode:'balloon'}).mode`),'relief');
 assert.equal(run('Object.values(CHARACTERS).filter(c=>!c.pixel).length'),12);assert.equal(run('Object.values(CHARACTERS).filter(c=>c.pixel).length'),7);
 assert.equal(run(`restoreDesign({tag:'SM'}).tag`),'SM');for(const bad of ['sm','ABCD','S M','김'])assert.equal(run(`restoreDesign({tag:${JSON.stringify(bad)}}).tag`),'');
});
test('initials: a frame gets them on a second level, the plain heart stays one level without them',()=>{
 const top=(id,tag)=>!!run(`pictureLevels(${JSON.stringify(id)},${JSON.stringify(tag)},FONTS[0],0).top`);
 assert.equal(top('heart',''),false);assert.equal(top('heart','SM'),true);assert.equal(top('cloud',''),false);assert.equal(top('cloud','AB'),true);assert.equal(top('badge',''),true,'badge ring');
 assert.equal(top('bear','SM'),true);assert.equal(top('star','SM'),false,'initials under a simple icon share its level');assert.equal(top('heart','toolong'),false);
});
test('borders: saved designs keep a known style; content shrinks inside it; none under-picture initials',()=>{
 assert.equal(run(`restoreDesign({edge:'dots'}).edge`),'dots');assert.equal(run(`restoreDesign({edge:'zigzag'}).edge`),'none');
 run(`Object.assign(S,DEFAULTS,{edge:'none'})`);assert.equal(run('contentScale()'),1);
 run(`S.edge='wave'`);assert.ok(Math.abs(run('contentScale()')-(7-2.4)/(7-.7))<1e-9);assert.equal(run('activeEdge()'),'wave');
 // the band's outer edge (centre 1.25 mm in, widest dot 1.3 mm) stays 0.6 mm inside the plate, clear of the keycap base ribs (0.3 mm)
 assert.ok(run('EDGE_CENTER')-1.3/2>=.6-1e-9);
 run(`Object.assign(S,{content:'icon',icon:'rabbit',tag:'SM'})`);assert.equal(run('activeEdge()'),'none');
 run(`S.icon='cloud'`);assert.equal(run('activeEdge()'),'wave');run(`Object.assign(S,DEFAULTS)`);
});
test('cut-through (뚫림): pictures only, and only borders of separate holes',()=>{
 assert.equal(run(`restoreDesign({content:'icon',mode:'through'}).mode`),'through');assert.equal(run(`restoreDesign({content:'text',mode:'through'}).mode`),'through');
 run(`Object.assign(S,DEFAULTS,{content:'icon',icon:'bear',mode:'through',edge:'line'})`);assert.equal(run('activeEdge()'),'none','a ring would cut the plate in two');
 run(`S.edge='dots'`);assert.equal(run('activeEdge()'),'dots');run(`S.edge='none'`);assert.equal(run('contentScale()'),run('THROUGH_SCALE'));
 assert.ok(run('THROUGH_T')>=2,'printer rules need at least 2 mm');run(`Object.assign(S,DEFAULTS)`);
});
test('stencil bridges: a ring hole gets two 1.2 mm bridges and the plate ends up one piece',()=>{
 const W=200,H=200,ppm=10,cut=new Uint8Array(W*H),inside=new Uint8Array(W*H).fill(1);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const r=Math.hypot(x-100,y-100);if(r>=30&&r<60)cut[y*W+x]=1;} // ring: a 28 mm² loose centre
 c.cut=cut;c.inside=inside;run(`bridgeIslands(cut,inside,${W},${H},${ppm})`);
 const mat=Uint8Array.from(inside,(v,i)=>v&&!cut[i]?1:0);c.mat=mat;c.cut=cut;
 assert.equal(run(`components(mat,${W},${H}).length`),1,'nothing loose');assert.equal(run(`components(cut,${W},${H}).length`),2,'two bridges split the ring');
 // each bridge is at least 1.2 mm (12 px) wide: walk across the ring at the bridges' angles
 let widest=0;for(let a=0;a<360;a+=.5){let run_=0,best=0;for(let t=-30;t<=30;t+=.5){const x=Math.round(100+45*Math.cos(a*Math.PI/180)+t*Math.sin(a*Math.PI/180)),y=Math.round(100+45*Math.sin(a*Math.PI/180)-t*Math.cos(a*Math.PI/180));if(!cut[y*W+x]){run_+=.5;best=Math.max(best,run_);}else run_=0;}widest=Math.max(widest,best);}
 assert.ok(widest>=11.5,'bridge width '+widest+' px');
});
test('cut-through letters: one Hangul syllable, two Latin letters, one pixel character',()=>{
 const issue=(text,font='jua')=>run(`(Object.assign(S,DEFAULTS,{text:${JSON.stringify(text)},font:'${font}',mode:'through'}),throughTextIssue())`);
 assert.equal(issue('봄'),'');assert.equal(issue('SM'),'');assert.match(issue('수민'),/한글은 1자/);assert.match(issue('ABC'),/2자까지/);assert.match(issue('AB','pixel'),/1자만/);assert.equal(issue('꿈','pixel'),'');
 run(`Object.assign(S,DEFAULTS)`);
});
