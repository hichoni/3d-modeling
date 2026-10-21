const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {zipEntries}=require('../bridge/core.cjs');
test('downloadable operator package is complete, current, and contains no runtime data',()=>{
 const entries=zipEntries(fs.readFileSync('downloads/booth-setup.zip')),prefix='click-workshop/';
 for(const [name,read]of entries){assert.ok(name.startsWith(prefix));assert.ok(!/(^|\/)(runtime|artifacts|\.git|jobs|node_modules)(\/|$)/.test(name));assert.ok(!name.endsWith('.local.json'));assert.ok(read().length>0);
  if(name.endsWith('.cjs'))for(const match of read().toString().matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));assert.ok(entries.has(dependency),'Missing runtime dependency: '+dependency);}
 }
 assert.deepEqual(entries.get(prefix+'index.html')(),fs.readFileSync('index.html'));
 assert.deepEqual(entries.get(prefix+'studio.html')(),fs.readFileSync('studio.html'));assert.ok(entries.has(prefix+'src/studio-core.js'));
 assert.deepEqual(entries.get(prefix+'setup.html')(),fs.readFileSync('setup.html'));assert.equal(entries.get(prefix+'먼저 읽어주세요.txt')().toString().replace(/\r\n/g,'\n'),fs.readFileSync('docs/OPERATOR_QUICK_START.txt','utf8').replace(/\r\n/g,'\n'));
 assert.equal(entries.get(prefix+'configure-booth.cmd')().toString().replace(/\r\n/g,'\n'),fs.readFileSync('configure-booth.cmd','utf8').replace(/\r\n/g,'\n'));
 assert.ok(entries.has(prefix+'scripts/start-background.ps1'));assert.ok(entries.has(prefix+'scripts/install-autostart.ps1'));assert.ok(entries.has(prefix+'먼저 읽어주세요.txt'));
 const config=JSON.parse(entries.get(prefix+'bridge/config.example.json')());for(const p of config.printers){assert.equal(p.accessCode,'');assert.equal(p.serial,'');assert.equal(p.ip,'');}assert.equal(config.operatorPin,'');assert.equal(config.booth.enabled,false);assert.equal(config.booth.key,'');
});
