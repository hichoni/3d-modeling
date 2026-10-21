// Sign the Android tablet app built by CI (android-build branch) and place it in downloads/.
// Usage: node tools/android/sign-apk.cjs <unsigned.apk>
// The key lives only in runtime/ (gitignored): runtime/android-signing.p12 + runtime/android-signing.pass, created
// on first use. Back both up: Android only installs updates signed with the same key.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),runtime=path.join(root,'runtime'),key=path.join(runtime,'android-signing.p12'),passFile=path.join(runtime,'android-signing.pass');
// apksig 2.3.0 from Maven Central (signature scheme v2), checked against Maven Central's SHA-1.
const APKSIG='https://repo1.maven.org/maven2/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',APKSIG_SHA1='6ef7a58375aa68fb492b58edd97607bee8ee5c5c';
const input=process.argv[2];if(!input||!fs.existsSync(input))throw Error('usage: node tools/android/sign-apk.cjs <unsigned.apk>');
fs.mkdirSync(runtime,{recursive:true});
const jar=path.join(runtime,'apksig-2.3.0.jar');
if(!fs.existsSync(jar))execFileSync('curl',['-fsSL','-o',jar,APKSIG],{stdio:'inherit'});
if(crypto.createHash('sha1').update(fs.readFileSync(jar)).digest('hex')!==APKSIG_SHA1){fs.rmSync(jar);throw Error('apksig checksum mismatch');}
if(!fs.existsSync(key)){
 const pass=crypto.randomBytes(18).toString('base64url');fs.writeFileSync(passFile,pass+'\n',{mode:0o600});
 execFileSync('keytool',['-genkeypair','-keystore',key,'-storetype','PKCS12','-storepass',pass,'-keypass',pass,'-alias','click','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Click Studio, O=hichoni 3d-modeling'],{stdio:'inherit'});
 console.log('Created a new signing key in runtime/. Back up runtime/android-signing.p12 and .pass.');
}
const out=path.join(root,'downloads','click-studio.apk'),pass=fs.readFileSync(passFile,'utf8').trim();
// apksig 2.3.0 reads JDK-internal X.509 classes; the password goes through the environment, never the command line.
execFileSync('java',['--add-exports','java.base/sun.security.x509=ALL-UNNAMED','--add-exports','java.base/sun.security.pkcs=ALL-UNNAMED','-cp',jar,path.join(__dirname,'SignApk.java'),input,out,key],{stdio:'inherit',env:{...process.env,CLICK_APK_PASS:pass}});
const bytes=fs.readFileSync(out),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
const cert=execFileSync('keytool',['-list','-v','-keystore',key,'-storepass',pass,'-alias','click'],{encoding:'utf8'}).match(/SHA256:\s*([0-9A-F:]+)/)?.[1]||'';
const versionName=(fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8').match(/versionName '([^']+)'/)||[])[1]||'?';
fs.writeFileSync(path.join(root,'downloads','click-studio-android.json'),JSON.stringify({version:versionName,file:'click-studio.apk',bytes:bytes.length,sha256,signerSha256:cert},null,1)+'\n');
console.log('downloads/click-studio.apk',versionName,bytes.length,'bytes sha256',sha256);
