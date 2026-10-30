// Printer picker for the installed Chromebook/tablet app (direct mode): the one place to choose, add and fix A1 minis,
// in both the booth's and the studio's connection dialog (#printerPicker). Registered printers are cards with their live
// state; adding one is three short steps (prepare, find, 8-character code). Talks only to DirectRelay's local API.
(function(root){
if(!root.DirectRelay?.enabled())return;
const doc=root.document,$=id=>doc.getElementById(id);
function h(tag,props={},...kids){const e=doc.createElement(tag);for(const [k,v] of Object.entries(props)){if(v===false||v==null)continue;if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?'':v);}e.append(...kids.flat().filter(k=>k!=null&&k!==false));return e;}
async function call(route,body){const r=await DirectRelay.fetch(route,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'요청을 처리하지 못했어요.');return data;}
const tail=serial=>String(serial||'').slice(-4);
const STYLE=`
.printer-picker{--pp-ink:#172846;--pp-muted:#5f6b7d;--pp-line:#dfe3ea;--pp-blue:#2563eb;--pp-ok:#15803d;--pp-warn:#b45309;--pp-bad:#c2410c;display:grid;gap:12px;color:var(--pp-ink);font-size:14px;text-align:left}
.printer-picker h3{margin:0;font-size:17px}.printer-picker small{color:var(--pp-muted);font-size:12.5px;line-height:1.5}
.pp-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.pp-list{display:grid;gap:10px}
.pp-card,.pp-found,.pp-target{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;padding:14px;border:1.5px solid var(--pp-line);border-radius:16px;background:#fff;text-align:left;font:inherit;color:inherit}
.pp-card.mine{border-color:#86d0a0;background:#f3fbf6;box-shadow:0 0 0 3px #d9f2e2}
.pp-found{cursor:pointer;width:100%}.pp-found:hover,.pp-found:focus-visible{border-color:var(--pp-blue);box-shadow:0 0 0 3px #dbe7ff;outline:none}.pp-found i{font-style:normal;font-size:24px;color:var(--pp-muted)}
.pp-target{grid-template-columns:44px 1fr;background:#f6f8fb}
.pp-printer{width:44px;height:44px;border-radius:12px;background:#eef2f7 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23172846' stroke-width='1.6' stroke-linejoin='round'%3E%3Cpath d='M5 3h14v18H5z'/%3E%3Cpath d='M5 7h14M9 7v5h6V7M8 17h8'/%3E%3C/svg%3E") center/26px no-repeat}
.pp-main{display:grid;gap:3px;min-width:0}.pp-main b{font-size:15px;overflow-wrap:anywhere}
.pp-chip{justify-self:start;margin-top:3px;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#eef2f7;color:var(--pp-muted)}
.pp-chip::before{content:'● '}.pp-chip.ok{background:#dcf5e5;color:var(--pp-ok)}.pp-chip.busy{background:#fff1d6;color:var(--pp-warn)}.pp-chip.warn{background:#fff1d6;color:var(--pp-warn)}.pp-chip.bad{background:#ffe4dc;color:var(--pp-bad)}.pp-chip.wait::before{content:'○ '}
.pp-why{margin:2px 0 0;font-size:12.5px;color:var(--pp-bad);line-height:1.5}
.pp-actions{display:grid;gap:6px;justify-items:end}
.pp-primary,.pp-secondary,.pp-add{min-height:44px;padding:0 16px;border-radius:12px;font:inherit;font-weight:700;cursor:pointer}
.pp-primary{border:0;background:var(--pp-blue);color:#fff}.pp-primary:disabled{opacity:.45;cursor:default}
.pp-secondary{border:1.5px solid var(--pp-line);background:#fff;color:var(--pp-ink)}
.pp-add{width:100%;border:1.5px dashed #b9c3d2;background:transparent;color:var(--pp-blue)}
.pp-wide{width:100%;font-size:16px}
.pp-using{font-weight:800;color:var(--pp-ok);white-space:nowrap}
.pp-more summary{cursor:pointer;color:var(--pp-muted);font-size:12.5px;list-style:none;text-align:right}.pp-more summary::-webkit-details-marker{display:none}
.pp-more[open]{display:grid;gap:4px}.pp-more button{border:0;background:none;padding:4px 0;font:inherit;font-size:13px;color:var(--pp-blue);cursor:pointer;text-align:right}.pp-more .danger{color:var(--pp-bad)}
.pp-back,.pp-link{justify-self:start;border:0;background:none;padding:4px 0;font:inherit;font-weight:700;color:var(--pp-blue);cursor:pointer}
.pp-steps{display:flex;gap:6px;margin:0;padding:0;list-style:none;counter-reset:none}
.pp-steps li{flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:12px;background:#f1f4f8;color:var(--pp-muted);font-weight:700;font-size:13px}
.pp-steps b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#dfe5ee;font-size:12px}
.pp-steps .now{background:#e3ecff;color:var(--pp-blue)}.pp-steps .now b{background:var(--pp-blue);color:#fff}.pp-steps .done b{background:var(--pp-ok);color:#fff}
.pp-prepare{display:grid;gap:2px;padding:10px 12px;border-radius:12px;background:#f6f8fb;font-size:13px;line-height:1.55}
.pp-searching{display:flex;align-items:center;gap:10px;margin:0;color:var(--pp-muted)}
.pp-spin{width:18px;height:18px;border-radius:50%;border:3px solid #d7deea;border-top-color:var(--pp-blue);animation:pp-spin .8s linear infinite;flex:none}
@keyframes pp-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.pp-spin{animation:none}}
.pp-msg{display:grid;gap:3px;margin:0;padding:10px 12px;border-radius:12px;font-weight:700;line-height:1.5;background:#eef2f7}
.pp-msg.ok{background:#dcf5e5;color:var(--pp-ok)}.pp-msg.warn{background:#fff6e0;color:var(--pp-warn)}.pp-msg.bad{background:#ffece5;color:var(--pp-bad)}.pp-msg small{font-weight:500;color:inherit;opacity:.9}
.pp-ip,.pp-code-form{display:grid;gap:8px}.pp-ip label,.pp-code-form label{font-weight:800}
.pp-ip div{display:flex;gap:8px}.pp-ip input{flex:1;min-width:0}
.pp-ip input,.pp-code{min-height:46px;padding:0 14px;border:1.5px solid var(--pp-line);border-radius:12px;font:inherit;font-size:16px;color:inherit;background:#fff}
.pp-code-row{display:flex;align-items:center;gap:10px}
.pp-code{flex:1;min-width:0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:24px;letter-spacing:.3em;text-align:center}
.pp-ip input:focus,.pp-code:focus{outline:none;border-color:var(--pp-blue);box-shadow:0 0 0 3px #dbe7ff}
.pp-count{min-width:48px;color:var(--pp-muted);font-weight:700;font-size:13px;text-align:right}
.pp-net{display:block;color:#3c7a5e;font-size:12px;margin-top:2px}.pp-net.off{color:#b3412e;font-weight:700}
@media (max-width:520px){.pp-card{grid-template-columns:40px 1fr}.pp-actions{grid-column:1/-1;justify-items:stretch}.pp-steps li{font-size:12px;padding:7px}}
`;
const PREPARE='프린터 화면 › 설정에서 LAN Only와 개발자 모드를 켜고, 이 기기와 같은 Wi-Fi에 연결해요.';

let host=null,hooks={},view='list',draft='',printers=[],found=[],searched=false,searching=false,target=null,busy=false,message=null,manual=false,wasOpen=false;

const net=ip=>String(ip||'').split('.').slice(0,3).join('.');
// The A1 mini keeps its address; a Chromebook that jumped to another Wi-Fi shows up as a different network here.
function network(p){if(!p.ip)return null;if(!p.localAddress)return {same:false,text:'이 기기 → 프린터 '+p.ip+' 경로 없음'};return {same:net(p.localAddress)===net(p.ip),text:'이 기기 '+p.localAddress+' → 프린터 '+p.ip};}
function status(p,mine){
 const n=network(p);
 if(!p.fresh&&n&&!n.same)return {tone:'bad',text:'이 기기 Wi-Fi가 프린터와 달라요',why:(p.localAddress?'이 기기 '+p.localAddress+' · 프린터 '+p.ip+'. ':'이 기기에서 프린터 '+p.ip+'로 가는 네트워크가 없어요. ')+'이 기기를 프린터와 같은 Wi-Fi에 다시 연결한 뒤 [다시 연결]을 눌러요.'};
 if(p.fresh&&['RUNNING','PREPARE','PAUSE'].includes(p.state))return {tone:'busy',text:(p.state==='PAUSE'?'일시 정지':'출력 중')+(Number.isFinite(Number(p.progress))&&p.state!=='PREPARE'?' '+Number(p.progress)+'%':'')};
 if(p.fresh&&p.developerMode===false)return {tone:'warn',text:'개발자 모드가 꺼져 있어요',why:'프린터 화면 › 설정 › WLAN › LAN Only에서 개발자 모드를 켜야 출력할 수 있어요. 꺼져 있으면 프린터가 출력 명령을 거절해요.'};
 if(p.fresh)return {tone:'ok',text:mine?'연결됨 · 이 기기의 프린터':'연결됨 · 쉬는 중'};
 if(p.error)return {tone:'bad',text:'연결 안 됨',why:p.error};
 return {tone:'wait',text:'연결 확인 중…'};
}
function stepper(n){return h('ol',{class:'pp-steps','aria-label':'새 프린터 추가 단계'},['준비','찾기','코드'].map((t,i)=>h('li',{class:i+1<n?'done':i+1===n?'now':'','aria-current':i+1===n?'step':false},h('b',{},i+1<n?'✓':String(i+1)),t)));}
function note(){return message?h('p',{class:'pp-msg '+message.tone,role:message.tone==='bad'?'alert':'status'},message.text,message.tip?h('small',{},message.tip):null):null;}

function listView(){
 const mine=DirectRelay.store.pairing?.printerId;
 const cards=printers.map(p=>{const s=status(p,p.id===mine),use=p.id===mine;
  return h('div',{class:'pp-card'+(use?' mine':''),'data-printer':p.id},
   h('span',{class:'pp-printer','aria-hidden':'true'}),
   h('div',{class:'pp-main'},h('b',{},p.name||'A1 mini '+tail(p.serial)),h('small',{},'SN 끝 '+tail(p.serial)+' · '+p.ip),network(p)&&use?h('small',{class:'pp-net'+(network(p).same?'':' off')},network(p).text):null,h('span',{class:'pp-chip '+s.tone},s.text),s.why?h('p',{class:'pp-why'},s.why):null),
   h('div',{class:'pp-actions'},
    s.tone==='bad'||s.tone==='wait'?h('button',{type:'button',class:'pp-primary',disabled:busy,onclick:()=>reconnect(p)},'다시 연결'):use?h('span',{class:'pp-using'},'✓ 이 기기 프린터'):h('button',{type:'button',class:'pp-primary',disabled:busy||p.busy,onclick:()=>usePrinter(p)},'이 프린터 사용하기'),
    h('details',{class:'pp-more'},h('summary',{},'관리'),h('button',{type:'button',onclick:()=>{target={id:p.id,ip:p.ip,serial:p.serial,name:p.name};message=null;draft='';view='code';render();}},'코드 다시 입력'),h('button',{type:'button',class:'danger',onclick:()=>remove(p)},'이 기기에서 지우기'))));});
 return [h('div',{class:'pp-head'},h('h3',{},'내 프린터'),h('small',{},printers.length+'대 등록 · 이 기기에만 저장돼요')),note(),h('div',{class:'pp-list'},cards),
  h('button',{type:'button',class:'pp-add',onclick:()=>startFind()},'+ 새 프린터 추가')];
}
function findView(){
 const known=new Set(printers.map(p=>p.serial));
 const results=found.map(p=>h('button',{type:'button',class:'pp-found','data-serial':p.serial,onclick:()=>{const saved=printers.find(x=>x.serial===p.serial);target={id:saved?.id,ip:p.ip,serial:p.serial,name:p.name,saved:!!saved?.hasAccessCode};message=null;draft='';if(target.saved)void save('');else{view='code';render();}}},
  h('span',{class:'pp-printer','aria-hidden':'true'}),h('span',{class:'pp-main'},h('b',{},(p.name||'A1 mini')+' · SN 끝 '+tail(p.serial)),h('small',{},p.ip+(known.has(p.serial)?' · 이미 등록됨':'')),p.lanOnly===false?h('span',{class:'pp-chip warn'},'LAN Only를 켜야 해요'):null),h('i',{'aria-hidden':'true'},'›')));
 const empty=searched&&!searching&&!found.length;
 return [printers.length?h('button',{type:'button',class:'pp-back',onclick:()=>{view='list';message=null;render();}},'← 내 프린터'):null,stepper(2),
  h('div',{class:'pp-prepare'},h('b',{},'먼저 확인해요'),h('span',{},PREPARE)),
  h('div',{class:'pp-head'},h('h3',{},'같은 Wi-Fi에서 찾은 A1 mini'),searching?null:h('button',{type:'button',class:'pp-link',onclick:()=>startFind()},'다시 찾기')),
  searching?h('p',{class:'pp-searching',role:'status'},h('span',{class:'pp-spin','aria-hidden':'true'}),'A1 mini를 찾는 중이에요… (최대 20초)'):null,
  results.length?h('div',{class:'pp-list'},results):null,
  empty?h('div',{class:'pp-msg warn',role:'status'},'같은 Wi-Fi에서 A1 mini를 찾지 못했어요.',h('small',{},'프린터 전원 · 같은 Wi-Fi · LAN Only가 켜졌는지 확인하고 다시 찾아요. 그래도 안 되면 프린터 화면의 IP로 찾아요.')):null,
  note(),
  manual||empty?h('form',{class:'pp-ip',onsubmit:e=>{e.preventDefault();probe(e.target.elements.ip.value);}},h('label',{for:'ppIp'},'프린터 IP로 찾기'),h('div',{},h('input',{id:'ppIp',name:'ip',inputmode:'decimal',placeholder:'예: 192.168.0.25',autocomplete:'off',spellcheck:'false'}),h('button',{type:'submit',class:'pp-secondary',disabled:busy},'확인')),h('small',{},'프린터 화면 › 설정 › WLAN에서 IP를 볼 수 있어요.'))
  :searching?null:h('button',{type:'button',class:'pp-link',onclick:()=>{manual=true;render();$('ppIp')?.focus();}},'목록에 없나요? IP로 찾기')];
}
function codeView(){
 const fix=!!target.id&&printers.some(p=>p.id===target.id&&p.serial===target.serial),keep=fix&&printers.some(p=>p.id===target.id&&p.hasAccessCode);
 const input=h('input',{id:'ppCode',name:'code',class:'pp-code',maxlength:'8',autocomplete:'off',autocapitalize:'off',spellcheck:'false',inputmode:'text','aria-describedby':'ppCodeHelp',placeholder:keep?'저장된 코드 사용':'••••••••',value:draft||false,disabled:busy});
 const count=h('span',{class:'pp-count'},'0 / 8'),submit=h('button',{type:'submit',class:'pp-primary pp-wide',disabled:true},busy?'연결하는 중…':'연결하기');
 const sync=()=>{input.value=input.value.replace(/[^a-zA-Z0-9]/g,'').slice(0,8);draft=input.value;count.textContent=input.value.length+' / 8';submit.disabled=busy||!(input.value.length===8||keep&&!input.value);submit.textContent=busy?'연결하는 중…':keep&&!input.value?'저장된 코드로 연결하기':'연결하기';};input.addEventListener('input',sync);sync();
 return [h('button',{type:'button',class:'pp-back',onclick:()=>{view=fix?'list':'find';message=null;render();}},fix?'← 내 프린터':'← 다른 프린터 고르기'),fix?null:stepper(3),
  h('div',{class:'pp-target'},h('span',{class:'pp-printer','aria-hidden':'true'}),h('span',{class:'pp-main'},h('b',{},(target.name||'A1 mini')+' · SN 끝 '+tail(target.serial)),h('small',{},target.ip))),
  h('form',{class:'pp-code-form',onsubmit:e=>{e.preventDefault();save(input.value);}},
   h('label',{for:'ppCode'},'프린터 액세스 코드 8자리'),h('div',{class:'pp-code-row'},input,count),
   h('small',{id:'ppCodeHelp'},(keep?'비워 두면 저장된 코드로 연결해요. 프린터에서 코드가 바뀌었을 때만 새로 입력해요. ':'')+'프린터 화면 › 설정 › LAN Only의 현재 8자리예요. 대문자·소문자를 본체에 보이는 그대로 입력해요.'),
   busy?h('p',{class:'pp-searching',role:'status'},h('span',{class:'pp-spin','aria-hidden':'true'}),'프린터와 연결하고 있어요… 보통 5~15초 걸려요.'):null,note(),submit)];
}
function render(){
 if(!host)return;const focus=doc.activeElement?.id,value=focus==='ppCode'||focus==='ppIp'?doc.activeElement.value:null;
 host.replaceChildren(...[view==='list'?listView():view==='find'?findView():codeView()].flat().filter(Boolean));
 if(value!==null&&$(focus)){$(focus).value=value;$(focus).dispatchEvent(new Event('input'));$(focus).focus();}
 else if(view==='code'&&!busy)$('ppCode')?.focus();
}
async function load(){try{const data=await call('/api/connection-settings');printers=data.printers.filter(p=>!p.blank);}catch(e){message={tone:'bad',text:e.message};}}
async function changed(){try{await hooks.onChange?.();}catch{}}

async function startFind(){view='find';found=[];searched=false;searching=true;manual=false;message=null;render();
 try{const r=await call('/api/discover-printers',{});found=r.printers||[];if(!found.length&&r.others?.length)message={tone:'warn',text:'A1 mini가 아닌 프린터 '+r.others.length+'대는 지원하지 않아요.'};}
 catch(e){message={tone:'bad',text:e.message};}finally{searching=false;searched=true;if(view==='find')render();}}
async function probe(ip){ip=String(ip||'').trim();if(!ip)return;busy=true;message={tone:'wait',text:'이 주소의 프린터를 확인하고 있어요…'};render();
 try{const r=await call('/api/discover-printers',{mode:'probe',ip}),p=r.printers[0];if(!p?.supported&&p?.supported!==undefined)throw Error('Bambu Lab 프린터지만 A1 mini가 아니에요.');
  target={id:printers.find(x=>x.serial===p.serial)?.id,ip,serial:p.serial,name:p.name};message=null;view='code';}
 catch(e){message={tone:'bad',text:e.message,tip:'IP를 다시 확인하고, 프린터와 이 기기가 같은 Wi-Fi인지 봐요.'};}finally{busy=false;render();}}
function hint(text){return /코드|인증|access|code|auth|password|401|403/i.test(text)?'선택한 프린터의 현재 코드와 LAN Only · 개발자 모드를 확인해요. 모두 맞아도 프린터가 일시적으로 로그인을 거절할 수 있어요. 잠시 뒤 다시 연결해요.':'프린터 전원 · 같은 Wi-Fi · LAN Only와 개발자 모드가 켜졌는지 확인하고 다시 시도해요.';}
async function save(code){
 busy=true;message=null;render();
 try{let id=target.id;if(!id){const data=await call('/api/connection-settings');id=data.printers.find(p=>p.serial===target.serial)?.id||data.printers.find(p=>p.blank)?.id;if(!id)throw Error('이 기기에는 프린터를 8대까지 등록할 수 있어요. 안 쓰는 프린터를 지운 뒤 추가해요.');}
  const result=await call('/api/connection-settings',{printerId:id,ip:target.ip,serial:target.serial,accessCode:code});
  await load();await changed();busy=false;
  if(result.paired){message={tone:'ok',text:'✓ 연결됐어요! 이제 이 프린터로 출력해요.'};view='list';render();setTimeout(()=>hooks.onDone?.('연결됐어요! 이제 이 프린터로 출력해요.'),900);}
  else{message={tone:'ok',text:'✓ 연결됐어요. [이 프린터 사용하기]를 누르면 이 프린터로 출력해요.'};view='list';render();}}
 catch(e){busy=false;const auth=/액세스 코드 인증이 거절/.test(e.message);message={tone:'bad',text:auth?(code?'프린터는 응답했지만 로그인을 거절했어요.':'저장된 코드로는 로그인이 안 돼요. 프린터 화면의 현재 코드를 입력해요.'):e.message,tip:hint(e.message)};if(!code)view='code';render();}}
async function usePrinter(p){busy=true;message=null;render();
 try{await call('/api/pair',{printerId:p.id});await load();await changed();busy=false;message={tone:'ok',text:'✓ '+(p.name||'A1 mini')+'로 출력해요.'};render();setTimeout(()=>hooks.onDone?.('이제 '+(p.name||'이 A1 mini')+'로 출력해요.'),700);}
 catch(e){busy=false;message={tone:'bad',text:e.message};render();}}
async function reconnect(p){busy=true;message={tone:'wait',text:(p.name||'A1 mini')+'에 다시 연결하고 있어요…'};render();
 try{await call('/api/connection-settings',{printerId:p.id,ip:p.ip,serial:p.serial});await load();await changed();message={tone:'ok',text:'✓ 다시 연결됐어요.'};}
 catch(e){message={tone:'bad',text:e.message,tip:hint(e.message)};}finally{busy=false;render();}}
async function remove(p){if(!root.confirm((p.name||'이 프린터')+'를 이 기기에서 지울까요? 액세스 코드도 함께 지워져요.'))return;busy=true;render();
 try{await call('/api/connection-settings',{printerId:p.id,remove:true});await load();await changed();message={tone:'ok',text:'지웠어요.'};if(!printers.length)return startFind();}
 catch(e){message={tone:'bad',text:e.message};}finally{busy=false;if(view==='list')render();}}

// Opening the dialog starts fresh: the list if anything is registered, otherwise straight to finding one.
async function opened(){message=null;manual=false;await load();if(printers.length){view='list';render();}else startFind();}
function tick(){const dialog=host?.closest('dialog'),open=!!dialog?.open;if(open&&!wasOpen)void opened();else if(open&&view==='list'&&!busy)void load().then(()=>{if(view==='list'&&!busy&&!host.querySelector('details[open]'))render();});wasOpen=open;}
function mount(element,options={}){host=element;hooks=options;host.classList.add('printer-picker');if(!$('printerPickerStyle'))doc.head.append(h('style',{id:'printerPickerStyle'},STYLE));setInterval(tick,1500);tick();}

function init(){
 const element=$('printerPicker');if(!element)return;
 if(typeof StudioAPI!=='undefined')mount(element,{onChange:()=>StudioAPI.refresh(),onDone:text=>{$('connectionDialog')?.close();root.studioToast?.(text);}});
 else mount(element,{onChange:()=>root.refreshPairing?.(),onDone:text=>{$('boothDialog')?.close();root.toast?.(text);}});
}
root.PrinterPicker={mount,open:opened};
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof globalThis==='object'?globalThis:this);
