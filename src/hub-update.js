// Tells the operator when the booth PC program (bridge/server.cjs, /api/bootstrap version) is older than the latest
// published one. A page served by that program itself (http://127.0.0.1:5188) is as old as the program, so the latest
// version is read from the public site (downloads/booth-version.json, written by scripts/build.cjs); offline, this
// page's own HUB_VERSION is the floor. It is only asked once a booth PC is connected (then hourly); direct
// Chromebook/tablet connections have no booth PC, are never flagged and never ask.
(function(root){
 const HUB_VERSION=10,LATEST_URL='https://hichoni.github.io/3d-modeling/downloads/booth-version.json',listeners=[];
 let latest=HUB_VERSION,timer=null;
 async function check(){
  if(root.location?.hostname==='hichoni.github.io'||typeof root.fetch!=='function')return;
  try{const r=await root.fetch(LATEST_URL,{cache:'no-store',credentials:'omit'}),d=r.ok?await r.json():null;
   if(Number.isInteger(d?.hub)&&d.hub>latest&&d.hub<1000){latest=d.hub;listeners.forEach(f=>f());}}catch{}
 }
 function watch(onChange){listeners.push(onChange);}
 function stale(boot){if(!boot||boot.direct)return false;if(!timer){timer=root.setInterval?.(check,3600000)||true;void check();}return !(boot.version>=latest);}
 const note=boot=>stale(boot)?' (지금 v'+boot.version+' · 최신 v'+latest+')':'';
 root.HubUpdate={HUB_VERSION,LATEST_URL,get latest(){return latest;},stale,note,watch,check};
})(typeof globalThis==='object'?globalThis:this);
