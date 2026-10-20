const fs=require('node:fs'),path=require('node:path');
module.exports=function licenses(root,meta){
 const read=file=>fs.readFileSync(path.join(root,file),'utf8');
 const parts=['Kiri:Moto / GridSpace grid-apps 4.7.0\nPinned revision: d138275bbe9d4e4030d8cb8b2dcf66607da9295a\nhttps://github.com/GridSpace/grid-apps\n\n'+read('artifacts/grid-apps/license.md')],roots=new Set();
 for(const file of Object.keys(meta.inputs)){const match=/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(file.replace(/\\/g,'/'));if(match)roots.add(match[1]);}
 for(const dir of [...roots].sort()){const pkg=JSON.parse(read(dir+'/package.json'));for(const name of fs.readdirSync(path.join(root,dir)).filter(n=>/^licen[cs]e|^copying|^notice/i.test(n)&&fs.statSync(path.join(root,dir,n)).isFile()))parts.push('\n\n===== '+pkg.name+' '+pkg.version+' / '+name+' =====\n'+read(dir+'/'+name));}
 for(const [file,end]of [['clip2.js',133],['jspoly.js',95]])parts.push('\n\n===== upstream '+file+' notices =====\n'+read('artifacts/grid-apps/src/ext/'+file).split('\n').slice(0,end).join('\n'));
 parts.push('\n\n===== QuickJS embedded engine =====\n'+read('vendor/kiri/QUICKJS-LICENSE.txt'));
 parts.push('\n\n===== esbuild preserved notices =====\n'+read('vendor/kiri/fdm-worker.js.LEGAL.txt'));
 fs.writeFileSync(path.join(root,'vendor/kiri/LICENSES.txt'),parts.join('\n').replace(/[ \t]+$/gm,'')+'\n');
};
