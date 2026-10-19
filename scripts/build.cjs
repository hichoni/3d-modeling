const fs = require('node:fs');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const fonts = [
  ['Jua',400,'Jua-Regular.ttf'], ['Do Hyeon',400,'DoHyeon-Regular.ttf'],
  ['Gaegu',700,'Gaegu-Bold.ttf'], ['Nanum Myeongjo',800,'NanumMyeongjo-ExtraBold.ttf']
];
const css = fonts.map(([family,weight,file])=>`@font-face{font-family:'${family}';font-weight:${weight};font-display:block;src:url(data:font/ttf;base64,${fs.readFileSync('fonts/'+file).toString('base64')}) format('truetype');}`).join('\n') + fs.readFileSync('src/style.css','utf8');
const js = ['vendor/three.min.js','vendor/OrbitControls.js','src/state.js','src/engine.js','src/app.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n;\n').replace(/<\/script/gi,'<\\/script');
const licenses = fs.readFileSync('vendor/THREE-LICENSE.txt','utf8')+'\n\n'+fs.readdirSync('fonts').filter(f=>f.endsWith('OFL.txt')).map(f=>fs.readFileSync('fonts/'+f,'utf8')).join('\n\n');
const html = fs.readFileSync('src/index.html','utf8').replace('/* BUNDLED_CSS */',css).replace('/* BUNDLED_JS */',()=>js).replace('<!-- LICENSES -->',()=>`<!-- Bundled font licenses\n${licenses.replace(/-->/g,'')}\n-->`);
fs.writeFileSync('index.html', html);
console.log('Built offline index.html ('+(Buffer.byteLength(html)/1024/1024).toFixed(1)+' MB)');
