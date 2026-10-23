// Pixel theme: the own 5x7 Latin font, Galmuri11 Hangul bitmaps, and the pixel sprites.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../vendor/three.min.js');
const c=vm.createContext({THREE,Blob,TextEncoder,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,DataView,Math,atob,document:{}});
vm.runInContext(fs.readFileSync('src/state.js','utf8')+fs.readFileSync('vendor/galmuri/galmuri11-hangul.js','utf8')+fs.readFileSync('src/engine.js','utf8'),c);
const run=code=>vm.runInContext(code,c);
const bitmap=ch=>{const b=run(`pixelBits(${JSON.stringify(ch)},11)`),rows=[];for(let y=0;y<b.rows;y++){let r='';for(let x=0;x<b.cols;x++)r+=b.on(x,y)?'#':'.';rows.push(r);}return rows;};
test('the 5x7 font covers A-Z and 0-9, lowercase maps to it',()=>{
 const f=run('PIXEL_FONT');assert.equal(Object.keys(f).length,36);for(const [k,v] of Object.entries(f))assert.equal(v.length,35,k);
 assert.deepEqual(bitmap('a'),bitmap('A'));assert.deepEqual(bitmap('T'),['#####','..#..','..#..','..#..','..#..','..#..','..#..']);
});
test('Hangul comes from Galmuri11 exactly, cropped to its ink',()=>{
 assert.deepEqual(bitmap('늘'),['.#.........','.#.........','.#########.','...........','###########','...........','.#########.','.........#.','.#########.','.#.........','.#########.']);
 assert.equal(bitmap('민').length,11);assert.ok(bitmap('ㄱ').length>2,'compatibility jamo');
 assert.equal(run(`GALMURI11.ranges.reduce((n,r)=>n+r.count,0)`),11172+51);
});
test('pixel sprites: two levels, every raised block on the body, saved designs accept them',()=>{
 for(const id of ['slime','pheart','mushroom','gem','pcat','grass','sword']){assert.ok(run(`CHARACTERS.${id}.pixel`),id);assert.equal(run(`restoreDesign({content:'icon',icon:'${id}'}).icon`),id);}
 assert.equal(run(`restoreDesign({font:'pixel'}).font`),'pixel');
});
