const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {assertIdentity,assertNextVersion,requireKeyFiles,assertOfflinePages,writeVersionedBundle}=require('../tools/release-guard.cjs');

test('versioned IWA downloads keep old URLs immutable and give new versions distinct URLs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-iwa-publish-')),one=Buffer.from('signed version 1'),two=Buffer.from('signed version 2');
 try{
  const old=writeVersionedBundle(dir,'1.1.5',one),next=writeVersionedBundle(dir,'1.1.6',two);
  assert.notEqual(old,next);
  assert.equal(writeVersionedBundle(dir,'1.1.5',one),old);
  assert.throws(()=>writeVersionedBundle(dir,'1.1.5',two),/cannot be overwritten/);
  assert.deepEqual(fs.readFileSync(path.join(dir,old)),one);
  assert.deepEqual(fs.readFileSync(path.join(dir,next)),two);
  assert.throws(()=>writeVersionedBundle(dir,'../escape',one),/version/);
 }finally{for(const f of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,f));fs.rmdirSync(dir);}
});
test('a replacement identity cannot be published as an existing app update',()=>{
 assert.doesNotThrow(()=>assertIdentity('same','same','IWA'));
 for(const [a,b]of [['new','old'],['','old'],['same',undefined]])assert.throws(()=>assertIdentity(a,b,'IWA'),/identity/);
});
test('a release version must increase before a signed package is published',()=>{
 for(const [a,b]of [['1.1.4','1.1.3'],['1.2.0','1.1.9'],['2.0.0','1.9.9']])assert.doesNotThrow(()=>assertNextVersion(a,b));
 for(const [a,b]of [['1.1.3','1.1.3'],['1.1.2','1.1.3'],['1.0.9','1.1.0'],['unknown','1.1.0']])assert.throws(()=>assertNextVersion(a,b));
});
test('missing keys fail without creating a new signing identity',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'click-release-guard-'));try{const key=path.join(dir,'missing.pem');assert.throws(()=>requireKeyFiles([key]),/No replacement key/);assert.equal(fs.existsSync(key),false);}finally{fs.rmdirSync(dir);}
});
test('an APK with old or missing offline pages cannot be signed as the current build',()=>{
 const good=Buffer.from('current build'),entries=new Map([['assets/web/index.html',()=>good],['assets/web/studio.html',()=>good]]);
 assert.doesNotThrow(()=>assertOfflinePages(entries,{'index.html':good,'studio.html':good}));
 assert.throws(()=>assertOfflinePages(entries,{'index.html':Buffer.from('newer build')}),/does not match/);
 assert.throws(()=>assertOfflinePages(new Map(),{'index.html':good}),/does not match/);
});
