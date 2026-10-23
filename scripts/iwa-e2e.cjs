// End-to-end check of the Chromebook app without hardware (Linux + Playwright Chromium + Xvfb):
// installs artifacts/iwa-app as a dev-mode Isolated Web App, then searches, registers, slices, uploads and
// prints to tests/helpers/mock-printer.cjs over real Direct Sockets. Test-only patches: the mock's test CA
// is trusted and 127.0.0.1 counts as the printer's Wi-Fi address. Usage: xvfb-run -a node scripts/iwa-e2e.cjs [--shell] [screenshot-dir]
// --shell runs the auto-updating path: the app's shell loads the public pages from a local HTTPS "website" in a frame.
const http=require('node:http'),net=require('node:net'),https=require('node:https'),fs=require('node:fs'),path=require('node:path'),dgram=require('node:dgram'),os=require('node:os');
const {MockPrinter}=require('../tests/helpers/mock-printer.cjs'),{zipEntries}=require('../bridge/core.cjs');
const root=path.resolve(__dirname,'..'),app=path.join(root,'artifacts','iwa-app'),shellMode=process.argv.includes('--shell')||process.argv.includes('--android'),androidMode=process.argv.includes('--android'),shots=process.argv.slice(2).find(a=>!a.startsWith('--'))||null;
const playwright=(()=>{for(const p of ['playwright',path.join(process.execPath,'../../lib/node_modules/playwright')])try{return require(p);}catch{}throw Error('Playwright is required');})();
const testCA=fs.readFileSync(path.join(root,'tests/fixtures/direct-tls/rsa-ca.pem'),'utf8');
const patch=`;globalThis.BAMBU_CA_PEM+=${JSON.stringify(testCA)};(()=>{const o=DirectDiscovery.privateIPv4;DirectDiscovery.privateIPv4=ip=>ip==='127.0.0.1'||o(ip);})();`;
function cube(){const f=[],v=[[0,0,0],[20,0,0],[20,16,0],[0,16,0],[0,0,10],[20,0,10],[20,16,10],[0,16,10]],t=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
 const b=Buffer.alloc(84+t.length*50);b.writeUInt32LE(t.length,80);t.forEach((tri,i)=>tri.forEach((k,j)=>v[k].forEach((n,a)=>b.writeFloatLE(n,84+i*50+12+j*12+a*4))));return b;}
const pagePatch=`<script>${patch.slice(1)}</script>`;let appId='';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
(async()=>{
 const printer=await new MockPrinter({host:'127.0.0.1',mqttPort:8883,ftpsPort:990,printSeconds:8,dataRate:Number(process.env.MOCK_DATA_RATE)||0}).start();
 const ssdp=dgram.createSocket('udp4'),notify=Buffer.from('NOTIFY * HTTP/1.1\r\nHost: 239.255.255.250:1990\r\nServer: UPnP/1.0\r\nLocation: 127.0.0.1\r\nNT: urn:bambulab-com:device:3dprinter:1\r\nUSN: TESTSERIAL01\r\nCache-Control: max-age=1800\r\nDevModel.bambu.com: N1\r\nDevName.bambu.com: Test mini\r\nDevConnect.bambu.com: lan\r\nDevBind.bambu.com: free\r\nDevVersion.bambu.com: 01.07.00.00\r\n\r\n');
 const beacon=setInterval(()=>ssdp.send(notify,2021,'127.0.0.1',()=>{}),700);
 const server=http.createServer((q,r)=>{let p=decodeURIComponent(new URL(q.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';const file=path.join(app,p);if(!file.startsWith(app)||!fs.existsSync(file)){r.writeHead(404);return r.end();}
  let body=fs.readFileSync(file);if(/\/(studio|booth)\.js$/.test(p))body=Buffer.concat([body,Buffer.from(patch)]);if(p==='/shell.js')body=Buffer.from(body.toString().replace(/REMOTE="[^"]*"/,'REMOTE="https://127.0.0.1:8443/"').replace('ALLOW_LOOPBACK=false','ALLOW_LOOPBACK=true'));r.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});r.end(body);}).listen(8099,'127.0.0.1');
 // The "website" for --shell: the built public pages over HTTPS, trusting the installed test app's origin.
 const website=https.createServer({key:fs.readFileSync(path.join(root,'tests/fixtures/direct-tls/rsa-device.key.pem')),cert:fs.readFileSync(path.join(root,'tests/fixtures/direct-tls/rsa-device.pem'))},(q,r)=>{const p=new URL(q.url,'https://x').pathname;if(p==='/favicon.ico'){r.writeHead(204);return r.end();}
  // the tablet app checks the published APK version (downloads/ is served by the real site)
  if(p==='/downloads/click-studio-android.json'){r.writeHead(200,{'Content-Type':'application/json'});return r.end(fs.readFileSync(path.join(root,'downloads/click-studio-android.json')));}const name={'/':'index.html','/index.html':'index.html','/studio.html':'studio.html'}[p];if(!name){r.writeHead(404);return r.end();}
  const html=fs.readFileSync(path.join(root,name),'utf8').replace(/globalThis\.CLICK_SHELL_ORIGINS=\[[^\]]*\]/,()=>'globalThis.CLICK_SHELL_ORIGINS='+JSON.stringify([appId])).replace('</body>',()=>pagePatch+'</body>');r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(html);}).listen(8443,'127.0.0.1');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'iwa-e2e-')),errors=[],consoleLog=[];
 const ctx=await playwright.chromium.launchPersistentContext(profile,{headless:false,ignoreHTTPSErrors:true,viewport:{width:1366,height:820},args:androidMode?['--ignore-certificate-errors']:['--enable-features=IsolatedWebApps,IsolatedWebAppDevMode','--install-isolated-web-app-from-url=http://127.0.0.1:8099','--ignore-certificate-errors']});
 // --android: a plain browser page plus the Android app's native socket bridge, emulated in Node.
 const natives=new Map();
 if(androidMode){const {createNative}=require('../tests/helpers/fake-android-native.cjs');
  await ctx.exposeBinding('__clickNativeSend',({page},text)=>{let n=natives.get(page);if(!n){n=createNative(j=>page.evaluate(x=>window.__clickNativeDeliver?.(x),j).catch(()=>{}),{allowLoopback:true});natives.set(page,n);}n.handle(text);});
  await ctx.addInitScript(()=>{if(location.protocol!=='https:')return;const ls=[];window.__clickNativeDeliver=s=>{for(const f of ls)f({data:s});};window.ClickNative={postMessage:s=>{window.__clickNativeSend(s);},addEventListener:(t,f)=>{if(t==='message')ls.push(f);}};});}
 const finish=async code=>{clearInterval(beacon);ssdp.close();server.close();website.close();await ctx.close().catch(()=>{});await printer.stop();fs.rmSync(profile,{recursive:true,force:true});process.exit(code);};
 try{
  let page=null,id=null;
  if(androidMode){page=await ctx.newPage();appId='https://127.0.0.1:8443';console.log('android bridge mode');}
  else{
  const admin=await ctx.newPage();for(let i=0;i<40&&!id;i++){await admin.goto('chrome://web-app-internals');await admin.waitForTimeout(500);id=(await admin.evaluate(()=>document.body.innerText)).match(/isolated-app:\/\/[a-z0-9]+/)?.[0];}
  if(!id)throw Error('IWA was not installed');console.log('installed',id,shellMode?'(shell mode)':'');appId=id;
  const cdp=await ctx.newCDPSession(admin);await cdp.send('PWA.launch',{manifestId:id+'/'});
  for(let i=0;i<40&&!page;i++){await admin.waitForTimeout(250);page=ctx.pages().find(p=>p.url().startsWith(id));}if(!page)throw Error('IWA window did not open');
  }
  page.on('response',r=>{if(r.status()===404)consoleLog.push('404: '+r.url());});page.on('console',m=>{consoleLog.push(m.type()+': '+m.text());if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
  if(shots)await page.screenshot({path:path.join(shots,'iwa-1-launcher.png')});
  const open=async (target,pageName)=>{if(androidMode){await target.goto('https://127.0.0.1:8443/'+(pageName==='booth'?'index.html':'studio.html#connect=1'));await target.waitForFunction(()=>window.ClickAndroid?.version,null,{timeout:15000});console.log('android page:',target.url().split('#')[0],'native',await target.evaluate(()=>ClickAndroid.version));return target;}
   if(!shellMode){await target.goto(id+(pageName==='booth'?'/booth.html':'/studio.html#connect=1'));return target;}
   await target.goto(id+'/open.html?page='+pageName+(pageName==='studio'?'#connect=1':''));let f=null;for(let i=0;i<80&&!f;i++){await target.waitForTimeout(250);f=target.frames().find(x=>x.url().startsWith('https://127.0.0.1:8443/'));}
   if(!f)throw Error('shell did not show the website');await f.waitForFunction(()=>window.ClickShell?.version,null,{timeout:15000});console.log('shell frame:',f.url().split('?')[0],'shell',await f.evaluate(()=>ClickShell.version));return f;};
  let ui=await open(page,'studio');await ui.waitForSelector('#connectionDialog[open]');
  console.log('direct mode:',await ui.evaluate(()=>document.documentElement.dataset.direct==='1'&&DirectRelay.enabled()));
  await ui.click('#searchPrinters');await ui.waitForFunction(()=>document.querySelectorAll('#discoveredPrinter option').length>1,null,{timeout:30000});
  console.log('discovered:',await ui.$eval('#discoveredPrinter',s=>s.options[1].textContent));
  await ui.selectOption('#discoveredPrinter','0');await ui.fill('#printerCode','12345678');
  if(shots)await page.screenshot({path:path.join(shots,'iwa-2-connect.png')});
  await ui.click('#savePrinterConnection');await ui.waitForFunction(()=>DirectRelay.store.pairing?.printerId&&DirectRelay.telemetry(DirectRelay.store.pairing.printerId).fresh,null,{timeout:20000});
  console.log('paired and live:',await ui.evaluate(()=>{const t=DirectRelay.telemetry(DirectRelay.store.pairing.printerId);return t.name+' '+t.state+' '+t.filament.external?.type;}));
  if(shellMode){ui=await open(page,'studio');await ui.waitForFunction(()=>DirectRelay.store.pairing?.printerId&&DirectRelay.telemetry(DirectRelay.store.pairing.printerId).fresh,null,{timeout:30000});console.log('after relaunch: printer and code kept by the shell, live again');}
  await ui.evaluate(()=>{const d=document.getElementById('connectionDialog');if(d.open)d.close();});
  await ui.setInputFiles('#stlFiles',{name:'cube.stl',mimeType:'model/stl',buffer:cube()});await ui.waitForFunction(()=>!document.getElementById('slicePlate').disabled,null,{timeout:20000});
  await ui.click('#slicePlate');await ui.waitForSelector('#sliceResults:not([hidden])',{timeout:120000});console.log('sliced:',await ui.textContent('#resultLayerCount'));
  await ui.click('#modelView');await ui.click('#preparePrint');await ui.waitForSelector('#printDialog[open]',{timeout:30000});
  await ui.check('#bedReady');await ui.check('#attended');if(shots)await page.screenshot({path:path.join(shots,'iwa-3-review.png')});await ui.click('#startStudioPrint');
  await ui.waitForFunction(()=>document.getElementById('printStateLabel')?.textContent==='출력 중',null,{timeout:60000});
  await ui.waitForFunction(()=>!document.getElementById('directPrinterPanel').hidden&&document.getElementById('directStage').textContent,null,{timeout:10000});
  console.log('printing panel:',await ui.textContent('#directStage'));await ui.$eval('#printMonitor',e=>e.scrollIntoView({block:'center'}));if(shots)await page.screenshot({path:path.join(shots,'iwa-4-printing.png')});
  await ui.click('#directPause');await ui.waitForFunction(()=>!document.getElementById('directResume').hidden,null,{timeout:10000});console.log('paused:',printer.state.gcode_state);
  await ui.click('#directResume');await ui.waitForFunction(()=>document.getElementById('printStateLabel').textContent==='출력 완료',null,{timeout:60000});
  const [name,file]=[...printer.files.entries()][0],entries=zipEntries(file),start=printer.commands.find(c=>c.print?.command==='project_file').print;
  console.log('uploaded:',name,file.length,'bytes; entries:',[...entries.keys()].filter(n=>/png|gcode$/.test(n)).join(', '));
  console.log('project_file:',JSON.stringify({url:start.url,bed_leveling:start.bed_leveling,flow_cali:start.flow_cali,use_ams:start.use_ams}));
  if(shots){await ui.$eval('#printMonitor',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(shots,'iwa-5-complete.png')});fs.writeFileSync(path.join(shots,'iwa-plate-thumbnail.png'),entries.get('Metadata/plate_1.png')());}
  const booth=await ctx.newPage();booth.on('pageerror',e=>errors.push('booth: '+e.message));const boothUi=await open(booth,'booth');await booth.waitForTimeout(1500);
  console.log('booth direct:',await boothUi.evaluate(()=>document.documentElement.dataset.direct==='1'&&document.getElementById('boothBtn').textContent));
  if(shots){await booth.setViewportSize({width:1366,height:690});await boothUi.evaluate(()=>setStep(2));await booth.waitForTimeout(2000);await booth.screenshot({path:path.join(shots,'iwa-6-booth-print.png')});await boothUi.click('#operatorBtn');await booth.waitForTimeout(400);await booth.screenshot({path:path.join(shots,'iwa-7-settings.png')});}
  // Android app: a 3MF caught from MakerWorld's "Bambu Studio로 열기" reaches Studio through the bridge.
  if(androidMode){const {bambuProject}=require('../tests/helpers/make-3mf.cjs');const mw=await ctx.newPage();await mw.goto('https://127.0.0.1:8443/studio.html');await mw.waitForFunction(()=>window.ClickAndroid?.version);
   natives.get(mw).queueImport('keychain.3mf',bambuProject());await mw.goto('https://127.0.0.1:8443/studio.html#makerworld-import');await mw.waitForSelector('#plateDialog[open]',{timeout:20000});
   await mw.click('#plateImport');await mw.waitForFunction(()=>studioModels.length===2,null,{timeout:10000});console.log('makerworld import:',await mw.evaluate(()=>studioModels.map(m=>m.name).join(' + ')+' · '+studioSettings().quality));await mw.close();}
  // Chrome's Direct Sockets drops bytes on back-to-back writes and on early close; the transport must still deliver
  // every byte, then a FIN, to a receiver that reads as slowly as an A1 mini writing to its SD card.
  // Closing a TCPSocket drops bytes it has not sent yet (the app waits for the printer's reply before closing), so
  // close only once the receiver has everything, up to 30 s. Record which chunk each byte came from: a lost tail is
  // that timing; a hole in the middle is the overwritten-write bug.
  {const slow=await new Promise(res=>{let got=0,fin=false;const seen=new Map();const srv=net.createServer(c=>{c.on('data',b=>{got+=b.length;for(const v of b)seen.set(v,(seen.get(v)||0)+1);c.pause();setTimeout(()=>c.resume(),b.length/30000*1000);});c.on('end',()=>{fin=true;c.end();});}).listen(6000,'127.0.0.1',()=>res({srv,stat:()=>({got,fin,chunks:[...seen].map(([v,n])=>v+':'+n).join(' ')})}));});
   await boothUi.evaluate(async()=>{const t=await DirectSockets.openTcp('127.0.0.1',6000);for(let i=0;i<11;i++)await t.write(new Uint8Array(16384).fill(i));window.__slow=t;});
   for(let i=0;i<120&&slow.stat().got<11*16384;i++)await booth.waitForTimeout(250);
   await boothUi.evaluate(()=>window.__slow.close());
   for(let i=0;i<40&&!slow.stat().fin;i++)await booth.waitForTimeout(250);const st=slow.stat();slow.srv.close();
   console.log('slow receiver:',st.got,'bytes',st.fin?'+ FIN':'(no FIN)');if(st.got!==11*16384||!st.fin)throw Error('Direct Sockets transport lost data or never closed · chunks '+st.chunks);}
  const real=errors.filter(e=>!/favicon|ERR_FILE_NOT_FOUND/.test(e));console.log('page errors:',real.length?real:'none');
  if(!entries.has('Metadata/plate_1.png')||real.length)throw Error('E2E expectations failed');console.log('E2E OK');await finish(0);
 }catch(e){console.error('E2E FAILED:',e.message,errors);try{const pg=ctx.pages().at(-1);console.error('state:',await pg.evaluate(()=>document.getElementById('printMonitor')?.innerText+' | toast: '+document.getElementById('toast')?.textContent+' | dialog: '+(document.getElementById('printDialog')?.open?document.getElementById('printDialog').innerText.slice(-300):'closed')).catch(x=>x.message));console.error('console:',consoleLog.slice(-15));}catch{}if(shots)await ctx.pages().at(-1)?.screenshot({path:path.join(shots,'iwa-failure.png')}).catch(()=>{});await finish(1);}
})();
