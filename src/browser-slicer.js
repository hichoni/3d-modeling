let browserSlice=null,browserSliceBusy=false,browserSliceWorker=null,browserSliceId=0,browserSliceCancel=null;
function clearBrowserSlice(){browserSliceCancel?.(Error('디자인 변경으로 계산을 취소했어요.'));browserSliceCancel=null;browserSlice=null;browserSliceBusy=false;browserSliceId++;browserSliceWorker?.terminate();browserSliceWorker=null;}
async function sliceInBrowser(){
 if(!ready()||browserSliceBusy)return;if(browserSlice?.revision===revision)return;
 browserSliceBusy=true;const mine=revision,id=String(++browserSliceId),beginAt=performance.now();renderSlice();
 let timer,worker,url;
 try{
  url=(typeof BROWSER_SLICE_WORKER_URL==='string'?BROWSER_SLICE_WORKER_URL:URL.createObjectURL(new Blob([BROWSER_SLICE_WORKER],{type:'text/javascript'})));worker=browserSliceWorker=new Worker(url);
  const bytes=toSTL(geometries()),stl=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const result=await new Promise((resolve,reject)=>{
   browserSliceCancel=reject;
   timer=setTimeout(()=>reject(Error('웹 슬라이싱 시간이 길어지고 있어요. 다른 앱을 닫고 다시 시도해주세요.')),90000);
   worker.onerror=event=>{event.preventDefault();reject(Error('웹 슬라이서 실행 중 오류가 발생했어요. 브라우저를 새로 열고 다시 시도해주세요.'));};
   worker.onmessage=event=>{const m=event.data;if(m.id!==id)return;if(m.type==='progress'){$('sliceBtn').textContent=m.message+' · '+Math.round(m.value*100)+'%';}else if(m.type==='done')resolve(m);else if(m.type==='error')reject(Error(m.message));};
   worker.postMessage({id,stl,...sliceSelection()},[stl]);
  });
  if(mine!==revision)return;
  const profile=WebPrintProfiles.fromId(result.profile),details=analyzeToolpaths(result.gcode,{height:printHeight(),strict:true,layerHeight:profile.height,size:current.w,pair:printPair()});
  browserSlice={revision:mine,gcode:result.gcode,profile:result.profile,elapsedMs:performance.now()-beginAt,slice:{...details,moves:undefined,profile:result.profile,seconds:Math.max(details.seconds,Number(result.summary?.time)||0),layerHeight:profile.height,quality:profile.quality,material:profile.material,materialLabel:profile.materialLabel,topLayers:profile.top,bottomLayers:profile.bottom,source:'browser',timeScope:'model'}};
  if(typeof coachSay==='function'&&step===1)coachSay('슬라이싱 완료! 진짜 노즐 길이에요. ▶를 눌러 한 층씩 쌓아봐요.');else toast('슬라이싱 완료! 슬라이더로 밑판부터 쌓아봐요.');beep(850);
 }catch(error){if(mine===revision)toast(error.message);}
 finally{clearTimeout(timer);if(url)URL.revokeObjectURL(url);worker?.terminate();if(browserSliceWorker===worker){browserSliceWorker=null;browserSliceCancel=null;}if(mine===revision){browserSliceBusy=false;renderSlice();renderTicket();}}
}
function saveBrowserPaths(){if(browserSlice?.revision!==revision)return;download(new Blob([browserSlice.gcode],{type:'text/plain'}),safeName(modelName())+'_경로검토용.paths.gcode');toast('경로 검토용 파일이에요. 프린터 준비·종료 동작은 포함되지 않았어요.');}
