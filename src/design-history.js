/* Small, in-memory histories of editable values. Never retain meshes or print jobs. */
(function(root){
 const keys=['text','content','icon','decoration','font','tag','edge','kind','mode','layout','relief','color'];
 const snapshot=value=>Object.fromEntries(keys.map(key=>[key,value[key]]));
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 class DesignHistory{
  constructor(value,{limit=50,now=()=>Date.now()}={}){this.limit=limit;this.now=now;this.past=[];this.future=[];this.present=snapshot(value);this.breakGroup();}
  breakGroup(){this.group=null;this.at=-Infinity;}
  record(value,group=null){
   const next=snapshot(value);if(equal(next,this.present))return false;
   const now=this.now(),merge=group&&group===this.group&&now-this.at<800&&this.future.length===0;
   if(!merge){this.past.push(this.present);if(this.past.length>this.limit)this.past.shift();}
   this.present=next;this.future=[];this.group=group;this.at=now;return true;
  }
  undo(){if(!this.past.length)return null;this.future.push(this.present);this.present=this.past.pop();this.breakGroup();return {...this.present};}
  redo(){if(!this.future.length)return null;this.past.push(this.present);this.present=this.future.pop();this.breakGroup();return {...this.present};}
 }
 root.DesignHistory=DesignHistory;
 if(typeof module!=='undefined'&&module.exports)module.exports={DesignHistory};
})(globalThis);
