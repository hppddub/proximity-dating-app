import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Engine, type Device, type Offer, type Outbox } from '../src/engine.ts';
import { Store } from '../src/store.ts';
import { makeProof, sign, transcript, type Proof } from '../../../packages/protocol/index.ts';
import { createApp } from '../src/app.ts';
import { drainOutbox } from '../src/push.ts';

function fixture(config={}) {
  let clock=1793000000000;
  const engine=new Engine(new Store(),()=>clock,{cooldownMs:0,...config});
  const a=engine.enroll(engine.createInvite(),'simulator'),b=engine.enroll(engine.createInvite(),'simulator');
  engine.start(a.id);engine.start(b.id);
  const tick=(ms:number)=>{clock+=ms;};
  const proof=(x=a,y=b):Proof=>{
    const alias=(id:string)=>engine.device(id).session!.aliases.find(x=>x.from<=clock&&clock<x.until)!.alias;
    return makeProof({alias:alias(x.id),proofKey:x.proofKey},{alias:alias(y.id),proofKey:y.proofKey},clock);
  };
  const sample=(x=a,y=b)=>engine.encounter(x.id,proof(x,y));
  const offer=()=>{sample();tick(10000);sample();tick(10000);sample();tick(10000);sample();return engine.state(a.id).offer!.id;};
  const ready=(id:string)=>{engine.action(a.id,id,'ready');engine.action(b.id,id,'ready');};
  const scan=(id:string)=>{const r=engine.action(a.id,id,'qr');assert.ok('challenge'in r);engine.action(b.id,id,'scan',{challenge:r.challenge});return r.challenge;};
  return {engine,a,b,tick,proof,sample,offer,ready,scan};
}

test('invitation is single use and expires; API credentials authenticate',()=>{
  const f=fixture(),invite=f.engine.createInvite(),d=f.engine.enroll(invite,'ios');
  assert.equal(f.engine.authenticate(d.token).id,d.id);assert.throws(()=>f.engine.enroll(invite,'ios'));
  const expired=f.engine.createInvite();f.tick(3600001);assert.throws(()=>f.engine.enroll(expired,'android'));
  assert.throws(()=>f.engine.authenticate('bad'));
});
test('discovery and dwell do not reveal a profile or recognition cue',()=>{
  const f=fixture();assert.equal(f.sample().status,'observing');const id=f.offer();
  assert.equal(f.engine.state(f.a.id).offer?.state,'offered');assert.ok(!('cue'in f.engine.state(f.a.id).offer!));
  assert.throws(()=>f.engine.profile(f.a.id,id));
  f.engine.action(f.a.id,id,'ready');assert.ok(!('cue'in f.engine.state(f.a.id).offer!));
  f.engine.action(f.b.id,id,'ready');assert.ok(f.engine.state(f.a.id).offer?.cue);
});
test('identical proof cannot advance dwell and reused nonce with changed transcript is rejected',()=>{
  const f=fixture(),p=f.proof();f.engine.encounter(f.a.id,p);f.tick(10000);
  assert.equal(f.engine.encounter(f.b.id,p).status,'duplicate');
  const changed=f.proof();changed.a.nonce=p.a.nonce;
  changed.sigA=sign(f.a.proofKey,transcript(changed.a,changed.b));changed.b.sig=sign(f.b.proofKey,transcript(changed.a,changed.b));
  assert.throws(()=>f.engine.encounter(f.a.id,changed),/Reused nonce/);
});
test('signature tampering, outsider submission, own-device pairing and stale timestamps are rejected',()=>{
  const f=fixture(),p=f.proof();p.sigA='0'.repeat(64);assert.throws(()=>f.engine.encounter(f.a.id,p),/signatures/);
  const c=f.engine.enroll(f.engine.createInvite(),'simulator');assert.throws(()=>f.engine.encounter(c.id,f.proof()),/participants/);
  const own=f.proof(f.a,f.a);assert.throws(()=>f.engine.encounter(f.a.id,own));
  const stale=f.proof();f.tick(30001);assert.throws(()=>f.engine.encounter(f.a.id,stale),/Stale/);
});
test('a gap in observation resets dwell; no timer-only offer',()=>{
  const f=fixture();f.sample();f.tick(60000);assert.equal(f.sample().dwellMs,0);assert.equal(f.engine.state(f.a.id).offer,null);
});
test('two-sided confirmation and a current scanned QR are required',()=>{
  const f=fixture(),id=f.offer();f.ready(id);assert.throws(()=>f.engine.action(f.a.id,id,'confirm'));
  f.scan(id);f.engine.action(f.a.id,id,'confirm');assert.throws(()=>f.engine.profile(f.a.id,id));
  f.engine.action(f.b.id,id,'confirm');assert.equal(f.engine.profile(f.a.id,id).profile.name,'Synthetic café participant');
  assert.equal(f.engine.store.db.prepare('SELECT * FROM reservations').all().length,0);
});
test('QR cannot be scanned by issuer, outsider, reused, guessed or used after expiration',()=>{
  const f=fixture(),id=f.offer();f.ready(id);const r=f.engine.action(f.a.id,id,'qr');assert.ok('challenge'in r);
  assert.throws(()=>f.engine.action(f.a.id,id,'scan',{challenge:r.challenge}));
  assert.throws(()=>f.engine.action('outsider',id,'scan',{challenge:r.challenge}));
  assert.throws(()=>f.engine.action(f.b.id,id,'scan',{challenge:'guess'}));
  f.engine.action(f.b.id,id,'scan',{challenge:r.challenge});assert.throws(()=>f.engine.action(f.b.id,id,'scan',{challenge:r.challenge}));
  f.tick(30001);assert.throws(()=>f.engine.action(f.a.id,id,'confirm'));
});
test('expiry is authoritative before cleanup and cannot be revived',()=>{
  const f=fixture(),id=f.offer();f.ready(id);f.scan(id);f.tick(120000);
  assert.throws(()=>f.engine.action(f.a.id,id,'confirm'));assert.equal(f.engine.state(f.a.id).offer?.state,'expired');assert.throws(()=>f.engine.profile(f.a.id,id));
});
test('pause wins against a pending connection and cancels both views',()=>{
  const f=fixture(),id=f.offer();f.ready(id);f.scan(id);f.engine.action(f.a.id,id,'confirm');f.engine.pause(f.b.id);
  assert.throws(()=>f.engine.action(f.b.id,id,'confirm'));assert.equal(f.engine.state(f.a.id).offer?.state,'cancelled');assert.throws(()=>f.engine.profile(f.a.id,id));
});
test('block revokes connected profile access and suppresses future offers',()=>{
  const f=fixture(),id=f.offer();f.ready(id);f.scan(id);f.engine.action(f.a.id,id,'confirm');f.engine.action(f.b.id,id,'confirm');
  f.engine.action(f.a.id,id,'block');assert.throws(()=>f.engine.profile(f.b.id,id));assert.throws(()=>f.sample(),/unavailable/);
});
test('freshness is rechecked for readiness and cue access',()=>{
  const f=fixture(),id=f.offer();f.ready(id);f.tick(30001);assert.ok(!('cue'in f.engine.state(f.a.id).offer!));assert.throws(()=>f.engine.action(f.a.id,id,'qr'),/fresh/);
});
test('competing pairs reserve the shared person atomically',()=>{
  const f=fixture(),c=f.engine.enroll(f.engine.createInvite(),'simulator');f.engine.start(c.id);
  f.sample();f.sample(f.a,c);f.tick(30000);assert.equal(f.sample().status,'offered');assert.equal(f.sample(f.a,c).status,'busy');
  assert.equal(f.engine.store.all<Offer>('offer').length,1);assert.equal(f.engine.store.db.prepare('SELECT * FROM reservations').all().length,2);
});
test('multiple sequential introductions are supported, while repeat pair/session is suppressed in either direction',()=>{
  const f=fixture(),id=f.offer();f.engine.action(f.a.id,id,'decline');assert.equal(f.sample(f.b,f.a).status,'already_offered');
  const c=f.engine.enroll(f.engine.createInvite(),'simulator');f.engine.start(c.id);f.sample(f.a,c);f.tick(30000);assert.equal(f.sample(f.a,c).status,'offered');
});
test('cooldown applies across pairs and ends at its configured boundary',()=>{
  const f=fixture({cooldownMs:600000}),id=f.offer();f.engine.action(f.a.id,id,'decline');
  const c=f.engine.enroll(f.engine.createInvite(),'simulator');f.engine.start(c.id);f.sample(f.a,c);f.tick(30000);assert.equal(f.sample(f.a,c).status,'cooldown');
  f.tick(600000);f.sample(f.a,c);f.tick(30000);assert.equal(f.sample(f.a,c).status,'offered');
});
test('paused, expired and synthetic-ineligible sessions cannot produce offers',()=>{
  const f=fixture();f.engine.pause(f.a.id);assert.throws(()=>f.sample());
  const g=fixture();g.tick(1800001);assert.throws(()=>g.sample());
  const h=fixture(),d=h.engine.device(h.a.id);d.eligible=false;h.engine.store.put('device',d.id,d);assert.throws(()=>h.sample());
});
test('expired sessions cancel pending offers even before offer TTL',()=>{
  const f=fixture({sessionMs:40000}),id=f.offer();f.tick(10001);assert.equal(f.engine.state(f.a.id).offer?.state,'cancelled');assert.throws(()=>f.engine.action(f.a.id,id,'ready'));
});
test('proof verification and offer/outbox creation roll back together on write failure',()=>{
  const f=fixture();f.sample();f.tick(30000);
  f.engine.store.db.exec("CREATE TRIGGER reject_outbox BEFORE INSERT ON records WHEN NEW.kind='outbox' BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  const p=f.proof();assert.throws(()=>f.engine.encounter(f.a.id,p));
  assert.equal(f.engine.store.all('offer').length,0);assert.equal(f.engine.store.db.prepare('SELECT * FROM reservations').all().length,0);
  f.engine.store.db.exec('DROP TRIGGER reject_outbox');assert.equal(f.engine.encounter(f.a.id,p).status,'offered');
});
test('durable state and outbox survive process-style reopen',()=>{
  const directory=mkdtempSync(join(tmpdir(),'proximity-')),path=join(directory,'db.sqlite');
  try {const first=new Engine(new Store(path));const d=first.enroll(first.createInvite(),'android');first.start(d.id);first.store.close();
    const second=new Engine(new Store(path));assert.equal(second.authenticate(d.token).id,d.id);assert.ok(second.state(d.id).session);second.store.close();
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('push worker distinguishes unconfigured, retry, sent and expired without exposing provider errors',async()=>{
  const f=fixture(),id=f.offer();await drainOutbox(f.engine,async()=> 'unconfigured');
  assert.ok(f.engine.store.all<Outbox>('outbox').every(j=>j.status==='unconfigured'));
  f.tick(30000);await drainOutbox(f.engine,async()=>{throw Error('sensitive provider message');});
  assert.ok(f.engine.store.all<Outbox>('outbox').every(j=>j.status==='pending'&&!j.error?.includes('sensitive')));
  f.tick(5000);await drainOutbox(f.engine,async()=> 'sent');assert.ok(f.engine.store.all<Outbox>('outbox').every(j=>j.status==='sent'));
  f.engine.action(f.a.id,id,'decline');let calls=0;await drainOutbox(f.engine,async()=>{calls++;return 'sent';});assert.equal(calls,0);
});
test('late unsent push jobs expire instead of sending stale offers',async()=>{
  const f=fixture();f.offer();f.tick(120000);let calls=0;
  await drainOutbox(f.engine,async()=>{calls++;return 'sent';});assert.equal(calls,0);assert.ok(f.engine.store.all<Outbox>('outbox').every(j=>j.status==='expired'));
});
test('retention cleanup removes raw state and credentials after seven days',()=>{
  const f=fixture();f.offer();f.tick(8*86400000);f.engine.cleanup();
  assert.equal(f.engine.store.all('proof').length,0);assert.equal(f.engine.store.all('device').length,0);assert.equal(f.engine.store.all('offer').length,0);
});
test('HTTP routes enforce authentication, origin, membership and loopback simulation separation',async()=>{
  const f=fixture(),app=await createApp(f.engine,{demo:false});
  try {
    assert.equal((await app.inject('/v1/state')).statusCode,401);
    assert.equal((await app.inject({method:'POST',url:'/demo/pair',payload:{}})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url:'/v1/pause',headers:{origin:'https://attacker.example',authorization:`Bearer ${f.a.token}`},payload:{}})).statusCode,403);
    const r=await app.inject({url:'/v1/state',headers:{authorization:`Bearer ${f.a.token}`}});assert.equal(r.statusCode,200);assert.ok(!r.body.includes('proofKey'));assert.ok(!r.body.includes('tokenHash'));
    const native=f.engine.enroll(f.engine.createInvite(),'android');assert.throws(()=>f.engine.simulate(f.a.id,native.id),/simulator/);
  }finally{await app.close();}
});
test('loopback console can complete the same gated HTTP flow with clearly simulated evidence',async()=>{
  const f=fixture(),app=await createApp(f.engine,{demo:true});
  try {
    const p=(await app.inject({method:'POST',url:'/demo/pair',payload:{},remoteAddress:'127.0.0.1'})).json().pair;
    const headers=(i:number)=>({authorization:`Bearer ${p[i].token}`});
    const call=(i:number,url:string,payload={})=>app.inject({method:'POST',url,headers:headers(i),payload});
    for(let n=0;n<4;n++){if(n)f.tick(10000);const r=await app.inject({method:'POST',url:'/demo/sample',payload:{a:p[0].id,b:p[1].id},remoteAddress:'127.0.0.1'});assert.equal(r.statusCode,200);}
    const state=(await app.inject({url:'/v1/state',headers:headers(0)})).json();const id=state.offer.id;assert.equal(state.offer.simulated,true);
    await call(0,`/v1/offers/${id}/ready`);await call(1,`/v1/offers/${id}/ready`);
    const qr=(await call(0,`/v1/offers/${id}/qr`)).json();assert.ok(qr.png.startsWith('data:image/png;base64,'));
    await call(1,`/v1/offers/${id}/scan`,{challenge:qr.challenge});await call(0,`/v1/offers/${id}/confirm`);await call(1,`/v1/offers/${id}/confirm`);
    const profile=await app.inject({url:`/v1/offers/${id}/profile`,headers:headers(0)});assert.equal(profile.statusCode,200);assert.ok(profile.body.includes('Synthetic'));
  }finally{await app.close();}
});

test('Node signs the published Android and Swift interoperability vector',()=>{
  const v=JSON.parse(readFileSync(new URL('../../../packages/protocol/golden.json',import.meta.url),'utf8'));assert.equal(sign(v.key,v.transcript),v.signature);
});
test('resuming an existing session retains deadline and aliases',()=>{
  const f=fixture(),before=f.engine.state(f.a.id).session;f.tick(10000);const resumed=f.engine.start(f.a.id).session;assert.deepEqual(resumed,before);
});

test('confirmation retry after a lost success response is safe, but a later block still wins',()=>{
 const f=fixture(),id=f.offer();f.ready(id);f.scan(id);f.engine.action(f.a.id,id,'confirm');f.engine.action(f.b.id,id,'confirm');
 const retried=f.engine.action(f.b.id,id,'confirm');assert.ok('state'in retried);assert.equal(retried.state,'connected');f.engine.action(f.a.id,id,'block');assert.throws(()=>f.engine.action(f.b.id,id,'confirm'));
});
