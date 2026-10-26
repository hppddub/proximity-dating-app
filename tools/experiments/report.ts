import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export type Trial = {kind:'trial';trial:string;pairing:string;devicePair:string;state:string;entryAt:number;departureAt:number;displayAAt?:number;displayBAt?:number;negative?:boolean;offerCreated?:boolean;simulated?:boolean};
export type Battery = {kind:'battery';device:string;condition:'idle'|'discovery';startPercent:number;endPercent:number;durationHours:number;simulated?:boolean};
export type RecordLine=Trial|Battery;
function valid(condition:unknown,message:string):asserts condition {if(!condition)throw Error(message);}
const label=(s:unknown)=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,50}$/.test(s);
export function parseRecords(text:string):RecordLine[] {
  const records=text.trim()?text.trim().split('\n').map((s,i)=>{try{return JSON.parse(s);}catch{throw Error(`Invalid JSON on line ${i+1}`);}}):[];
  const seen=new Set<string>();
  for(const r of records) {
    valid(r && typeof r==='object','Expected observer records');
    valid(!['lat','lon','latitude','longitude','token','proofKey','address','name'].some(k=>k in r),'Sensitive fields are not accepted in observer reports');
    if(r.kind==='trial') {
      valid(label(r.trial)&&label(r.pairing)&&label(r.devicePair)&&label(r.state),'Use pseudonymous trial/device labels');
      valid(!seen.has(r.trial),'Duplicate trial ID');seen.add(r.trial);
      valid(Number.isFinite(r.entryAt)&&Number.isFinite(r.departureAt)&&r.departureAt>=r.entryAt,'Invalid ground-truth interval');
      for(const field of ['displayAAt','displayBAt'])if(r[field]!==undefined)valid(Number.isFinite(r[field])&&r[field]>=r.entryAt,'Display precedes entry');
      valid(r.negative===undefined||typeof r.negative==='boolean','Invalid negative control flag');
      valid(r.offerCreated===undefined||typeof r.offerCreated==='boolean','Invalid offer flag');
    } else if(r.kind==='battery') {
      valid(label(r.device)&&['idle','discovery'].includes(r.condition),'Invalid battery condition');
      valid(Number.isFinite(r.startPercent)&&Number.isFinite(r.endPercent)&&r.startPercent<=100&&r.endPercent>=0&&r.startPercent>=r.endPercent,'Invalid battery readings');
      valid(Number.isFinite(r.durationHours)&&Math.abs(r.durationHours-8)<=0.1,'Battery gate requires comparable eight-hour runs');
    } else throw Error('Unknown record kind; supply observer trials or battery runs, not raw radio logs');
    valid(r.simulated===undefined||typeof r.simulated==='boolean','Invalid simulation flag');
  }
  return records;
}
export function summarize(records:RecordLine[]) {
  const excluded=records.filter(r=>r.simulated).length;
  const trials=records.filter((r):r is Trial=>r.kind==='trial'&&!r.simulated);
  const groups=new Map<string,Trial[]>();
  for(const t of trials){const key=`${t.pairing}/${t.devicePair}/${t.state}`;groups.set(key,[...(groups.get(key)??[]),t]);}
  const results=[...groups].map(([group,ts])=>{
    const positives=ts.filter(t=>!t.negative),controls=ts.filter(t=>t.negative);
    const latency=(t:Trial)=>t.displayAAt===undefined||t.displayBAt===undefined?undefined:Math.max(t.displayAAt,t.displayBAt)-t.entryAt;
    const success=(t:Trial,ms:number)=>{const n=latency(t);return n!==undefined&&n<=ms&&Math.max(t.displayAAt!,t.displayBAt!)<=t.departureAt;};
    const observed=positives.map(latency).filter((n):n is number=>n!==undefined).sort((a,b)=>a-b);
    const n=positives.length,within60=positives.filter(t=>success(t,60000)).length,within120=positives.filter(t=>success(t,120000)).length;
    return {group,n,within60,within120,missed:positives.filter(t=>latency(t)===undefined).length,controls:controls.length,wrongOffers:controls.filter(t=>t.offerCreated).length,
      medianObservedMs:observed.length?(observed[Math.floor((observed.length-1)/2)]+observed[Math.floor(observed.length/2)])/2:null,
      p95ObservedMs:observed.length>=20?observed[Math.ceil(observed.length*.95)-1]:null,
      timingGate:n>=30?(within60/n>=.9&&within120/n>=.95?'preliminary pass':'fail'):'insufficient sample',
      controlGate:controls.length>=30?(controls.filter(t=>t.offerCreated).length/controls.length<=.05?'preliminary pass':'fail'):'insufficient sample'};
  });
  const battery=records.filter((r):r is Battery=>r.kind==='battery'&&!r.simulated);
  const devices=[...new Set(battery.map(r=>r.device))];
  const batteries=devices.map(device=>{
    const runs=(condition:Battery['condition'])=>battery.filter(r=>r.device===device&&r.condition===condition).map(r=>(r.startPercent-r.endPercent)*8/r.durationHours);
    const idle=runs('idle'),discovery=runs('discovery'),mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
    const additional=idle.length&&discovery.length?mean(discovery)-mean(idle):null;
    return {device,idleRuns:idle.length,discoveryRuns:discovery.length,additionalPoints:additional,idleDrops:idle,discoveryDrops:discovery,gate:idle.length>=3&&discovery.length>=3?(additional!<=3?'preliminary pass':'fail'):'insufficient sample'};
  });
  return {excludedSimulations:excluded,results,batteries};
}
export function markdown(report:ReturnType<typeof summarize>):string {
  const lines=['# Feasibility observations','',`Excluded simulated records: ${report.excludedSimulations}. No simulated result counts as phone evidence.`,'',
    '| Pair/device/state | Encounters | Both ≤60s | Both ≤120s | Missing displays | Controls / wrong offers | Timing | Context |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- | --- |'];
  for(const r of report.results)lines.push(`| ${r.group} | ${r.n} | ${r.within60} | ${r.within120} | ${r.missed} | ${r.controls} / ${r.wrongOffers} | ${r.timingGate} | ${r.controlGate} |`);
  if(!report.results.length)lines.push('','No physical-device trial evidence supplied.');
  lines.push('','Latency summaries describe observed displays only; misses remain in the gate denominator. p95 is withheld below 20 observed bilateral displays. Small samples do not establish population reliability.','',
    '| Battery device | Idle / discovery runs | Additional points / 8h | Gate |','| --- | --- | ---: | --- |');
  for(const r of report.batteries)lines.push(`| ${r.device} | ${r.idleRuns} / ${r.discoveryRuns} | ${r.additionalPoints?.toFixed(2)??'unknown'} | ${r.gate} |`);
  lines.push('','Keep baseline/discovery conditions comparable. Temperature and OS energy diagnostics require separate review.','');return lines.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const path=process.argv[2];if(!path)throw Error('Usage: npm run report -- /path/to/observer.jsonl [--json]');
  const report=summarize(parseRecords(readFileSync(path,'utf8')));console.log(process.argv.includes('--json')?JSON.stringify(report,null,2):markdown(report));
}
