const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
// The packed keycaps and keychain cases in src/keycap-models.js must match their STLs; each plate must rest on a flat
// pocket floor, and in a case the keycap must sit clear above the rim, keys at the keyboard pitch.
const c={};new Function('globalThis',fs.readFileSync('src/keycap-models.js','utf8'))(c);
const decode=m=>{const b=Buffer.from(m.data,'base64');return {pos:new Int16Array(b.buffer.slice(b.byteOffset,b.byteOffset+m.vertices*6)),index:new Uint16Array(b.buffer.slice(b.byteOffset+m.vertices*6,b.byteOffset+b.length))};};
const bounds=pos=>{const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<pos.length;i++){lo[i%3]=Math.min(lo[i%3],pos[i]/1000);hi[i%3]=Math.max(hi[i%3],pos[i]/1000);}return {lo,hi};};
for(const [kind,m] of Object.entries(c.KEYCAP_MODELS).filter(([,m])=>m.seat))test(kind+' keychain case matches '+m.source,()=>{
 const {pos,index}=decode(m),{lo,hi}=bounds(pos);assert.equal(index.length,fs.readFileSync(m.source).readUInt32LE(80)*3);
 assert.equal(+hi[2].toFixed(2),12.1);assert.ok(m.seat-hi[2]>5&&m.seat-hi[2]-4>1,'keycap clears the rim even fully pressed');
 assert.equal(m.keys.length,kind==='case2'?2:1);if(m.keys.length===2)assert.equal(+(m.keys[1]-m.keys[0]).toFixed(2),19.05);
 assert.ok(m.keys.every(x=>x-9>=lo[0]-3&&x+9<=hi[0]+.1),'keycaps over the case');
});
for(const [kind,m] of Object.entries(c.KEYCAP_MODELS).filter(([,m])=>m.floor))test(kind+' keycap matches '+m.source,()=>{
 const b=Buffer.from(m.data,'base64'),pos=new Int16Array(b.buffer,b.byteOffset,m.vertices*3),index=new Uint16Array(b.buffer.slice(b.byteOffset+m.vertices*6,b.byteOffset+b.length));
 const stl=fs.readFileSync(m.source);assert.equal(index.length,stl.readUInt32LE(80)*3);
 const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<pos.length;i++){lo[i%3]=Math.min(lo[i%3],pos[i]/1000);hi[i%3]=Math.max(hi[i%3],pos[i]/1000);}
 const size=kind==='stamp20'?23:18;assert.deepEqual(lo.slice(0,2).map(v=>+v.toFixed(2)),[-size/2,-size/2]);assert.equal(+lo[2].toFixed(2),0);
 let floor=0;for(let t=0;t<index.length;t+=3){const z=[0,1,2].map(k=>pos[index[t+k]*3+2]/1000),x=pos[index[t]*3]/1000,y=pos[index[t]*3+1]/1000;if(z.every(v=>Math.abs(v-m.floor)<.001)&&Math.abs(x)<5&&Math.abs(y)<5)floor++;}
 assert.ok(floor>0,'no flat pocket floor at '+m.floor);assert.ok(hi[2]-m.floor>2.5&&hi[2]-m.floor<3.1,'pocket depth');
});
