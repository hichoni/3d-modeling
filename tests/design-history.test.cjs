const test=require('node:test'),assert=require('node:assert/strict');
const {DesignHistory}=require('../src/design-history.js');
const base={text:'상상',font:'jua',mode:'relief',color:'#ff7b92',kind:'keycap'};

test('undo/redo restores independent editable snapshots and drops redo after a new edit',()=>{
 const h=new DesignHistory(base),changed={...base,text:'HI'};h.record(changed);changed.text='external mutation';
 h.record({...base,text:'HI',mode:'puffy'});assert.equal(h.undo().mode,'relief');assert.equal(h.undo().text,'상상');
 assert.equal(h.redo().text,'HI');h.record({...base,text:'NEW'});assert.equal(h.redo(),null);
});
test('continuous typing is one undo, while pauses and button choices form separate edits',()=>{
 let now=0;const h=new DesignHistory(base,{now:()=>now});
 h.record({...base,text:'A'},'text');now=100;h.record({...base,text:'AB'},'text');assert.equal(h.past.length,1);
 now=1000;h.record({...base,text:'ABC'},'text');h.record({...base,text:'ABC',font:'pixel'});
 assert.equal(h.undo().font,'jua');assert.equal(h.undo().text,'AB');assert.equal(h.undo().text,'상상');
});
test('meshing-derived values and repeated selection do not add an edit or remove redo',()=>{
 const h=new DesignHistory(base);h.record({...base,base:3,mirror:true,w:20});assert.equal(h.past.length,0);
 h.record({...base,color:'#77cbb6'});h.undo();h.record({...base});assert.equal(h.redo().color,'#77cbb6');
 assert.equal('mirror' in h.present,false);
});
test('history is bounded and each slot has independent redo state',()=>{
 const a=new DesignHistory(base,{limit:3}),b=new DesignHistory(base);
 for(let i=0;i<10;i++)a.record({...base,text:String(i)});
 b.record({...base,text:'B'});assert.equal(a.past.length,3);assert.equal(a.undo().text,'8');assert.equal(b.undo().text,'상상');assert.equal(a.redo().text,'9');assert.equal(b.redo().text,'B');
});
