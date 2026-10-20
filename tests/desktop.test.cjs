const test=require('node:test'),assert=require('node:assert/strict');const {PassThrough}=require('node:stream');const {desktopControl}=require('../bridge/desktop.cjs');
test('desktop shutdown uses the private parent channel and refuses an active printer or slicer',async()=>{
 const input=new PassThrough(),output=new PassThrough();let text='',busy=true,closed=0;output.on('data',b=>text+=b);const nonce='d'.repeat(64);
 desktopControl({input,output,nonce,busy:()=>busy,close:()=>closed++});
 input.write(JSON.stringify({type:'shutdown',nonce:'wrong'})+'\n');assert.equal(text,'');
 input.write(JSON.stringify({type:'shutdown',nonce})+'\n');await new Promise(r=>setImmediate(r));assert.equal(closed,0);assert.match(text,/"ok":false/);
 busy=false;input.write(JSON.stringify({type:'shutdown',nonce})+'\n');await new Promise(r=>setImmediate(r));assert.equal(closed,1);assert.match(text,/"ok":true/);
});
