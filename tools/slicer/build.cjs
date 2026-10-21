// Rebuild the self-hosted FDM-only worker from reviewed, pinned upstream sources.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),deps=fs.existsSync(path.join(__dirname,'node_modules'))?path.join(__dirname,'node_modules'):path.join(root,'artifacts/slicer-build-tools/node_modules');
const revision='d138275bbe9d4e4030d8cb8b2dcf66607da9295a';
if(cp.execFileSync('git',['-C',path.join(root,'artifacts/grid-apps'),'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim()!==revision)throw Error('Pinned upstream revision required');
if(cp.execFileSync('git',['-C',path.join(root,'artifacts/grid-apps'),'status','--porcelain','--untracked-files=no'],{encoding:'utf8',windowsHide:true}).trim())throw Error('Unmodified upstream sources required');
const esbuild=require(path.join(deps,'esbuild'));
const adapters={
 'three.js':[
  "import * as T from 'three';",
  "import * as SVGLoader from 'three/addons/loaders/SVGLoader.js';",
  "import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';",
  "import {Line2} from 'three/addons/lines/Line2.js';",
  "import {LineMaterial} from 'three/addons/lines/LineMaterial.js';",
  "import {LineGeometry} from 'three/addons/lines/LineGeometry.js';",
  "import {LineSegments2} from 'three/addons/lines/LineSegments2.js';",
  "import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';",
  "import {TrackballControls} from 'three/addons/controls/TrackballControls.js';",
  "import * as MeshBVHLib from 'three-mesh-bvh';",
  'const THREE={...T};',
  'export {THREE,SVGLoader,BufferGeometryUtils,Line2,LineMaterial,LineGeometry,LineSegments2,LineSegmentsGeometry,TrackballControls,MeshBVHLib};'
 ].join('\n'),
 'jszip-esm.js':"import JSZip from 'jszip';export {JSZip};export default JSZip;",
 'quickjs.js':"export {getQuickJS} from 'quickjs-emscripten';"
};
const plugin={name:'static-browser-adapters',setup(b){
 b.onResolve({filter:/ext\/earcut\.js$/},()=>({path:path.join(deps,'earcut/src/earcut.js')}));
 b.onResolve({filter:/gpu\/raster\.js$/},()=>({path:path.join(deps,'@gridspace/raster-path/build/raster-path.js')}));
 b.onResolve({filter:/ext\/tween\.js$/},()=>({path:path.join(deps,'@tweenjs/tween.js/src/Tween.js')}));
 b.onResolve({filter:/ext\/(three|jszip-esm|quickjs)\.js$/},a=>({path:path.basename(a.path),namespace:'adapter'}));
 b.onLoad({filter:/.*/,namespace:'adapter'},a=>({loader:'js',resolveDir:deps,contents:adapters[a.path]}));
 b.onResolve({filter:/^(fs|path|crypto|module|node:module)$/},a=>({path:a.path,namespace:'empty'}));
 b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'export default {};'}));
 b.onLoad({filter:/kiri[\\/]run[\\/]worker\.js$/},a=>{
  let s=fs.readFileSync(a.path,'utf8');
  s=s.replace(/^import \{ (CAM|DRAG|LASER|SLA|WEDM|WJET) \}[^\n]*\n/gm,'');
  s=s.replace(/let drivers = \{[\s\S]*?\},\s*ccvalue =/, 'let drivers = {FDM}, ccvalue =');
  // The upstream pool defaults to at least four workers even when threading is
  // disabled. Complex changing layers then queue boolean operations forever.
  // This distribution intentionally runs a single self-contained Blob Worker.
  const pool='concurrent = Math.round(Math.max(4, self.Worker && ccvalue > 3 ? ccvalue * 0.75 : 0)),';
  if(!s.includes(pool))throw Error('Pinned worker pool initializer changed');
  s=s.replace(pool,'concurrent = 0,');
  return {contents:s,loader:'js',resolveDir:path.dirname(a.path)};
 });
}};
(async()=>{
 process.chdir(root);fs.mkdirSync('vendor/kiri',{recursive:true});
 const result=await esbuild.build({entryPoints:['src/browser-slice-worker.js'],outfile:'vendor/kiri/fdm-worker.js',bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,nodePaths:[deps],plugins:[plugin],
  external:['./constants','./voronoi_structures','./voronoi_ctypes','../thirdparty/jsbn','./collections','./voronoi_predicates','./voronoi_builder','./point_data','./segment_data','./cppgen','./voronoi_diagram','./voronoi'],
  define:{'process.env.NODE_ENV':'"production"','process.env.QTS_DEBUG':'false'},legalComments:'external',logLevel:'error',metafile:true});
 fs.writeFileSync('artifacts/kiri-bundle-meta.json',JSON.stringify(result.metafile,null,2));
 const notice='vendor/kiri/fdm-worker.js.LEGAL.txt';fs.writeFileSync(notice,fs.readFileSync(notice,'utf8').replace(/[ \t]+$/gm,''));
 require('./licenses.cjs')(root,result.metafile);
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 fs.writeFileSync('vendor/kiri/build-info.json',JSON.stringify({upstream:'https://github.com/GridSpace/grid-apps',revision,version:'4.7.0',workerSha256:hash('vendor/kiri/fdm-worker.js'),entrySha256:hash('src/browser-slice-worker.js'),profilesSha256:hash('src/print-profiles.js'),studioCoreSha256:hash('src/studio-core.js'),builderSha256:hash('tools/slicer/build.cjs')},null,2)+'\n');
 console.log('Built FDM worker ('+(fs.statSync('vendor/kiri/fdm-worker.js').size/1024/1024).toFixed(2)+' MB)');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
