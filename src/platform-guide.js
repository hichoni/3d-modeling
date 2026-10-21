// How to print from the device the website is opened on: a plain browser cannot talk to the printer itself, so
// Android tablets get the tablet app, Chromebooks the Chromebook app, and Windows/Mac/iPad save an STL for
// Bambu Studio. Not used inside the apps, which print directly.
(function(root){
 const SITE='https://hichoni.github.io/3d-modeling/';
 function platform(){
  const ua=root.navigator?.userAgent||'',touchMac=/Macintosh/.test(ua)&&root.navigator.maxTouchPoints>1;
  return /CrOS/.test(ua)?'chromeos':/Android/.test(ua)?'android':/iPad|iPhone|iPod/.test(ua)||touchMac?'ios':/Windows/.test(ua)?'windows':/Macintosh/.test(ua)?'mac':'desktop';
 }
 const GUIDES={
  android:{icon:'📱',title:'안드로이드 태블릿',text:'Click Studio 태블릿 앱을 설치하면 같은 Wi-Fi의 A1 mini로 바로 출력해요.',link:{href:SITE+'downloads/click-studio.apk',label:'태블릿 앱 받기 (APK)',download:true},more:{href:SITE+'chromebook.html#android',label:'설치 방법'}},
  chromeos:{icon:'💻',title:'크롬북',text:'Click Studio 크롬북 앱을 설치하면 이 크롬북에서 바로 출력해요.',link:{href:SITE+'chromebook.html',label:'크롬북 앱 설치 안내'}},
  windows:{icon:'🖥️',title:'Windows PC',text:'PC에서는 Bambu Studio로 출력해요. STL을 저장해 Bambu Studio에서 열고, A1 mini를 골라 슬라이스 → 출력하세요.',stl:true,link:{href:'https://bambulab.com/en/download/studio',label:'Bambu Studio 받기 ↗'}},
  mac:{icon:'🖥️',title:'Mac',text:'Mac에서는 Bambu Studio로 출력해요. STL을 저장해 Bambu Studio에서 열고, A1 mini를 골라 슬라이스 → 출력하세요.',stl:true,link:{href:'https://bambulab.com/en/download/studio',label:'Bambu Studio 받기 ↗'}},
  ios:{icon:'📱',title:'iPad·iPhone',text:'이 기기에서는 프린터로 바로 보낼 수 없어요. STL로 저장해서 PC의 Bambu Studio로 출력하세요.',stl:true},
  desktop:{icon:'🖥️',title:'이 컴퓨터',text:'이 컴퓨터에서는 Bambu Studio로 출력해요. STL을 저장해 Bambu Studio에서 열고 A1 mini로 출력하세요.',stl:true,link:{href:'https://bambulab.com/en/download/studio',label:'Bambu Studio 받기 ↗'}}
 };
 // Renders into `box`: onStl saves the current design (omitted where there is nothing to save yet).
 function render(box,{onStl,compact=false}={}){
  if(!box)return null;const kind=platform(),g=GUIDES[kind],doc=root.document;box.replaceChildren();box.dataset.platform=kind;
  const head=doc.createElement('b');head.className='platform-title';head.textContent=g.icon+' '+g.title+'에서 출력하기';
  const text=doc.createElement('p');text.textContent=g.text;box.append(head,text);
  const row=doc.createElement('div');row.className='platform-actions';
  if(g.stl&&onStl){const b=doc.createElement('button');b.type='button';b.className='primary platform-stl';b.textContent='↓ STL 저장';b.onclick=onStl;row.append(b);}
  if(g.link){const a=doc.createElement('a');a.className=g.stl&&onStl?'secondary':'primary';a.href=g.link.href;a.textContent=g.link.label;if(g.link.download)a.setAttribute('download','click-studio.apk');else{a.target='_blank';a.rel='noopener';}row.append(a);}
  if(g.more&&!compact){const a=doc.createElement('a');a.className='text-btn';a.href=g.more.href;a.target='_blank';a.rel='noopener';a.textContent=g.more.label+' ↗';row.append(a);}
  box.append(row);return kind;
 }
 root.ClickPlatform={platform,render};
})(globalThis);
