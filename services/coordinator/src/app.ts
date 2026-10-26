import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { Engine, Problem, type Device } from './engine.ts';

export async function createApp(engine=new Engine(), options:{demo?:boolean}={}) {
  const app=Fastify({logger:false,bodyLimit:16384,trustProxy:false});
  const attempts=new Map<string,{at:number;count:number}>();
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer')
      .header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const origin=req.headers.origin;
    if(origin && new URL(origin).host!==req.headers.host)throw new Problem(403,'Cross-origin request rejected');
    const now=engine.now();if(attempts.size>1000)for(const [k,v] of attempts)if(now-v.at>60000)attempts.delete(k);
    const state=attempts.get(req.ip);const count=!state||now-state.at>60000?{at:now,count:1}:{...state,count:state.count+1};attempts.set(req.ip,count);
    if(count.count>300)throw new Problem(429,'Too many requests; retry in a minute');
  });
  app.setErrorHandler((error,_req,reply)=>{
    if(error instanceof Problem)return reply.code(error.status).send({error:error.message});
    const status=(error as {statusCode?:number}).statusCode;
    return reply.code(status&&status<500?status:500).send({error:status===400?'Invalid request':'Request could not be completed'});
  });
  function auth(header:string|undefined):Device {if(!header?.startsWith('Bearer '))throw new Problem(401,'Unauthorized');return engine.authenticate(header.slice(7));}
  function demo(ip:string) {if(!options.demo||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip))throw new Problem(404,'Unavailable');}
  app.get('/health',async()=>({ok:true,prototype:true,radioEvidence:'not established by server health'}));
  app.get('/v1/meta',async()=>({demo:!!options.demo,config:engine.config}));
  app.post<{Body:{invite?:unknown;platform?:unknown}}>('/v1/enroll',async req=>{
    if(req.body?.platform==='simulator')throw new Problem(400,'Use the loopback demo console for simulations');
    return engine.enroll(req.body?.invite,req.body?.platform);
  });
  app.post('/v1/session',async req=>engine.start(auth(req.headers.authorization).id));
  app.post('/v1/pause',async req=>engine.pause(auth(req.headers.authorization).id));
  app.get('/v1/state',async req=>engine.state(auth(req.headers.authorization).id));
  app.get('/v1/client-config',async req=>{
    auth(req.headers.authorization);
    const {FIREBASE_APP_ID,FIREBASE_API_KEY,FIREBASE_PROJECT_ID,FIREBASE_SENDER_ID}=process.env;
    return {firebase:FIREBASE_APP_ID&&FIREBASE_API_KEY&&FIREBASE_PROJECT_ID&&FIREBASE_SENDER_ID?{applicationId:FIREBASE_APP_ID,apiKey:FIREBASE_API_KEY,projectId:FIREBASE_PROJECT_ID,senderId:FIREBASE_SENDER_ID}:null};
  });
  app.post('/v1/encounters',async req=>engine.encounter(auth(req.headers.authorization).id,req.body));
  app.post<{Body:{platform?:unknown;token?:unknown}}>('/v1/push',async req=>engine.registerPush(auth(req.headers.authorization).id,req.body?.platform,req.body?.token));
  app.post<{Params:{id:string;action:string};Body:Record<string,unknown>}>('/v1/offers/:id/:action',async req=>{
    const result=engine.action(auth(req.headers.authorization).id,req.params.id,req.params.action,req.body??{});
    if(req.params.action==='qr' && 'challenge' in result)return {...result,png:await QRCode.toDataURL(result.challenge as string,{width:256})};
    return result;
  });
  app.get<{Params:{id:string}}>('/v1/offers/:id/profile',async req=>engine.profile(auth(req.headers.authorization).id,req.params.id));
  app.post('/demo/pair',async req=>{
    demo(req.ip);
    const pair=[0,1].map(()=>engine.enroll(engine.createInvite(),'simulator'));
    for(const d of pair)engine.start(d.id);
    return {pair,warning:'SIMULATION. No Bluetooth detection, notification display or battery evidence.'};
  });
  app.post<{Body:{a:string;b:string}}>('/demo/sample',async req=>{demo(req.ip);return engine.simulate(req.body.a,req.body.b);});
  await app.register(fastifyStatic,{root:fileURLToPath(new URL('../public/',import.meta.url)),index:'index.html'});
  return app;
}
