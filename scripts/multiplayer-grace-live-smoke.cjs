'use strict';
const assert=require('node:assert/strict');
const endpoint=process.env.SEABATTLE_MULTIPLAYER_API;
const origin='https://stanleyll0yd.github.io';
const fleet=[[0,1,2,3],[20,21,22],[40,41,42],[60,61],[64,65],[80,81],[6],[8],[26],[28]];
assert.match(endpoint||'',/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/seabattle-multiplayer$/);

async function api(action,values={},expected=200){
  const response=await fetch(endpoint,{
    method:'POST',headers:{origin,'content-type':'application/json'},
    body:JSON.stringify({action,...values}),signal:AbortSignal.timeout(20000)
  });
  const result=await response.json();
  assert.equal(response.status,expected,action+': '+JSON.stringify(result));
  assert.equal(response.headers.get('access-control-allow-origin'),origin);
  return result;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const host=await api('create',{name:'Grace host'},201);
  const guest=await api('join',{code:host.code,name:'Grace guest'});
  await api('ready',{code:host.code,token:host.token,fleet});
  await api('ready',{code:host.code,token:guest.token,fleet});
  const a={code:host.code,token:host.token},b={code:host.code,token:guest.token};
  assert.equal((await api('state',a)).phase,'playing');
  await sleep(16000);
  let view=await api('state',a);
  assert.equal(view.opponentOnline,false,'guest becomes offline after heartbeat timeout');
  assert.equal(view.claimAvailable,false,'16 seconds is not sufficient to claim');
  await api('claim',a,409);
  await api('state',b);
  view=await api('state',a);
  assert.equal(view.opponentOnline,true,'guest reconnects before grace expires');
  assert.equal(view.claimAvailable,false,'guest reconnect resets claim timer');
  const lastGuestSeen=Date.now();
  while(Date.now()-lastGuestSeen<126000){
    await sleep(6000);
    view=await api('state',a);
    if(Date.now()-lastGuestSeen<117000)
      assert.equal(view.claimAvailable,false,'claim unavailable before 120s');
  }
  assert.equal(view.opponentOnline,false,'guest is offline after 120 seconds');
  assert.equal(view.claimAvailable,true,'claim available after 120 seconds');
  const claimed=await api('claim',a);
  assert.equal(claimed.phase,'finished');
  assert.equal(claimed.winner,'host');
  assert.equal(claimed.finishReason,'disconnect');
  const guestResult=await api('state',b);
  assert.equal(guestResult.winner,'host');
  await api('rematch',a);
  const rematch=await api('rematch',b);
  assert.equal(rematch.phase,'placement');
  assert.equal(rematch.round,2);
  await api('ready',{...a,fleet});
  await api('ready',{...b,fleet});
  const surrender=await api('surrender',b);
  assert.equal(surrender.winner,'host');
  assert.equal(surrender.finishReason,'surrender');
  console.log('Real-clock 120s grace smoke: PASS (offline, early claim denial, reconnect, 120s claim, rematch, surrender).');
}
main().catch(error=>{console.error('Live grace smoke failed:',error.stack||error);process.exitCode=1;});
