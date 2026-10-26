import { Engine } from '../services/coordinator/src/engine.ts';
import { createApp } from '../services/coordinator/src/app.ts';
import assert from 'node:assert/strict';

let now=Date.now();
const engine=new Engine(undefined,()=>now,{cooldownMs:0});
const app=await createApp(engine,{demo:true});
try {
  const pair=(await app.inject({method:'POST',url:'/demo/pair',payload:{},remoteAddress:'127.0.0.1'})).json().pair;
  const request=async(i:number,path:string,body?:Record<string,unknown>)=>{
    const r=await app.inject({method:body===undefined?'GET':'POST',url:path,headers:{authorization:`Bearer ${pair[i].token}`},...(body===undefined?{}:{payload:body})});
    return {code:r.statusCode,body:r.json()};
  };
  for(let i=0;i<4;i++){if(i)now+=10000;await app.inject({method:'POST',url:'/demo/sample',remoteAddress:'127.0.0.1',payload:{a:pair[0].id,b:pair[1].id}});}
  const id=(await request(0,'/v1/state')).body.offer.id;
  assert.equal((await request(0,`/v1/offers/${id}/profile`)).code,403);
  await request(0,`/v1/offers/${id}/ready`,{});await request(1,`/v1/offers/${id}/ready`,{});
  const qr=await request(0,`/v1/offers/${id}/qr`,{});
  await request(1,`/v1/offers/${id}/scan`,{challenge:qr.body.challenge});
  await request(0,`/v1/offers/${id}/confirm`,{});assert.equal((await request(0,`/v1/offers/${id}/profile`)).code,403);
  await request(1,`/v1/offers/${id}/confirm`,{});assert.equal((await request(0,`/v1/offers/${id}/profile`)).code,200);
  await request(0,`/v1/offers/${id}/block`,{});assert.equal((await request(1,`/v1/offers/${id}/profile`)).code,403);
  console.log('SIMULATION PASSED: dwell → offer → mutual readiness → QR → both confirm → authorized synthetic profile → block revocation.');
  console.log('Clock and encounter evidence were simulated. No Bluetooth, phone display, or battery claims.');
}finally{await app.close();engine.store.close();}
