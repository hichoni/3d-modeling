const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline/promises');
const crypto=require('node:crypto');
const os=require('node:os');
const {privateIPv4}=require('./access.cjs');
const dir=path.join(__dirname,'..','runtime'),file=path.join(dir,'config.json');
(async()=>{fs.mkdirSync(dir,{recursive:true});const old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};const rl=readline.createInterface({input:process.stdin,output:process.stdout});
 console.log('상상을 클릭하다! 로컬 공방 설정\nLAN Only + Developer Mode를 켠 A1 mini의 본체 설정에서 IP와 일련번호를 확인하세요.\n프린터 없이도 실제 슬라이싱은 사용할 수 있습니다. 빈칸이면 기존 값을 유지합니다.');
 const ip=(await rl.question('프린터 IP (미연결이면 Enter): ')).trim()||old.printer?.ip||'';
 const serial=ip?(await rl.question('프린터 일련번호: ')).trim()||old.printer?.serial||'':'';
 const slicer=(await rl.question('Bambu Studio 실행 파일 경로 (기본 설치는 Enter): ')).trim()||old.slicerPath||'C:/Program Files/Bambu Studio/bambu-studio.exe';
 let booth=old.booth||{enabled:false};
 if(process.argv.includes('--booth')){
  const addresses=Object.values(os.networkInterfaces()).flat().filter(n=>n.family==='IPv4'&&!n.internal&&privateIPv4(n.address)).map(n=>n.address);
  if(!addresses.length)throw Error('학교 Wi-Fi에 연결한 다음 부스 모드를 설정하세요.');
  const suggestion=addresses.includes(old.booth?.host)?old.booth.host:addresses.find(a=>a.split('.').slice(0,3).join('.')===ip.split('.').slice(0,3).join('.'))||addresses[0];
  console.log('\n이 PC의 네트워크 주소: '+addresses.join(', ')+'\n참가자와 같은 Wi-Fi의 PC 주소를 선택하세요. 프린터 IP와 다릅니다.');
  const host=(await rl.question('출력 PC 주소 (Enter = '+suggestion+'): ')).trim()||suggestion;
  if(!addresses.includes(host))throw Error('현재 PC에 연결된 Wi-Fi 주소 중에서 선택하세요.');
  booth={enabled:true,host,key:old.booth?.key||crypto.randomBytes(32).toString('hex')};
 }
 const config={...old,port:5188,slicerPath:slicer,printer:{name:'공방 A1 mini',ip,serial,accessCode:old.printer?.accessCode||''},operatorPin:old.operatorPin||String(crypto.randomInt(100000,1000000)),booth};fs.writeFileSync(file,JSON.stringify(config,null,2));
 console.log('\n설정 저장: runtime/config.json\n운영자 PIN: '+config.operatorPin+'\n접근 코드는 Bambu Studio에 저장된 코드를 자동으로 읽습니다. 없으면 runtime/config.json의 accessCode에 직접 입력하세요.\n시작: node bridge/server.cjs\n'+(booth.enabled?'부스 모드: 운영자 화면에서 참가자 링크를 복사해 크롬북에 공유하세요. Windows가 묻는 경우 이 Wi-Fi에서 서버 통신을 허용해야 합니다.\n':'')+'비공개 설정은 GitHub에 올리지 마세요.');rl.close();})().catch(e=>{console.error(e.message);process.exit(1);});
