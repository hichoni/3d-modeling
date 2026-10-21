const fs = require('node:fs');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const fonts = [
  ['Jua',400,'Jua-Regular.ttf'], ['Do Hyeon',400,'DoHyeon-Regular.ttf'],
  ['Gaegu',700,'Gaegu-Bold.ttf'], ['Nanum Myeongjo',800,'NanumMyeongjo-ExtraBold.ttf']
];
const css = fonts.map(([family,weight,file])=>`@font-face{font-family:'${family}';font-weight:${weight};font-display:block;src:url(data:font/ttf;base64,${fs.readFileSync('fonts/'+file).toString('base64')}) format('truetype');}`).join('\n') + fs.readFileSync('src/style.css','utf8');
// Chromebook direct connection: inactive on the open web (no Direct Sockets), live in the installed app.
const directConstants='globalThis.BAMBU_CA_PEM='+JSON.stringify(fs.readFileSync('bridge/bambu-ca.pem','utf8'))+';globalThis.A1_MINI_MACHINE='+JSON.stringify(JSON.parse(fs.readFileSync('bridge/profiles/a1-mini-pla.json','utf8')))+';\n';
const direct=['src/statistics-core.js','src/print-job.js','src/direct/sockets.js','src/direct/tls.js','src/direct/printer-link.js','src/direct/discovery.js','src/direct/relay.js','src/direct/direct-ui.js'];
const boothScripts=['vendor/three.min.js','vendor/OrbitControls.js','src/state.js','src/statistics-core.js','src/engine.js','src/toolpaths.js','src/layer-view.js','src/print-profiles.js','src/print-preparation.js','src/browser-slicer.js',...direct.slice(1),'src/connection.js','src/print-lesson.js','src/printer-tutorial.js','src/statistics.js','src/app.js'];
const studioScripts=['vendor/three.min.js','vendor/OrbitControls.js','src/print-profiles.js','src/studio-core.js','src/toolpaths.js',...direct,'src/studio-api.js','src/studio-view.js','src/studio-app.js'];
const concat=list=>directConstants+list.map(f=>fs.readFileSync(f,'utf8')).join('\n;\n');
const worker = 'const BROWSER_SLICE_WORKER='+JSON.stringify(fs.readFileSync('vendor/kiri/fdm-worker.js','utf8'))+';\n';
const js = (worker+concat(boothScripts)).replace(/<\/script/gi,'<\\/script');
const licenses = fs.readFileSync('vendor/kiri/LICENSES.txt','utf8')+'\n\n'+fs.readFileSync('vendor/THREE-LICENSE.txt','utf8')+'\n\n'+fs.readdirSync('fonts').filter(f=>f.endsWith('OFL.txt')).map(f=>fs.readFileSync('fonts/'+f,'utf8')).join('\n\n');
const html = fs.readFileSync('src/index.html','utf8').replace('/* BUNDLED_CSS */',css).replace('/* BUNDLED_JS */',()=>js).replace('<!-- LICENSES -->',()=>`<!-- Bundled font licenses\n${licenses.replace(/-->/g,'')}\n-->`);
fs.writeFileSync('index.html', html.replace(/\r\n/g,'\n'));
console.log('Built offline index.html ('+(Buffer.byteLength(html)/1024/1024).toFixed(1)+' MB)');
const studioJS=(worker+concat(studioScripts)).replace(/<\/script/gi,'<\\/script');
const studio=fs.readFileSync('src/studio.html','utf8').replace('/* STUDIO_CSS */',fs.readFileSync('src/studio.css','utf8')).replace('/* STUDIO_JS */',()=>studioJS).replace('<!-- STUDIO_LICENSES -->',()=>`<!-- Bundled third-party licenses\n${licenses.replace(/-->/g,'')}\n-->`);
fs.writeFileSync('studio.html',studio.replace(/\r\n/g,'\n'));console.log('Built offline studio.html ('+(Buffer.byteLength(studio)/1024/1024).toFixed(1)+' MB)');
const setup=fs.readFileSync('src/setup.html','utf8').replace('/* SETUP_CSS */',fs.readFileSync('src/setup.css','utf8')).replace('/* SETUP_JS */',()=>fs.readFileSync('src/setup.js','utf8').replace(/<\/script/gi,'<\\/script'));
fs.writeFileSync('setup.html',setup.replace(/\r\n/g,'\n'));console.log('Built offline setup.html ('+(Buffer.byteLength(setup)/1024).toFixed(0)+' KB)');
require('./package-operator.cjs').packageOperator();
require('./build-iwa-app.cjs').buildApp({fonts,licenses,boothJS:concat(boothScripts),studioJS:concat(studioScripts)});
