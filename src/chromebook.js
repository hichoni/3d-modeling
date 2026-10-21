(()=>{
 const $=id=>document.getElementById(id),info=/* BUNDLE_INFO */null;
 if(!/CrOS/.test(navigator.userAgent))$('platformNote').hidden=false;
 if(info){$('bundleInfo').textContent='Click Studio 크롬북 앱 v'+info.version+' · '+(info.bytes/1048576).toFixed(1)+' MB · 서명된 웹 앱 파일';$('bundleId').textContent=info.bundleId;}
 let timer;function toast(text){const t=$('copyToast');t.textContent=text;t.hidden=false;clearTimeout(timer);timer=setTimeout(()=>{t.hidden=true;},2200);}
 for(const button of document.querySelectorAll('[data-copy]'))button.onclick=async()=>{const text=$(button.dataset.copy).textContent.trim();try{await navigator.clipboard.writeText(text);toast('복사했어요. 새 탭 주소창에 붙여넣으세요.');}catch{const range=document.createRange();range.selectNodeContents($(button.dataset.copy));const s=getSelection();s.removeAllRanges();s.addRange(range);toast('선택된 글자를 복사(Ctrl+C)하세요.');}};
})();
