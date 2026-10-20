const zlib=require('node:zlib');
const table=Array.from({length:256},(_,c)=>{for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function zip(files){const local=[],central=[];let offset=0;
 for(const [name,value]of Object.entries(files)){const n=Buffer.from(name),b=Buffer.isBuffer(value)?value:Buffer.from(value),c=zlib.deflateRawSync(b);let crc=0xffffffff;for(const v of b)crc=table[(crc^v)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(c.length,18);h.writeUInt32LE(b.length,22);h.writeUInt16LE(n.length,26);local.push(h,n,c);
  const d=Buffer.alloc(46);d.writeUInt32LE(0x02014b50);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt16LE(0x800,8);d.writeUInt16LE(8,10);d.writeUInt16LE(33,14);d.writeUInt32LE(crc,16);d.writeUInt32LE(c.length,20);d.writeUInt32LE(b.length,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(offset,42);central.push(d,n);offset+=h.length+n.length+c.length;
 }const e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(central.length/2,8);e.writeUInt16LE(central.length/2,10);e.writeUInt32LE(central.reduce((n,b)=>n+b.length,0),12);e.writeUInt32LE(offset,16);return Buffer.concat([...local,...central,e]);
}
module.exports={zip};
