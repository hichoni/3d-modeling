const fs = require('node:fs');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const fonts = [
  ['Jua',400,'Jua-Regular.ttf'], ['Do Hyeon',400,'DoHyeon-Regular.ttf'],
  ['Gaegu',700,'Gaegu-Bold.ttf'], ['Nanum Myeongjo',800,'NanumMyeongjo-ExtraBold.ttf']
];
const css = fonts.map(([family,weight,file])=>`@font-face{font-family:'${family}';font-weight:${weight};font-display:block;src:url(data:font/ttf;base64,${fs.readFileSync('fonts/'+file).toString('base64')}) format('truetype');}`).join('\n') + fs.readFileSync('src/style.css','utf8');
const worker = 'const BROWSER_SLICE_WORKER='+JSON.stringify(fs.readFileSync('vendor/kiri/fdm-worker.js','utf8'))+';\n';
const js = (worker+['vendor/three.min.js','vendor/OrbitControls.js','src/state.js','src/statistics-core.js','src/engine.js','src/toolpaths.js','src/layer-view.js','src/browser-slicer.js','src/connection.js','src/print-lesson.js','src/printer-tutorial.js','src/statistics.js','src/app.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n;\n')).replace(/<\/script/gi,'<\\/script');
const licenses = fs.readFileSync('vendor/kiri/LICENSES.txt','utf8')+'\n\n'+fs.readFileSync('vendor/THREE-LICENSE.txt','utf8')+'\n\n'+fs.readdirSync('fonts').filter(f=>f.endsWith('OFL.txt')).map(f=>fs.readFileSync('fonts/'+f,'utf8')).join('\n\n');
const html = fs.readFileSync('src/index.html','utf8').replace('/* BUNDLED_CSS */',css).replace('/* BUNDLED_JS */',()=>js).replace('<!-- LICENSES -->',()=>`<!-- Bundled font licenses\n${licenses.replace(/-->/g,'')}\n-->`);
fs.writeFileSync('index.html', html.replace(/\r\n/g,'\n'));
console.log('Built offline index.html ('+(Buffer.byteLength(html)/1024/1024).toFixed(1)+' MB)');
require('./package-operator.cjs').packageOperator();
