// End-to-end check of the Chromebook app without hardware (Linux + Playwright Chromium + Xvfb):
// installs artifacts/iwa-app as a dev-mode Isolated Web App, then searches, registers, slices, uploads and
// prints to tests/helpers/mock-printer.cjs over real Direct Sockets. Test-only patches: the mock's test CA
// is trusted and 127.0.0.1 counts as the printer's Wi-Fi address. Usage: xvfb-run -a node scripts/iwa-e2e.cjs [screenshot-dir]
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),dgram=require('node:dgram'),os=require('node:os');
const {MockPrinter}=require('../tests/helpers/mock-printer.cjs'),{zipEntries}=require('../bridge/core.cjs');
const root=path.resolve(__dirname,'..'),app=path.join(root,'artifacts','iwa-app'),shots=process.argv[2]||null;
const playwright=(()=>{for(const p of ['playwright',path.join(process.execPath,'../../lib/node_modules/playwright')])try{return require(p);}catch{}throw Error('Playwright is required');})();
const testCA=fs.readFileSync(path.join(root,'tests/fixtures/direct-tls/rsa-ca.pem'),'utf8');
const patch=`;globalThis.BAMBU_CA_PEM+=${JSON.stringify(testCA)};(()=>{const o=DirectDiscovery.privateIPv4;DirectDiscovery.privateIPv4=ip=>ip==='127.0.0.1'||o(ip);})();`;
function cube(){const f=[],v=[[0,0,0],[20,0,0],[20,16,0],[0,16,0],[0,0,10],[20,0,10],[20,16,10],[0,16,10]],t=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
 const b=Buffer.alloc(84+t.length*50);b.writeUInt32LE(t.length,80);t.forEach((tri,i)=>tri.forEach((k,j)=>v[k].forEach((n,a)=>b.writeFloatLE(n,84+i*50+12+j*12+a*4))));return b;}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
(async()=>{
 const printer=await new MockPrinter({host:'127.0.0.1',mqttPort:8883,ftpsPort:990,printSeconds:8}).start();
 const ssdp=dgram.createSocket('udp4'),notify=Buffer.from('NOTIFY * HTTP/1.1\r\nHost: 239.255.255.250:1990\r\nServer: UPnP/1.0\r\nLocation: 127.0.0.1\r\nNT: urn:bambulab-com:device:3dprinter:1\r\nUSN: TESTSERIAL01\r\nCache-Control: max-age=1800\r\nDevModel.bambu.com: N1\r\nDevName.bambu.com: Test mini\r\nDevConnect.bambu.com: lan\r\nDevBind.bambu.com: free\r\nDevVersion.bambu.com: 01.07.00.00\r\n\r\n');
 const beacon=setInterval(()=>ssdp.send(notify,2021,'127.0.0.1',()=>{}),700);
 const server=http.createServer((q,r)=>{let p=decodeURIComponent(new URL(q.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';const file=path.join(app,p);if(!file.startsWith(app)||!fs.existsSync(file)){r.writeHead(404);return r.end();}
  let body=fs.readFileSync(file);if(/\/(studio|booth)\.js$/.test(p))body=Buffer.concat([body,Buffer.from(patch)]);r.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});r.end(body);}).listen(8099,'127.0.0.1');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'iwa-e2e-')),errors=[];
 const ctx=await playwright.chromium.launchPersistentContext(profile,{headless:false,viewport:{width:1366,height:820},args:['--enable-features=IsolatedWebApps,IsolatedWebAppDevMode','--install-isolated-web-app-from-url=http://127.0.0.1:8099']});
 const finish=async code=>{clearInterval(beacon);ssdp.close();server.close();await ctx.close().catch(()=>{});await printer.stop();fs.rmSync(profile,{recursive:true,force:true});process.exit(code);};
 try{
  const admin=await ctx.newPage();let id=null;for(let i=0;i<40&&!id;i++){await admin.goto('chrome://web-app-internals');await admin.waitForTimeout(500);id=(await admin.evaluate(()=>document.body.innerText)).match(/isolated-app:\/\/[a-z0-9]+/)?.[0];}
  if(!id)throw Error('IWA was not installed');console.log('installed',id);
  const cdp=await ctx.newCDPSession(admin);await cdp.send('PWA.launch',{manifestId:id+'/'});
  let page=null;for(let i=0;i<40&&!page;i++){await admin.waitForTimeout(250);page=ctx.pages().find(p=>p.url().startsWith(id));}if(!page)throw Error('IWA window did not open');
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
  if(shots)await page.screenshot({path:path.join(shots,'iwa-1-launcher.png')});
  await page.goto(id+'/studio.html#connect=1');await page.waitForSelector('#connectionDialog[open]');
  console.log('direct mode:',await page.evaluate(()=>document.documentElement.dataset.direct==='1'&&DirectRelay.enabled()));
  await page.click('#searchPrinters');await page.waitForFunction(()=>document.querySelectorAll('#discoveredPrinter option').length>1,null,{timeout:30000});
  console.log('discovered:',await page.$eval('#discoveredPrinter',s=>s.options[1].textContent));
  await page.selectOption('#discoveredPrinter','0');await page.fill('#printerCode','12345678');
  if(shots)await page.screenshot({path:path.join(shots,'iwa-2-connect.png')});
  await page.click('#savePrinterConnection');await page.waitForFunction(()=>DirectRelay.store.pairing?.printerId&&DirectRelay.telemetry(DirectRelay.store.pairing.printerId).fresh,null,{timeout:20000});
  console.log('paired and live:',await page.evaluate(()=>{const t=DirectRelay.telemetry(DirectRelay.store.pairing.printerId);return t.name+' '+t.state+' '+t.filament.external?.type;}));
  await page.evaluate(()=>{const d=document.getElementById('connectionDialog');if(d.open)d.close();});
  await page.setInputFiles('#stlFiles',{name:'cube.stl',mimeType:'model/stl',buffer:cube()});await page.waitForFunction(()=>!document.getElementById('slicePlate').disabled,null,{timeout:20000});
  await page.click('#slicePlate');await page.waitForSelector('#sliceResults:not([hidden])',{timeout:120000});console.log('sliced:',await page.textContent('#resultLayerCount'));
  await page.click('#modelView');await page.click('#preparePrint');await page.waitForSelector('#printDialog[open]',{timeout:30000});
  await page.check('#bedReady');await page.check('#attended');if(shots)await page.screenshot({path:path.join(shots,'iwa-3-review.png')});await page.click('#startStudioPrint');
  await page.waitForFunction(()=>document.getElementById('printStateLabel')?.textContent==='출력 중',null,{timeout:60000});
  await page.waitForFunction(()=>!document.getElementById('directPrinterPanel').hidden&&document.getElementById('directStage').textContent,null,{timeout:10000});
  console.log('printing panel:',await page.textContent('#directStage'));await page.$eval('#printMonitor',e=>e.scrollIntoView({block:'center'}));if(shots)await page.screenshot({path:path.join(shots,'iwa-4-printing.png')});
  await page.click('#directPause');await page.waitForFunction(()=>!document.getElementById('directResume').hidden,null,{timeout:10000});console.log('paused:',printer.state.gcode_state);
  await page.click('#directResume');await page.waitForFunction(()=>document.getElementById('printStateLabel').textContent==='출력 완료',null,{timeout:60000});
  const [name,file]=[...printer.files.entries()][0],entries=zipEntries(file),start=printer.commands.find(c=>c.print?.command==='project_file').print;
  console.log('uploaded:',name,file.length,'bytes; entries:',[...entries.keys()].filter(n=>/png|gcode$/.test(n)).join(', '));
  console.log('project_file:',JSON.stringify({url:start.url,bed_leveling:start.bed_leveling,flow_cali:start.flow_cali,use_ams:start.use_ams}));
  if(shots){await page.$eval('#printMonitor',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(shots,'iwa-5-complete.png')});fs.writeFileSync(path.join(shots,'iwa-plate-thumbnail.png'),entries.get('Metadata/plate_1.png')());}
  const booth=await ctx.newPage();booth.on('pageerror',e=>errors.push('booth: '+e.message));await booth.goto(id+'/booth.html');await booth.waitForTimeout(1500);
  console.log('booth direct:',await booth.evaluate(()=>document.documentElement.dataset.direct==='1'&&document.getElementById('boothBtn').textContent));
  const real=errors.filter(e=>!/favicon|ERR_FILE_NOT_FOUND/.test(e));console.log('page errors:',real.length?real:'none');
  if(!entries.has('Metadata/plate_1.png')||real.length)throw Error('E2E expectations failed');console.log('E2E OK');await finish(0);
 }catch(e){console.error('E2E FAILED:',e.message,errors);if(shots)await ctx.pages().at(-1)?.screenshot({path:path.join(shots,'iwa-failure.png')}).catch(()=>{});await finish(1);}
})();
