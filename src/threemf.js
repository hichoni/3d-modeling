// 3MF projects (MakerWorld / Bambu Studio) → plates of printable meshes for the Studio plate.
// Reads the ZIP in the browser (DecompressionStream), resolves Bambu's split object files and component transforms,
// keeps only normal parts (modifiers, negative parts and support painting volumes are not printed here), groups
// instances by plate (Metadata/model_settings.config) and maps the project's main print settings to Studio's.
(function(root){
const dec=new TextDecoder();
function fail(message){return Error(message);}

// --- ZIP (stored + deflate, ZIP64 as Bambu Studio writes it) ---
function readZip(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw fail('3MF(ZIP) 파일이 아니거나 손상됐어요.');
 let count=view.getUint16(eocd+10,true),start=view.getUint32(eocd+16,true);const u64=o=>Number(view.getBigUint64(o,true));
 if((count===0xffff||start===0xffffffff)&&eocd>=20&&view.getUint32(eocd-20,true)===0x07064b50){const z=u64(eocd-12);if(view.getUint32(z,true)!==0x06064b50)throw fail('3MF(ZIP64) 정보를 읽지 못했어요.');count=u64(z+32);start=u64(z+48);}
 const entries=new Map();let p=start;
 for(let n=0;n<count;n++){
  if(view.getUint32(p,true)!==0x02014b50)throw fail('3MF 파일 목록을 읽지 못했어요.');
  const method=view.getUint16(p+10,true),nl=view.getUint16(p+28,true),el=view.getUint16(p+30,true),cl=view.getUint16(p+32,true);let csize=view.getUint32(p+20,true),size=view.getUint32(p+24,true),local=view.getUint32(p+42,true);
  // ZIP64 extra field (0x0001) holds whichever of size / compressed size / offset overflowed, in that order.
  for(let x=p+46+nl;x<p+46+nl+el;x+=4+view.getUint16(x+2,true))if(view.getUint16(x,true)===1){let q=x+4;if(size===0xffffffff){size=u64(q);q+=8;}if(csize===0xffffffff){csize=u64(q);q+=8;}if(local===0xffffffff)local=u64(q);}
  const name=dec.decode(bytes.subarray(p+46,p+46+nl)).replace(/^\/+/,'');entries.set(name,{method,csize,size,local});p+=46+nl+el+cl;
 }
 async function read(name){
  const e=entries.get(name.replace(/^\/+/,''));if(!e)return null;
  const off=e.local+30+view.getUint16(e.local+26,true)+view.getUint16(e.local+28,true),raw=bytes.subarray(off,off+e.csize);
  if(e.method===0)return raw;if(e.method!==8)throw fail('지원하지 않는 3MF 압축 방식이에요.');
  const out=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  if(out.length!==e.size)throw fail('3MF 안의 파일 크기가 맞지 않아요.');return out;
 }
 return {names:[...entries.keys()],has:name=>entries.has(name.replace(/^\/+/,'')),read,text:async name=>{const b=await read(name);return b&&dec.decode(b);}};
}

// --- XML helpers (regex scanning: no DOM needed, fast on large meshes) ---
const attr=(tag,key)=>{const m=new RegExp('(?:^|\\s)'+key.replace(':','\\:')+'="([^"]*)"').exec(tag);return m?m[1]:undefined;};
const unescape=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const IDENTITY=[1,0,0,0,1,0,0,0,1,0,0,0];
// 3MF transforms are "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32" (row vectors: p' = p·M).
function matrix(s){if(!s)return IDENTITY;const m=s.trim().split(/\s+/).map(Number);if(m.length!==12||!m.every(Number.isFinite))throw fail('3MF의 배치 정보가 올바르지 않아요.');return m;}
function mul(a,b){// apply a, then b
 return [a[0]*b[0]+a[1]*b[3]+a[2]*b[6],a[0]*b[1]+a[1]*b[4]+a[2]*b[7],a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
  a[3]*b[0]+a[4]*b[3]+a[5]*b[6],a[3]*b[1]+a[4]*b[4]+a[5]*b[7],a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
  a[6]*b[0]+a[7]*b[3]+a[8]*b[6],a[6]*b[1]+a[7]*b[4]+a[8]*b[7],a[6]*b[2]+a[7]*b[5]+a[8]*b[8],
  a[9]*b[0]+a[10]*b[3]+a[11]*b[6]+b[9],a[9]*b[1]+a[10]*b[4]+a[11]*b[7]+b[10],a[9]*b[2]+a[10]*b[5]+a[11]*b[8]+b[11]];}
const UNITS={micron:.001,millimeter:1,centimeter:10,inch:25.4,foot:304.8,meter:1000};

// Parse one model file into resources: id → {mesh:{vertices,triangles}} | {components:[{path,id,m}]}.
function parseModel(xml,path){
 const unit=UNITS[attr(/<model\b[^>]*>/.exec(xml)?.[0]||'','unit')||'millimeter'];if(!unit)throw fail('3MF 단위를 알 수 없어요.');
 const objects=new Map(),re=/<object\b([^>]*)>([\s\S]*?)<\/object>/g;let m;
 while((m=re.exec(xml))){
  const id=attr(m[1],'id'),body=m[2],type=attr(m[1],'type')||'model',name=attr(m[1],'name');
  if(/<mesh\b/.test(body)){
   const vs=[],tr=[];let v,painted=false;const vre=/<vertex\b([^>]*)\/?>/g,tre=/<triangle\b([^>]*)\/?>/g;
   while((v=vre.exec(body)))vs.push(+attr(v[1],'x')*unit,+attr(v[1],'y')*unit,+attr(v[1],'z')*unit);
   while((v=tre.exec(body))){tr.push(+attr(v[1],'v1'),+attr(v[1],'v2'),+attr(v[1],'v3'));if(!painted&&/paint_color=|pid=/.test(v[1]))painted=true;}
   if(!vs.every(Number.isFinite)||!tr.every(i=>Number.isInteger(i)&&i>=0&&i*3<vs.length))throw fail('3MF 메쉬 데이터가 올바르지 않아요.');
   objects.set(id,{type,name,mesh:{vertices:vs,triangles:tr},painted});
  }else{
   const comps=[];let c;const cre=/<component\b([^>]*)\/?>/g;
   while((c=cre.exec(body)))comps.push({path:(attr(c[1],'p:path')||path).replace(/^\/+/,''),id:attr(c[1],'objectid'),m:matrix(attr(c[1],'transform'))});
   objects.set(id,{type,name,components:comps});
  }
 }
 const build=[],bre=/<item\b([^>]*)\/?>/g;
 while((m=bre.exec((/<build\b[^>]*>([\s\S]*?)<\/build>/.exec(xml)||[])[1]||'')))build.push({id:attr(m[1],'objectid'),m:matrix(attr(m[1],'transform')),printable:attr(m[1],'printable')!=='0'});
 const title=unescape((/<metadata\s+name="Title"\s*>([^<]*)</.exec(xml)||[])[1]||'');
 return {objects,build,title};
}

// Bambu's model_settings.config: object parts (subtype) and plates (instances per plate).
function parseSettings(xml){
 const out={parts:new Map(),names:new Map(),extruders:new Set(),plates:[]};if(!xml)return out;let m;
 const ore=/<object\b([^>]*)>([\s\S]*?)<\/object>/g;
 while((m=ore.exec(xml))){
  const id=attr(m[1],'id'),body=m[2];const name=/<metadata\s+key="name"\s+value="([^"]*)"/.exec(body);if(name)out.names.set(id,unescape(name[1]));
  const pre=/<part\b([^>]*)>([\s\S]*?)<\/part>/g;let p;
  while((p=pre.exec(body))){out.parts.set(id+'/'+attr(p[1],'id'),attr(p[1],'subtype')||'normal_part');const e=/<metadata\s+key="extruder"\s+value="(\d+)"/.exec(p[2]);if(e)out.extruders.add(e[1]);}
  const e=/<metadata\s+key="extruder"\s+value="(\d+)"/.exec(body.replace(/<part\b[\s\S]*?<\/part>/g,''));if(e)out.extruders.add(e[1]);
 }
 const pre=/<plate\b[^>]*>([\s\S]*?)<\/plate>/g;
 while((m=pre.exec(xml))){
  const body=m[1],meta=k=>(new RegExp('<metadata\\s+key="'+k+'"\\s+value="([^"]*)"').exec(body.replace(/<model_instance\b[\s\S]*?<\/model_instance>/g,''))||[])[1];
  const instances=[],ire=/<model_instance\b[^>]*>([\s\S]*?)<\/model_instance>/g;let i;
  while((i=ire.exec(body)))instances.push({object:(/key="object_id"\s+value="([^"]*)"/.exec(i[1])||[])[1],instance:+((/key="instance_id"\s+value="([^"]*)"/.exec(i[1])||[])[1]||0)});
  out.plates.push({id:+(meta('plater_id')||out.plates.length+1),name:unescape(meta('plater_name')||''),instances,thumbnail:meta('thumbnail_file')});
 }
 return out;
}

const nearest=(value,options)=>options.reduce((a,b)=>Math.abs(b-value)<Math.abs(a-value)?b:a);
// Project print settings → Studio settings (quality/infill/walls/supports/brim); the rest stays Studio's A1 mini profile.
function mapSettings(p){
 if(!p)return {settings:{},profile:null};
 const one=v=>Array.isArray(v)?v[0]:v,num=v=>parseFloat(String(one(v)??''));
 const s={},layer=num(p.layer_height),infill=num(p.sparse_infill_density),walls=num(p.wall_loops);
 if(Number.isFinite(layer))s.quality=({0.12:'fine',0.16:'balanced',0.2:'standard'})[nearest(layer,[0.12,0.16,0.2])];
 if(Number.isFinite(infill))s.infill=nearest(infill,[0,10,15,20,30,50,100]);
 if(Number.isFinite(walls))s.walls=Math.min(5,Math.max(2,Math.round(walls)));
 if(p.enable_support!==undefined)s.supports=String(one(p.enable_support))==='1'||String(one(p.enable_support))==='true';
 if(p.brim_type!==undefined)s.brim=!['no_brim','auto_brim'].includes(String(one(p.brim_type)));
 const filaments=(Array.isArray(p.filament_type)?p.filament_type:[]).map(String);
 // Older projects name printers by their internal codes.
 const codes={N1:'A1 mini',N2S:'A1','BL-P001':'X1 Carbon','BL-P002':'X1',C11:'P1P',C12:'P1S',C13:'X1E',N6:'P2S',O1D:'H2D'},printer=String(p.printer_model||p.printer_settings_id||'').replace(/^(Bambu Lab )(\S+)$/,(m,a,c)=>codes[c]?a+codes[c]:m).slice(0,60);
 return {settings:s,profile:{printer,nozzle:String(one(p.nozzle_diameter)||''),layer:Number.isFinite(layer)?layer:null,filaments}};
}

async function parse3MF(input,{maxTriangles=Infinity}={}){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input),zip=readZip(bytes);
 const rels=await zip.text('_rels/.rels'),start=((rels&&/Target="([^"]+)"[^>]*Type="[^"]*\/3dmodel"|Type="[^"]*\/3dmodel"[^>]*Target="([^"]+)"/.exec(rels))||[]).slice(1).find(Boolean)||'3D/3dmodel.model';
 const files=new Map(),load=async path=>{path=path.replace(/^\/+/,'');if(!files.has(path)){const xml=await zip.text(path);if(xml==null)throw fail('3MF 안에서 '+path+' 파일을 찾지 못했어요.');files.set(path,parseModel(xml,path));}return files.get(path);};
 const main=await load(start),config=parseSettings(await zip.text('Metadata/model_settings.config'));
 let project=null;try{const t=await zip.text('Metadata/project_settings.config');if(t)project=JSON.parse(t);}catch{}
 const warnings=new Set();let painted=false;
 // Collect one object's printable triangles (world = part transform · item transform).
 async function triangles(path,id,m,top,out,depth=0){
  if(depth>8)throw fail('3MF 부품 구조가 너무 깊어요.');const file=await load(path),o=file.objects.get(id);if(!o)throw fail('3MF에서 부품 '+id+'을(를) 찾지 못했어요.');
  if(o.components){for(const c of o.components){const sub=config.parts.get(top+'/'+c.id);if(sub&&sub!=='normal_part'){warnings.add(sub==='modifier_part'?'수정자(modifier) 부품의 개별 설정은 빼고 출력해요.':sub==='negative_part'?'빼기(negative) 부품은 이 스튜디오에서 적용하지 못해 무시했어요.':'서포트 칠하기 부품은 무시했어요.');continue;}await triangles(c.path,c.id,mul(c.m,m),top,out,depth+1);}return;}
  if(o.type&&o.type!=='model'){if(o.type==='support')warnings.add('서포트 칠하기 부품은 무시했어요.');return;}
  if(o.painted)painted=true;
  const v=o.mesh.vertices,t=o.mesh.triangles;
  for(let i=0;i<t.length;i++){const k=t[i]*3,x=v[k],y=v[k+1],z=v[k+2];out.push(x*m[0]+y*m[3]+z*m[6]+m[9],x*m[1]+y*m[4]+z*m[7]+m[10],x*m[2]+y*m[5]+z*m[8]+m[11]);}
 }
 // Build items in order; the n-th item of an object is its instance n.
 const seen=new Map(),items=main.build.map(item=>{const n=seen.get(item.id)||0;seen.set(item.id,n+1);return {...item,instance:n};});
 const plates=(config.plates.length?config.plates:[{id:1,name:'',instances:items.map(i=>({object:i.id,instance:i.instance}))}]).map(plate=>({...plate,objects:[]}));
 let total=0;
 for(const plate of plates){
  for(const ref of plate.instances){
   const item=items.find(i=>i.id===ref.object&&i.instance===ref.instance);if(!item)continue;if(!item.printable){warnings.add('출력하지 않도록 표시된 모델은 뺐어요.');continue;}
   const out=[];await triangles(start,item.id,item.m,item.id,out);if(!out.length)continue;
   total=Math.max(total,out.length/9);
   plate.objects.push({name:(config.names.get(item.id)||main.objects.get(item.id)?.name||'model '+item.id).slice(0,60),vertices:new Float32Array(out)});
  }
  plate.triangles=plate.objects.reduce((n,o)=>n+o.vertices.length/9,0);
  if(plate.thumbnail&&zip.has(plate.thumbnail))plate.thumbnailBytes=await zip.read(plate.thumbnail);
  else if(zip.has('Metadata/plate_'+plate.id+'.png'))plate.thumbnailBytes=await zip.read('Metadata/plate_'+plate.id+'.png');
 }
 const usable=plates.filter(p=>p.objects.length);if(!usable.length)throw fail('3MF에 출력할 모델이 없어요.');
 const mapped=mapSettings(project);
 if(painted||config.extruders.size>1)warnings.add('여러 색으로 칠한 모델이에요. 이 스튜디오는 외부 스풀 한 가지 PLA로 출력해요.');
 if(mapped.profile?.filaments.some(f=>f&&!/^PLA/i.test(f)))warnings.add('프로젝트 재료가 PLA가 아니에요('+[...new Set(mapped.profile.filaments)].join(', ')+'). PLA로 출력해요.');
 if(mapped.profile?.nozzle&&mapped.profile.nozzle!=='0.4')warnings.add('프로젝트 노즐이 '+mapped.profile.nozzle+'mm예요. 0.4mm 노즐로 다시 계산해요.');
 if(Number.isFinite(maxTriangles)&&usable.every(p=>p.triangles>maxTriangles))warnings.add('삼각형이 너무 많은 모델이에요.');
 return {title:main.title,plates:usable,settings:mapped.settings,profile:mapped.profile,warnings:[...warnings],sliced:zip.names.some(n=>/^Metadata\/plate_\d+\.gcode$/.test(n))};
}

const api={readZip,parse3MF,mapSettings,matrix,mul};root.ThreeMF=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
