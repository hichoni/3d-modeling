// Sign the Android tablet app built by CI (android-build branch) and place it in downloads/.
// Usage: node tools/android/sign-apk.cjs <unsigned.apk>
// Recover the original runtime/android-signing.p12 + .pass (or supply *_FILE overrides).
// This updater never generates a replacement key. The certificate must match the published app.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {assertNextVersion,requireKeyFiles,assertOfflinePages}=require('../release-guard.cjs');
const {zipEntries}=require('../../bridge/core.cjs');
const root=path.resolve(__dirname,'../..'),runtime=path.join(root,'runtime'),key=process.env.ANDROID_SIGNING_KEY_FILE||path.join(runtime,'android-signing.p12'),passFile=process.env.ANDROID_SIGNING_PASS_FILE||path.join(runtime,'android-signing.pass');
// apksig 2.3.0 from Maven Central (signature scheme v2), checked against Maven Central's SHA-1.
const APKSIG='https://repo1.maven.org/maven2/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',APKSIG_SHA1='6ef7a58375aa68fb492b58edd97607bee8ee5c5c';
const input=process.argv[2];if(!input||!fs.existsSync(input))throw Error('usage: node tools/android/sign-apk.cjs <unsigned.apk>');
requireKeyFiles([key,passFile]);
const published=JSON.parse(fs.readFileSync(path.join(root,'downloads','click-studio-android.json'),'utf8'));
if(!/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(published.signerSha256))throw Error('Published Android certificate fingerprint missing; output unchanged.');
const versionName=(fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8').match(/versionName '([^']+)'/)||[])[1]||'?';
assertNextVersion(versionName,published.version);
assertOfflinePages(zipEntries(fs.readFileSync(input)),Object.fromEntries(['index.html','studio.html'].map(name=>[name,fs.readFileSync(path.join(root,name))])));
fs.mkdirSync(runtime,{recursive:true});
const jar=path.join(runtime,'apksig-2.3.0.jar');
if(!fs.existsSync(jar))execFileSync('curl',['-fsSL','-o',jar,APKSIG],{stdio:'inherit'});
if(crypto.createHash('sha1').update(fs.readFileSync(jar)).digest('hex')!==APKSIG_SHA1){fs.rmSync(jar);throw Error('apksig checksum mismatch');}
const out=path.join(root,'downloads','click-studio.apk'),pass=fs.readFileSync(passFile,'utf8').trim();
const pending=path.join(root,'artifacts','click-studio-signed-pending.apk');fs.mkdirSync(path.dirname(pending),{recursive:true});
// apksig 2.3.0 reads JDK-internal X.509 classes; the password goes through the environment, never the command line.
execFileSync('java',['--add-exports','java.base/sun.security.x509=ALL-UNNAMED','--add-exports','java.base/sun.security.pkcs=ALL-UNNAMED','-cp',jar,path.join(__dirname,'SignApk.java'),input,pending,key,published.signerSha256],{stdio:'inherit',env:{...process.env,CLICK_APK_PASS:pass}});
fs.renameSync(pending,out);
const bytes=fs.readFileSync(out),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(path.join(root,'downloads','click-studio-android.json'),JSON.stringify({version:versionName,file:'click-studio.apk',bytes:bytes.length,sha256,signerSha256:published.signerSha256},null,1)+'\n');
console.log('downloads/click-studio.apk',versionName,bytes.length,'bytes sha256',sha256);
