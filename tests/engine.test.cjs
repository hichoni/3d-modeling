const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const THREE=require('../vendor/three.min.js');
const context=vm.createContext({THREE,console,Blob,TextEncoder,Uint8Array,Uint32Array,Int32Array,Float32Array,ArrayBuffer,DataView,document:{}});
vm.runInContext(fs.readFileSync('src/state.js','utf8')+'\n'+fs.readFileSync('src/engine.js','utf8'),context);
const run=code=>vm.runInContext(code,context);

test('all text layouts keep 1–6 glyphs inside their content box',()=>{
  for(const layout of ['auto','trad','row','col'])for(let n=1;n<=6;n++){
    const cells=run(`layoutCells(${n},'${layout}',{x:0,y:0,w:100,h:80},2)`);
    assert.equal(cells.length,n);
    for(const c of cells){assert.ok(c.w>0&&c.h>0);assert.ok(c.x>=0&&c.y>=0);assert.ok(c.x+c.w<=100.00001&&c.y+c.h<=80.00001);}
  }
});
test('traditional layout starts at the right and normal layout at the left',()=>{
  const normal=run("layoutCells(3,'auto',{x:0,y:0,w:100,h:80},2)");
  const traditional=run("layoutCells(3,'trad',{x:0,y:0,w:100,h:80},2)");
  assert.ok(normal[0].x<normal[1].x);assert.ok(traditional[0].x>traditional[1].x);
});
test('nested contours retain holes and islands after triangulation',()=>{
  const result=run('loopsToShapes([[[0,0],[40,0],[40,40],[0,40]],[[5,5],[35,5],[35,35],[5,35]],[[15,15],[25,15],[25,25],[15,25]]],q=>q)');
  assert.equal(result.length,2);assert.equal(result[0].holes.length,1);assert.equal(result[1].holes.length,0);
  const geom=new THREE.ExtrudeGeometry(result,{depth:1,bevelEnabled:false});
  const stats=context.meshStats([geom]);assert.ok(Math.abs(stats.vol-800)<.01);geom.dispose();
});
test('marching squares extracts both outer border and inner hole',()=>{
  const w=20,h=20,alpha=new Float32Array(w*h);
  for(let y=2;y<18;y++)for(let x=2;x<18;x++)if(!(x>=7&&x<13&&y>=7&&y<13))alpha[y*w+x]=1;
  const contours=context.traceContours(alpha,w,h,.5);assert.equal(contours.length,2);
  const shapes=context.loopsToShapes(contours,q=>q);assert.equal(shapes.length,1);assert.equal(shapes[0].holes.length,1);
});
test('every footprint stays within requested millimetres and yields finite mesh',()=>{
  for(const shape of ['square','rounded','circle','oval','rect']){
    const s=run(`S.shape='${shape}';plateShape(24,30)`);
    const g=new THREE.ExtrudeGeometry(s,{depth:3,bevelEnabled:false});g.computeBoundingBox();
    assert.ok(Math.abs(g.boundingBox.max.x-g.boundingBox.min.x-24)<.01);
    assert.ok(Math.abs(g.boundingBox.max.y-g.boundingBox.min.y-30)<.01);
    assert.equal(g.boundingBox.min.z,0);assert.equal(g.boundingBox.max.z,3);assert.ok(context.meshStats([g]).vol>0);g.dispose();
  }
});
test('binary STL encodes triangle count, finite normals and mm vertices',()=>{
  const g=new THREE.BoxGeometry(24,30,3);g.translate(0,0,1.5);const bytes=context.toSTL([g]);
  const view=new DataView(bytes.buffer);assert.equal(view.getUint32(80,true),12);assert.equal(bytes.byteLength,684);
  for(let i=84;i<bytes.byteLength;i+=50){for(let j=0;j<12;j++)assert.ok(Number.isFinite(view.getFloat32(i+j*4,true)));const norm=Math.hypot(...[0,4,8].map(o=>view.getFloat32(i+o,true)));assert.ok(Math.abs(norm-1)<1e-5);}
  assert.ok(Math.abs(context.meshStats([g]).vol-2160)<.01);g.dispose();
});
test('ZIP uses valid CRC-32 and UTF-8 names for Korean handoff files',async()=>{
  const data=new TextEncoder().encode('123456789');assert.equal(context.crc32(data),0xcbf43926);
  const zip=context.makeZip([{name:'제작설정.json',data}]);const bytes=new Uint8Array(await zip.arrayBuffer());const dv=new DataView(bytes.buffer);
  assert.equal(dv.getUint32(0,true),0x04034b50);assert.equal(dv.getUint16(6,true),0x0800);assert.equal(dv.getUint32(14,true),0xcbf43926);
  const len=dv.getUint16(26,true);assert.equal(new TextDecoder().decode(bytes.slice(30,30+len)),'제작설정.json');
  assert.equal(dv.getUint32(bytes.length-22,true),0x06054b50);assert.equal(dv.getUint16(bytes.length-12,true),1);
});
test('unsupported glyphs and unsafe filenames are rejected or sanitized',()=>{
  for(const text of ['김하늘','MY2026','반짝'])assert.equal(context.validText(text),true);
  for(const text of ['🙂','<script>','山',''])assert.equal(context.validText(text),false);
  assert.equal(context.safeName('a/b:c*?'),'abc');
});
test('offline build includes fonts and engines without external asset requests',()=>{
  const html=fs.readFileSync('index.html','utf8');assert.ok(html.includes('data:font/ttf;base64,'));
  assert.ok(!/<script[^>]+src=/i.test(html));assert.ok(!/<link[^>]+href=["']https?:/i.test(html));
  assert.ok(!/url\(["']?https?:/i.test(html));assert.ok(html.includes('SPDX-License-Identifier: MIT'));
});
