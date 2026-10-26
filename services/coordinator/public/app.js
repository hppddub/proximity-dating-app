let participants=[], sampling, refreshing;
const $=id=>document.getElementById(id);
async function api(path,body,token){const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await r.json();if(!r.ok)throw Error(result.error);return result;}
function report(value){$('result').textContent=typeof value==='string'?value:JSON.stringify(value,null,2);}
function guard(fn){return async()=>{try{await fn();}catch(e){report(e.message);}};}
function button(parent,label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=guard(fn);parent.append(b);}
function render(){
  $('participants').replaceChildren();participants.forEach((p,i)=>{
    const section=document.createElement('section'),title=document.createElement('h2');title.textContent=`Simulated participant ${i+1}`;section.append(title);
    p.display=document.createElement('pre');section.append(p.display);
    const act=async(name,body={})=>{if(!p.state?.offer)throw Error('No current offer');const r=await api(`/v1/offers/${p.state.offer.id}/${name}`,body,p.token);await refresh();return r;};
    button(section,"I'm open to saying hello",()=>act('ready'));
    button(section,'Not now',()=>act('decline'));
    button(section,'Pause',async()=>{await api('/v1/pause',{},p.token);await refresh();});
    button(section,'New session',async()=>{await api('/v1/session',{},p.token);await refresh();});
    const image=document.createElement('img');image.hidden=true;image.alt='Current connection QR';section.append(image);
    const input=document.createElement('input');input.placeholder='Connection challenge';input.setAttribute('aria-label','Connection challenge');section.append(input);
    button(section,'Show QR',async()=>{const r=await act('qr');image.src=r.png;image.hidden=false;input.value=r.challenge;participants[1-i].challengeInput.value=r.challenge;});
    button(section,'Use scanned challenge',()=>act('scan',{challenge:input.value}));
    button(section,'Connect and share synthetic profile',()=>act('confirm'));
    const profile=document.createElement('pre');section.append(profile);p.profile=profile;p.image=image;p.challengeInput=input;
    button(section,'Fetch authorized profile',async()=>{const r=await api(`/v1/offers/${p.state.offer.id}/profile`,undefined,p.token);profile.textContent=JSON.stringify(r,null,2);});
    button(section,'Disconnect',()=>act('disconnect'));button(section,'Block pair',()=>act('block'));
    $('participants').append(section);
  });
}
async function refresh(){for(const p of participants){p.state=await api('/v1/state',undefined,p.token);p.display.textContent=JSON.stringify({session:p.state.session?.id??null,offer:p.state.offer},null,2);if(p.state.offer?.state!=='connected')p.profile.textContent='';if(!p.state.offer||p.state.offer.state!=='ready')p.image.hidden=true;}}
$('create').onclick=guard(async()=>{clearInterval(sampling);clearInterval(refreshing);participants=(await api('/demo/pair',{})).pair;render();await refresh();refreshing=setInterval(guard(refresh),2000);report('SIMULATION pair created. Start samples and wait 30 seconds for the dwell gate.');});
$('sample').onclick=guard(async()=>{if(participants.length!==2)throw Error('Create a pair first');clearInterval(sampling);const sample=async()=>{const r=await api('/demo/sample',{a:participants[0].id,b:participants[1].id});$('simulation-status').textContent=`SIMULATED radio sample: ${r.status}${r.dwellMs!==undefined?` (${r.dwellMs/1000}s dwell)`:''}`;await refresh();};await sample();sampling=setInterval(guard(sample),10000);});
$('stop').onclick=()=>{clearInterval(sampling);$('simulation-status').textContent='Samples stopped. Existing evidence becomes stale after 30 seconds.';};
api('/v1/meta').then(meta=>{$('mode').textContent=meta.demo?'LOOPBACK SIMULATION MODE. Synthetic radio input; not a device test.':'Native trial coordinator. Simulation disabled. Use the installed phone apps.';$('create').disabled=!meta.demo;$('sample').disabled=!meta.demo;}).catch(e=>report(e.message));
