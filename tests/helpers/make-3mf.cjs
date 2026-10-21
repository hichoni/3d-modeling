// Test-only 3MF builder: a Bambu Studio-style project (split object files, modifier part, two plates, ZIP64 option).
const zlib=require('node:zlib');
// Minimal ZIP writer (deflate); zip64:true writes the ZIP64 records Bambu Studio always emits.
function zip(files,{zip64=false}={}){
 const locals=[],central=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const raw=Buffer.from(text),data=zlib.deflateRawSync(raw),n=Buffer.from(name),crc=zlib.crc32?zlib.crc32(raw):0;
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(8,8);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(data.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(n.length,26);
  locals.push(lh,n,data);
  const extra=zip64?Buffer.alloc(28):Buffer.alloc(0);if(zip64){extra.writeUInt16LE(1,0);extra.writeUInt16LE(24,2);extra.writeBigUInt64LE(BigInt(raw.length),4);extra.writeBigUInt64LE(BigInt(data.length),12);extra.writeBigUInt64LE(BigInt(offset),20);}
  const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(45,4);ch.writeUInt16LE(45,6);ch.writeUInt16LE(8,10);ch.writeUInt32LE(crc,16);
  ch.writeUInt32LE(zip64?0xffffffff:data.length,20);ch.writeUInt32LE(zip64?0xffffffff:raw.length,24);ch.writeUInt16LE(n.length,28);ch.writeUInt16LE(extra.length,30);ch.writeUInt32LE(zip64?0xffffffff:offset,42);
  central.push(ch,n,extra);offset+=30+n.length+data.length;
 }
 const cd=Buffer.concat(central),count=Object.keys(files).length,tail=[];
 if(zip64){const z=Buffer.alloc(56);z.writeUInt32LE(0x06064b50,0);z.writeBigUInt64LE(44n,4);z.writeBigUInt64LE(BigInt(count),24);z.writeBigUInt64LE(BigInt(count),32);z.writeBigUInt64LE(BigInt(cd.length),40);z.writeBigUInt64LE(BigInt(offset),48);
  const l=Buffer.alloc(20);l.writeUInt32LE(0x07064b50,0);l.writeBigUInt64LE(BigInt(offset+cd.length),8);l.writeUInt32LE(1,16);tail.push(z,l);}
 const e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(zip64?0xffff:count,8);e.writeUInt16LE(zip64?0xffff:count,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(zip64?0xffffffff:offset,16);
 return new Uint8Array(Buffer.concat([...locals,cd,...tail,e]));
}
// Closed box mesh (12 triangles) from (0,0,0) to (s,s,h).
function box(s,h=s){const v=[[0,0,0],[s,0,0],[s,s,0],[0,s,0],[0,0,h],[s,0,h],[s,s,h],[0,s,h]],t=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
 return '<mesh><vertices>'+v.map(p=>`<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`).join('')+'</vertices><triangles>'+t.map(q=>`<triangle v1="${q[0]}" v2="${q[1]}" v3="${q[2]}"/>`).join('')+'</triangles></mesh>';}
const at=(x,y,z=0)=>`1 0 0 0 1 0 0 0 1 ${x} ${y} ${z}`;
// Bambu-style project: split object file, a modifier part, two plates, a second instance on plate 2.
function bambuProject(opts){return zip({
 '_rels/.rels':'<Relationships><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
 '3D/3dmodel.model':`<model unit="millimeter" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><metadata name="Title">Test &amp; Keychain</metadata><resources>
  <object id="2" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1" transform="${at(-5,-5)}"/><component p:path="/3D/Objects/object_1.model" objectid="2" transform="${at(-2,-2,2)}"/></components></object>
  <object id="4" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="3" transform="${at(-10,-10)}"/></components></object>
 </resources><build><item objectid="2" transform="${at(100,100)}" printable="1"/><item objectid="4" transform="${at(130,100)}" printable="1"/><item objectid="4" transform="${at(316,100)}" printable="1"/></build></model>`,
 '3D/Objects/object_1.model':`<model unit="millimeter"><resources><object id="1" type="model">${box(10)}</object><object id="2" type="model">${box(4)}</object><object id="3" type="model">${box(20,5)}</object></resources></model>`,
 'Metadata/model_settings.config':`<config><object id="2"><metadata key="name" value="Keychain"/><part id="1" subtype="normal_part"><metadata key="name" value="body"/></part><part id="2" subtype="modifier_part"><metadata key="extruder" value="2"/></part></object><object id="4"><metadata key="name" value="Base plate"/><metadata key="extruder" value="1"/><part id="3" subtype="normal_part"/></object>
  <plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value="Main"/><model_instance><metadata key="object_id" value="2"/><metadata key="instance_id" value="0"/></model_instance><model_instance><metadata key="object_id" value="4"/><metadata key="instance_id" value="0"/></model_instance></plate>
  <plate><metadata key="plater_id" value="2"/><model_instance><metadata key="object_id" value="4"/><metadata key="instance_id" value="1"/></model_instance></plate></config>`,
 'Metadata/project_settings.config':JSON.stringify({printer_model:'Bambu Lab X1 Carbon',nozzle_diameter:['0.4'],layer_height:'0.16',sparse_infill_density:'20%',wall_loops:'3',enable_support:'1',brim_type:'no_brim',filament_type:['PLA','PETG']}),
 'Metadata/plate_1.png':'png'},opts);}

module.exports={zip,box,bambuProject};
