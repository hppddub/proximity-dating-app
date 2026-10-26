import { createApp } from './app.ts';
import { Engine } from './engine.ts';
import { Store } from './store.ts';
import { drainOutbox } from './push.ts';

process.umask(0o077);
const host=process.env.HOST??'127.0.0.1',demo=process.env.DEMO_MODE==='true';
if(demo&&!['127.0.0.1','::1'].includes(host))throw Error('DEMO_MODE requires a loopback listen host');
const engine=new Engine(new Store(process.env.DB_PATH??'data/prototype.sqlite'));
const app=await createApp(engine,{demo});
engine.cleanup();
let draining=false;
const worker=setInterval(async()=>{if(draining)return;draining=true;try{await drainOutbox(engine);}catch{console.error('Outbox worker failed; jobs remain durable');}finally{draining=false;}},1000);
const cleanup=setInterval(()=>engine.cleanup(),60000);
app.addHook('onClose',async()=>{clearInterval(worker);clearInterval(cleanup);engine.store.close();});
await app.listen({host,port:Number(process.env.PORT??8787)});
console.log(`Proximity Lab: http://${host}:${process.env.PORT??8787} — ${demo?'LOOPBACK SIMULATION ENABLED':'native trials; simulation disabled'}`);
console.log('Physical Bluetooth, notification display, and battery results are unmeasured.');
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{void app.close();});
