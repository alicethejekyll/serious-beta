import {readConfig} from './config.js';import {poolFor,assertRuntimeRole} from './db.js';import {createApp} from './app.js';
const config=readConfig();const pool=poolFor(config);await assertRuntimeRole(pool);
const server=createApp(pool,config).listen(config.port,'0.0.0.0',()=>console.log(JSON.stringify({event:'server.ready',port:config.port,mode:config.mock?'mock':'real'})));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{void pool.end().then(()=>process.exit(0));}));
