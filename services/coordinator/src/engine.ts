import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Store } from './store.ts';
import { transcript, sign, makeProof, type Hello, type Proof } from '../../../packages/protocol/index.ts';

const random = (n=16) => randomBytes(n).toString('hex');
const hash = (value:string) => createHash('sha256').update(value).digest('hex');
const pairKey = (a:string,b:string) => [a,b].sort().join(':');
const equal = (a:string,b:string) => /^[0-9a-f]{64}$/.test(a) && /^[0-9a-f]{64}$/.test(b) && timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
export class Problem extends Error { constructor(public status:number,message:string) { super(message); } }
function requireThat(condition: unknown, text:string, status=409): asserts condition { if(!condition) throw new Problem(status,text); }
export type Platform = 'android'|'ios'|'simulator';
export type Alias = { alias:string; device:string; session:string; from:number; until:number };
export type Session = { id:string; until:number; aliases:Alias[] };
export type Device = { id:string; tokenHash:string; proofKey:string; platform:Platform; created:number; session?:Session; lastOfferAt?:number; eligible:boolean; push?:{platform:'ios'|'android';token:string} };
export type Offer = { id:string; a:string; b:string; state:'offered'|'ready'|'connected'|'expired'|'declined'|'cancelled'|'disconnected'|'blocked'; created:number; expiresAt:number; ready:string[]; confirms:string[]; cue:string; scanned:boolean; simulated:boolean; qr?:{hash:string;issuer:string;until:number;used:boolean} };
export type Outbox = { id:string; device:string; offer:string; created:number; nextAttempt:number; attempts:number; status:'pending'|'sent'|'unconfigured'|'expired'|'failed'; error?:string; sentAt?:number };
export type Config = { dwellMs:number; freshMs:number; offerMs:number; cooldownMs:number; sessionMs:number; retentionMs:number };
export const defaults:Config = {dwellMs:30000,freshMs:30000,offerMs:120000,cooldownMs:600000,sessionMs:1800000,retentionMs:7*86400000};
export class Engine {
  readonly config:Config;
  constructor(public store=new Store(),public now:()=>number=Date.now,config:Partial<Config>={}) {this.config={...defaults,...config};}
  createInvite():string {const invite=random();this.store.put('invite',hash(invite),{id:hash(invite),at:this.now(),until:this.now()+3600000});return invite;}
  enroll(invite:unknown,platform:unknown) {
    requireThat(typeof invite==='string' && ['android','ios','simulator'].includes(String(platform)), 'Invalid enrollment',400);
    return this.store.atomic(()=>{
      const id=hash(invite), entry=this.store.get<{until:number}>('invite',id);
      requireThat(entry && entry.until>this.now(),'Invalid or expired invitation',401);
      this.store.delete('invite',id);
      const token=random(32), device:Device={id:random(),tokenHash:hash(token),proofKey:random(32),platform:platform as Platform,created:this.now(),eligible:true};
      this.store.put('device',device.id,device);return {id:device.id,token,proofKey:device.proofKey};
    });
  }
  authenticate(token:string):Device {
    const digest=hash(token);
    const d=this.store.all<Device>('device').find(d=>equal(d.tokenHash,digest));
    requireThat(d,'Unauthorized',401);return d;
  }
  device(id:string):Device {const d=this.store.get<Device>('device',id);requireThat(d,'Unknown installation',401);return d;}
  start(id:string) {
    return this.store.atomic(()=>{
      this.expire();const d=this.device(id);
      if(d.session && d.session.until>this.now())return {session:this.publicSession(d.session),now:this.now()};
      for(const e of this.store.all<{id:string}>('encounter'))if(e.id.split(':').includes(id))this.store.delete('encounter',e.id);
      const now=this.now(),end=now+this.config.sessionMs, session:Session={id:random(),until:end,aliases:[]};
      for(let from=Math.floor(now/60000)*60000;from<end;from+=60000) {
        const a:Alias={alias:random(),device:id,session:session.id,from,until:Math.min(from+60000,end)};
        this.store.put('alias',a.alias,a);session.aliases.push(a);
      }
      d.session=session;this.store.put('device',id,d);return {session:this.publicSession(session),now};
    });
  }
  publicSession(s:Session|undefined) {return s ? {id:s.id,until:s.until,aliases:s.aliases.map(({alias,from,until})=>({alias,from,until}))}:null;}
  pause(id:string) {
    return this.store.atomic(()=>{
      const d=this.device(id);if(d.session) for(const a of d.session.aliases)this.store.delete('alias',a.alias);
      d.session=undefined;this.store.put('device',id,d);
      for(const o of this.offers(id))if(this.active(o))this.finish(o,'cancelled');
      return {ok:true};
    });
  }
  private active(o:Offer) {return o.state==='offered'||o.state==='ready';}
  private available(d:Device) {return d.eligible && !!d.session && d.session.until>this.now();}
  private offers(id:string) {return this.store.all<Offer>('offer').filter(o=>o.a===id||o.b===id).sort((a,b)=>b.created-a.created||b.id.localeCompare(a.id));}
  private finish(o:Offer,state:Offer['state']) {
    o.state=state;o.qr=undefined;this.store.put('offer',o.id,o);
    this.store.db.prepare('DELETE FROM reservations WHERE offer=?').run(o.id);
  }
  expire() {
    for(const o of this.store.all<Offer>('offer'))if(this.active(o)) {
      if(o.expiresAt<=this.now())this.finish(o,'expired');
      else if(!this.available(this.device(o.a))||!this.available(this.device(o.b)))this.finish(o,'cancelled');
    }
  }
  state(id:string) {
    this.expire();const d=this.device(id);const offers=this.offers(id);
    const o=offers.find(o=>this.active(o))??offers[0];
    return {now:this.now(),session:d.session && d.session.until>this.now()?this.publicSession(d.session):null,offer:o?this.view(o,id):null,config:this.config};
  }
  private view(o:Offer,id:string) {
    const validCue=o.state==='ready' && o.expiresAt>this.now() && this.pairFresh(o);
    const job=this.store.all<Outbox>('outbox').find(j=>j.offer===o.id&&j.device===id);
    return {notificationStatus:job?.status??'none',id:o.id,state:o.state,created:o.created,expiresAt:o.expiresAt,ready:o.ready.includes(id),confirmed:o.confirms.includes(id),scanned:o.scanned,simulated:o.simulated,...(validCue?{cue:o.cue}:{} )};
  }
  private pairFresh(o:Offer) {
    const e=this.store.get<{last:number}>('encounter',pairKey(o.a,o.b));
    return !!e && this.now()-e.last<=this.config.freshMs;
  }
  private verifyHello(h:Hello):{alias:Alias;device:Device} {
    requireThat(h && typeof h.alias==='string' && /^[0-9a-f]{32}$/.test(h.alias) && typeof h.nonce==='string' && /^[0-9a-f]{32}$/.test(h.nonce) && Number.isSafeInteger(h.at),'Invalid encounter payload',400);
    requireThat(Math.abs(this.now()-h.at)<=this.config.freshMs,'Stale encounter',400);
    const alias=this.store.get<Alias>('alias',h.alias);
    requireThat(alias && h.at>=alias.from-30000 && h.at<alias.until+30000,'Expired or unknown alias',400);
    const d=this.device(alias.device);
    requireThat(this.available(d) && d.session?.id===alias.session,'Discovery is paused or expired');
    return {alias,device:d};
  }
  encounter(sender:string,input:unknown) {
    return this.store.atomic(()=>{
      this.expire();const p=input as Proof;
      requireThat(p && p.a && p.b && typeof p.sigA==='string' && typeof p.b.sig==='string','Invalid proof',400);
      const a=this.verifyHello(p.a).device,b=this.verifyHello(p.b).device;
      requireThat(a.id!==b.id && [a.id,b.id].includes(sender),'Invalid encounter participants',403);
      requireThat(!this.store.get('block',pairKey(a.id,b.id)),'Introduction unavailable');
      const text=transcript(p.a,p.b);
      requireThat(equal(sign(a.proofKey,text),p.sigA) && equal(sign(b.proofKey,text),p.b.sig),'Invalid proof signatures',403);
      const proofId=hash(text),seen=this.store.get('proof',proofId);
      if(seen)return {status:'duplicate'};
      for(const [d,h] of [[a,p.a],[b,p.b]] as const)requireThat(!this.store.get('nonce',`${d.id}:${h.nonce}`),'Reused nonce',400);
      this.store.put('proof',proofId,{id:proofId,at:this.now()});
      for(const [d,h] of [[a,p.a],[b,p.b]] as const)this.store.put('nonce',`${d.id}:${h.nonce}`,{id:`${d.id}:${h.nonce}`,at:this.now()});
      const pair=pairKey(a.id,b.id),old=this.store.get<{first:number;last:number;count:number}>('encounter',pair);
      const e=old && this.now()-old.last<=this.config.freshMs ? {...old,last:this.now(),count:old.count+1} : {first:this.now(),last:this.now(),count:1};
      this.store.put('encounter',pair,{id:pair,...e});
      if(e.count<2 || e.last-e.first<this.config.dwellMs)return {status:'observing',dwellMs:e.last-e.first};
      const sessionPair=[a,b].sort((x,y)=>x.id.localeCompare(y.id)).map(d=>d.session!.id).join(':');
      if(this.store.get('pair-session',`${pair}:${sessionPair}`))return {status:'already_offered'};
      if(this.store.db.prepare('SELECT device FROM reservations WHERE device IN (?,?)').get(a.id,b.id))return {status:'busy'};
      if([a,b].some(d=>d.lastOfferAt!==undefined && this.now()-d.lastOfferAt<this.config.cooldownMs))return {status:'cooldown'};
      const o:Offer={id:random(),a:a.id,b:b.id,state:'offered',created:this.now(),expiresAt:this.now()+this.config.offerMs,ready:[],confirms:[],cue:['Leaf · Maple','Moon · Orbit','Star · Comet'][randomBytes(1)[0]%3],scanned:false,simulated:a.platform==='simulator'||b.platform==='simulator'};
      this.store.put('offer',o.id,o);this.store.put('pair-session',`${pair}:${sessionPair}`,{id:`${pair}:${sessionPair}`,at:this.now()});
      for(const d of [a,b]) {
        this.store.db.prepare('INSERT INTO reservations VALUES(?,?)').run(d.id,o.id);d.lastOfferAt=this.now();this.store.put('device',d.id,d);
        const job:Outbox={id:random(),device:d.id,offer:o.id,created:this.now(),nextAttempt:this.now(),attempts:0,status:'pending'};this.store.put('outbox',job.id,job);
      }
      return {status:'offered',offerId:o.id};
    });
  }
  private authorize(id:string,offerId:string) {
    const o=this.store.get<Offer>('offer',offerId);requireThat(o && [o.a,o.b].includes(id),'Introduction unavailable',404);return o;
  }
  private current(o:Offer) {
    requireThat(this.active(o) && o.expiresAt>this.now(),'Introduction is no longer available');
    requireThat(this.available(this.device(o.a))&&this.available(this.device(o.b))&&!this.store.get('block',pairKey(o.a,o.b)),'Introduction is no longer available');
  }
  action(id:string,offerId:string,action:string,body:Record<string,unknown>={}) {
    // Expiry is committed even when a subsequent rejected action rolls back.
    this.expire();
    return this.store.atomic(()=>{
      const o=this.authorize(id,offerId);
      if(action==='block') {this.store.put('block',pairKey(o.a,o.b),{id:pairKey(o.a,o.b),at:this.now()});this.finish(o,'blocked');return this.view(o,id);}
      if(action==='disconnect') {requireThat(o.state==='connected','Not connected');this.finish(o,'disconnected');return this.view(o,id);}
      this.current(o);
      if(action==='decline') {this.finish(o,'declined');return this.view(o,id);}
      requireThat(this.pairFresh(o),'Encounter evidence is no longer fresh');
      if(action==='ready') {
        if(!o.ready.includes(id))o.ready.push(id);
        if(o.ready.length===2)o.state='ready';
      } else if(action==='qr') {
        requireThat(o.state==='ready','Both participants must be ready');
        const challenge=random(24);o.qr={hash:hash(challenge),issuer:id,until:Math.min(o.expiresAt,this.now()+30000),used:false};
        o.scanned=false;o.confirms=[];this.store.put('offer',o.id,o);return {challenge,expiresAt:o.qr.until};
      } else if(action==='scan') {
        requireThat(o.state==='ready' && o.qr && !o.qr.used && o.qr.issuer!==id && o.qr.until>this.now() && typeof body.challenge==='string' && equal(o.qr.hash,hash(body.challenge)),'Invalid or expired connection challenge');
        o.qr.used=true;o.scanned=true;
      } else if(action==='confirm') {
        requireThat(o.state==='ready' && o.scanned && o.qr && o.qr.until>this.now(),'Scan a current connection challenge first');
        if(!o.confirms.includes(id))o.confirms.push(id);
        if(o.confirms.length===2)this.finish(o,'connected');
      } else throw new Problem(404,'Unknown action');
      this.store.put('offer',o.id,o);return this.view(o,id);
    });
  }
  profile(id:string,offerId:string) {
    const o=this.authorize(id,offerId);
    requireThat(o.state==='connected'&&!this.store.get('block',pairKey(o.a,o.b)),'Profile is hidden',403);
    return {profile:{name:'Synthetic café participant',about:'Test profile only. Both participants deliberately connected.',interests:['Coffee','Conversation']}};
  }
  registerPush(id:string,platform:unknown,token:unknown) {
    requireThat(['ios','android'].includes(String(platform)) && typeof token==='string' && token.length>=16 && token.length<=4096,'Invalid push registration',400);
    const d=this.device(id);requireThat(d.platform===platform,'Platform mismatch',400);d.push={platform:platform as 'ios'|'android',token};this.store.put('device',id,d);return {ok:true};
  }
  simulate(aId:string,bId:string) {
    const a=this.device(aId),b=this.device(bId);requireThat(a.platform==='simulator'&&b.platform==='simulator','Simulation requires two simulator installations',403);
    const alias=(d:Device)=>d.session?.aliases.find(x=>x.from<=this.now()&&this.now()<x.until)?.alias;
    const aa=alias(a),bb=alias(b);requireThat(aa&&bb,'Start both sessions first');
    return this.encounter(a.id,makeProof({alias:aa,proofKey:a.proofKey},{alias:bb,proofKey:b.proofKey},this.now()));
  }
  cleanup() {
    this.expire();const cutoff=this.now()-this.config.retentionMs;let removed=false;
    for(const kind of ['invite','proof','nonce','encounter','pair-session','outbox','offer','block','alias','device']) {
      for(const r of this.store.all<Record<string,unknown>>(kind)) {
        const when=Number(r.at??r.last??r.created??r.from??r.until??0);
        if(when<cutoff) {removed=true;this.store.delete(kind,String(r.id??r.alias));if(kind==='device')this.store.db.prepare('DELETE FROM reservations WHERE device=?').run(String(r.id));}
      }
    }
    if(removed){this.store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');this.store.db.exec('VACUUM');}
  }
}
