// Signs artifacts/iwa-app (from `node scripts/build.cjs`) into downloads/click-studio.swbn plus its update manifest.
// The Ed25519 key decides the app ID: keep it private and reuse it for every update.
//   IWA_SIGNING_KEY=<PEM text> or IWA_SIGNING_KEY_FILE=<path>, otherwise runtime/iwa-signing-key.pem.
//   --new-key creates runtime/iwa-signing-key.pem once (git-ignored). Never commit the key.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {assertIdentity,assertNextVersion}=require('../release-guard.cjs');
const root=path.resolve(__dirname,'../..'),{out:app,VERSION,UPDATE_URL,manifest}=require('../../scripts/build-iwa-app.cjs');
const publishedPath=path.join(root,'downloads','click-studio.json'),published=fs.existsSync(publishedPath)?JSON.parse(fs.readFileSync(publishedPath,'utf8')):null;
const BUNDLE_URL='https://hichoni.github.io/3d-modeling/downloads/click-studio.swbn';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.ttf':'font/ttf'};
function key(){
 if(process.env.IWA_SIGNING_KEY)return process.env.IWA_SIGNING_KEY;
 const file=process.env.IWA_SIGNING_KEY_FILE||path.join(root,'runtime','iwa-signing-key.pem');
 if(fs.existsSync(file))return fs.readFileSync(file,'utf8');
 if(published)throw Error('Original IWA signing key not found. Recover IWA_SIGNING_KEY_FILE or runtime/iwa-signing-key.pem. Published app unchanged; no new key created.');
 if(!process.argv.includes('--new-key'))throw Error('Signing key not found. Set IWA_SIGNING_KEY(_FILE); --new-key is only for an unpublished app.');
 const {privateKey}=crypto.generateKeyPairSync('ed25519'),pem=privateKey.export({type:'pkcs8',format:'pem'});
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,pem,{mode:0o600,flag:'wx'});console.log('Created a NEW signing key at '+path.relative(root,file)+'. Back it up privately; a different key means a different app.');return pem;
}
function files(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]);}
(async()=>{
 if(!fs.existsSync(path.join(app,'.well-known','manifest.webmanifest')))throw Error('Run `node scripts/build.cjs` first.');
 const built=JSON.parse(fs.readFileSync(path.join(app,'.well-known','manifest.webmanifest'),'utf8'));if(built.version!==VERSION||JSON.stringify(built)!==JSON.stringify(manifest()))throw Error('artifacts/iwa-app is stale. Run `node scripts/build.cjs` again.');
 const pem=key(),wbn=require('wbn'),wbnSign=require('wbn-sign');
 const privateKey=wbnSign.parsePemKey(pem),identity=new wbnSign.WebBundleId(privateKey),origin=identity.serializeWithIsolatedWebAppOrigin();
 if(published){assertIdentity(identity.serialize(),published.bundleId,'IWA');assertNextVersion(VERSION,published.version);}
 const builder=new wbn.BundleBuilder();
 for(const name of files(app).sort()){const type=TYPES[path.extname(name)];if(!type)throw Error('No content type for '+name);builder.addExchange(origin+(name==='index.html'?'':name),200,{'Content-Type':type},fs.readFileSync(path.join(app,name)));}
 const signed=await wbnSign.SignedWebBundle.fromWebBundle(builder.createBundle(),[new wbnSign.NodeCryptoSigningStrategy(privateKey)]),bytes=signed.getSignedWebBundleBytes(),id=signed.getWebBundleId();
 fs.writeFileSync(path.join(root,'downloads','click-studio.swbn'),bytes);
 fs.writeFileSync(path.join(root,'downloads','click-studio-update.json'),JSON.stringify({versions:[{version:VERSION,src:BUNDLE_URL}]},null,1)+'\n');
 const info={bundleId:id,version:VERSION,updateManifestUrl:UPDATE_URL,bundleUrl:BUNDLE_URL,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 fs.writeFileSync(path.join(root,'downloads','click-studio.json'),JSON.stringify(info,null,1)+'\n');
 console.log('Signed downloads/click-studio.swbn',info);
})().catch(e=>{console.error(e.message);process.exit(1);});
