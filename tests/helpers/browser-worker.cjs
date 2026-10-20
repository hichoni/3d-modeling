// Isolated browser-like harness for the committed worker bundle; no network or Node globals in the VM.
const {parentPort,workerData,MessageChannel}=require('node:worker_threads');
const fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({console,ArrayBuffer,DataView,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,TextEncoder,TextDecoder,URL,Blob,WebAssembly,atob,btoa,performance,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,fetch:(url,...rest)=>{if(!String(url).startsWith('data:'))throw Error('Unexpected network request: '+url);return fetch(url,...rest);},navigator:{hardwareConcurrency:2,userAgent:'worker-test'},location:{href:'https://test.invalid/worker',search:''},postMessage:value=>parentPort.postMessage(value),SharedArrayBuffer:undefined});
context.self=context;context.globalThis=context;context.MessageChannel=MessageChannel;context.importScripts=()=>{throw Error('Unexpected script import');};
vm.runInContext(fs.readFileSync(workerData.bundle,'utf8'),context);parentPort.on('message',data=>context.onmessage({data}));parentPort.postMessage({type:'loaded'});
