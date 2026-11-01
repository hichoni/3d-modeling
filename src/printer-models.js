// Bambu Lab printers the workshop knows, from Bambu Studio's BBL profiles (02.08.00.09: machine/<model>.json and its
// "0.4 nozzle" machine). Shared by the browser (discovery, relay, print card) and the booth PC.
// Only a model with a reviewed, physically tested machine wrapper prints ('verified'). The others can be found, connected
// and watched, but printing stays locked until their start/end G-code is rendered from the official template (kept in
// bridge/profiles/<id>-source.json), reviewed and test-printed: a wrong wrapper can drive the nozzle into the bed.
(function(root){
const MODELS=[
 {id:'a1-mini',name:'A1 mini',codes:['N1'],printerModel:'Bambu Lab A1 mini',bed:[180,180],height:180,nozzles:1,status:'verified'},
 {id:'a1',name:'A1',codes:['N2S'],printerModel:'Bambu Lab A1',bed:[256,256],height:256,nozzles:1,status:'prepared'},
 {id:'x1c',name:'X1C',codes:['BL-P001','3DPrinter-X1-Carbon','BL'],printerModel:'Bambu Lab X1 Carbon',bed:[256,256],height:250,nozzles:1,status:'prepared'},
 {id:'p2s',name:'P2S',codes:['N7'],printerModel:'Bambu Lab P2S',bed:[256,256],height:256,nozzles:1,status:'prepared'},
 {id:'x2d',name:'X2D',codes:['N6'],printerModel:'Bambu Lab X2D',bed:[256,256],height:261,nozzles:2,status:'prepared'},
];
const byCode=new Map(MODELS.flatMap(m=>m.codes.map(c=>[c,m])));
// A model from an SSDP DevModel or MQTT product code. Printers registered before models were stored were all A1 mini.
function fromCode(code){return byCode.get(String(code||'').trim())||null;}
function byId(id){return MODELS.find(m=>m.id===id)||null;}
function printable(model){return model?.status==='verified';}
function lockedReason(model){return model?printable(model)?'':model.name+'은(는) 연결과 상태 확인만 돼요. 이 기종의 출력 설정은 아직 실제 출력 검증 전이라, 지금은 A1 mini로만 출력할 수 있어요.':'지원하지 않는 프린터예요.';}
const api={MODELS,fromCode,byId,printable,lockedReason};
root.PrinterModels=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
