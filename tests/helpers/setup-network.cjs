// Deterministic CLI setup fixture. It never reads school network interfaces.
require('node:os').networkInterfaces=()=>({fixture:[{family:'IPv4',address:'192.168.50.2',internal:false}],loopback:[{family:'IPv4',address:'127.0.0.1',internal:true}]});
