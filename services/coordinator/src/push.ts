import { createPrivateKey, createSign } from 'node:crypto';
import { connect } from 'node:http2';
import { readFileSync } from 'node:fs';
import { Engine, type Device, type Offer, type Outbox } from './engine.ts';

export type Delivery = (device:Device,offer:Offer)=>Promise<'sent'|'unconfigured'>;
const b64=(x:unknown)=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
let oauth:{token:string;until:number}|undefined;
async function fcm(device:Device,offer:Offer):Promise<'sent'|'unconfigured'> {
  if(!process.env.FCM_SERVICE_ACCOUNT_FILE)return 'unconfigured';
  const sa=JSON.parse(readFileSync(process.env.FCM_SERVICE_ACCOUNT_FILE,'utf8')) as {client_email:string;private_key:string;project_id:string};
  if(!oauth || oauth.until<Date.now()+60000) {
    const now=Math.floor(Date.now()/1000);
    const unsigned=`${b64({alg:'RS256',typ:'JWT'})}.${b64({iss:sa.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
    const signature=createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${signature}`}),signal:AbortSignal.timeout(10000)});
    const result=await response.json() as {access_token:string;expires_in:number};
    if(!response.ok || !result.access_token)throw Error('FCM OAuth request rejected');
    oauth={token:result.access_token,until:Date.now()+result.expires_in*1000};
  }
  const ttl=Math.max(0,Math.floor((offer.expiresAt-Date.now())/1000));
  const result=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`,{
    method:'POST',headers:{Authorization:`Bearer ${oauth.token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
    body:JSON.stringify({message:{token:device.push!.token,data:{offerId:offer.id,expiresAt:String(offer.expiresAt)},android:{priority:'high',ttl:`${ttl}s`,collapse_key:'proximity-introduction'}}})
  });
  if(!result.ok)throw Error(`FCM status ${result.status}`);return 'sent';
}
async function apns(device:Device,offer:Offer):Promise<'sent'|'unconfigured'> {
  const {APNS_KEY_FILE,APNS_KEY_ID,APNS_TEAM_ID,APNS_TOPIC}=process.env;
  if(!APNS_KEY_FILE||!APNS_KEY_ID||!APNS_TEAM_ID||!APNS_TOPIC)return 'unconfigured';
  const unsigned=`${b64({alg:'ES256',kid:APNS_KEY_ID})}.${b64({iss:APNS_TEAM_ID,iat:Math.floor(Date.now()/1000)})}`;
  const jwt=`${unsigned}.${createSign('SHA256').update(unsigned).sign({key:createPrivateKey(readFileSync(APNS_KEY_FILE)),dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
  await new Promise<void>((resolve,reject)=>{
    const client=connect(process.env.APNS_PRODUCTION==='true'?'https://api.push.apple.com':'https://api.sandbox.push.apple.com');
    const finish=(error?:Error)=>{client.close();error?reject(error):resolve();};
    client.on('error',e=>finish(e));
    const req=client.request({':method':'POST',':path':`/3/device/${device.push!.token}`,authorization:`bearer ${jwt}`,'apns-topic':APNS_TOPIC,'apns-push-type':'alert','apns-priority':'10','apns-expiration':String(Math.floor(offer.expiresAt/1000)),'apns-collapse-id':'proximity-introduction'});
    let status=0;req.on('response',h=>{status=Number(h[':status']);});req.on('data',()=>{});req.on('end',()=>finish(status===200?undefined:Error(`APNs status ${status}`)));req.on('error',e=>finish(e));
    req.setTimeout(10000,()=>{req.close();finish(Error('APNs timeout'));});
    req.end(JSON.stringify({aps:{alert:{title:'An introduction may be available',body:'Open to check.'},sound:'default'},offerId:offer.id,expiresAt:offer.expiresAt}));
  });
  return 'sent';
}
export const deliver:Delivery=async(d,o)=>!d.push?'unconfigured':d.push.platform==='ios'?apns(d,o):fcm(d,o);
export async function drainOutbox(engine:Engine,send:Delivery=deliver):Promise<void> {
  engine.expire();
  for(const initial of engine.store.all<Outbox>('outbox')) {
    if(!['pending','unconfigured'].includes(initial.status)||initial.nextAttempt>engine.now())continue;
    const job=engine.store.get<Outbox>('outbox',initial.id)!;
    const offer=engine.store.get<Offer>('offer',job.offer);
    if(!offer||!['offered','ready'].includes(offer.state)||offer.expiresAt<=engine.now()) {job.status='expired';engine.store.put('outbox',job.id,job);continue;}
    try {
      job.status=await send(engine.device(job.device),offer);
      if(job.status==='sent') {job.sentAt=engine.now();job.attempts++;}
      else job.nextAttempt=engine.now()+30000;
    } catch {
      job.attempts++;job.error='Push provider request failed';
      job.status=job.attempts>=5?'failed':'pending';job.nextAttempt=engine.now()+Math.min(30000,1000*2**job.attempts);
    }
    engine.store.put('outbox',job.id,job);
  }
}
