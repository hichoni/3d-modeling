(()=>{
 const $=id=>document.getElementById(id),info=/* BUNDLE_INFO */null;
 if(/Android/.test(navigator.userAgent)){$('platformNote').textContent='안드로이드 태블릿이네요. 아래 ';const a=document.createElement('a');a.href='#android';a.textContent='안드로이드 태블릿 앱 안내';$('platformNote').append(a,'를 따라 하세요.');$('platformNote').hidden=false;}
 else if(!/CrOS/.test(navigator.userAgent))$('platformNote').hidden=false;
 const apk=/* APK_INFO */null;if(apk){$('apkInfo').textContent='Click Studio 태블릿 앱 v'+apk.version+' · '+(apk.bytes/1048576).toFixed(1)+' MB · Android 10 이상';$('apkSigner').textContent=apk.signerSha256;}
 if(info){$('bundleInfo').textContent='Click Studio 크롬북 앱 v'+info.version+' · '+(info.bytes/1048576).toFixed(1)+' MB · 서명된 웹 앱 파일';$('bundleId').textContent=info.bundleId;}
 let timer;function toast(text){const t=$('copyToast');t.textContent=text;t.hidden=false;clearTimeout(timer);timer=setTimeout(()=>{t.hidden=true;},2200);}
 for(const button of document.querySelectorAll('[data-copy]'))button.onclick=async()=>{const text=$(button.dataset.copy).textContent.trim();try{await navigator.clipboard.writeText(text);toast('복사했어요. 새 탭 주소창에 붙여넣으세요.');}catch{const range=document.createRange();range.selectNodeContents($(button.dataset.copy));const s=getSelection();s.removeAllRanges();s.addRange(range);toast('선택된 글자를 복사(Ctrl+C)하세요.');}};
})();
