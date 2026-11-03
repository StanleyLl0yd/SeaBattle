'use strict';
const assert=require('node:assert/strict');

const endpoint=process.env.SEABATTLE_MULTIPLAYER_API;
const origin='https://stanleyll0yd.github.io';
if(!endpoint||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/seabattle-multiplayer$/.test(endpoint)){
  process.stderr.write('Missing or invalid dedicated SeaBattle API endpoint\n');
  process.exit(2);
}
const fleet=[[0,1,2,3],[20,21,22],[40,41,42],[60,61],[64,65],[80,81],[6],[8],[26],[28]];
const json=async(action,data={},expected=200)=>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  let response,body;
  try {
    response=await fetch(endpoint,{method:'POST',headers:{origin,'content-type':'application/json'},
      body:JSON.stringify({action,...data}),signal:controller.signal});
    const text=await response.text();
    try{body=JSON.parse(text);}catch{throw Error(action+': expected JSON, got HTTP '+response.status);}
  }finally{clearTimeout(timeout);}
  assert.equal(response.status,expected,action+' HTTP '+response.status+' '+JSON.stringify(body));
  assert.equal(response.headers.get('access-control-allow-origin'),origin,action+' CORS');
  assert.equal(response.headers.get('cache-control'),'no-store');
  return body;
};
const main=async()=>{
  const invalid=await json('state',{code:'INVALID',token:'wrong'},400);
  assert.equal(invalid.error,'INVALID_CODE');
  const alice=await json('create',{name:'CI Alice'},201);
  assert.match(alice.code,/^[A-HJ-NP-Z2-9]{12}$/);
  assert.match(alice.token,/^[A-Za-z0-9_-]{48}$/);
  const bob=await json('join',{code:alice.code,name:'CI Bob'});
  assert.notEqual(alice.token,bob.token);
  assert.equal(bob.role,'guest');
  assert.equal(bob.phase,'placement');
  const code=alice.code;
  await json('join',{code,name:'Third player'},409);
  await json('state',{code,token:'A'.repeat(48)},403);
  await json('ready',{code,token:alice.token,fleet:fleet.slice(1)},400);
  const aReady=await json('ready',{code,token:alice.token,fleet});
  assert.equal(aReady.myReady,true);
  const bReady=await json('ready',{code,token:bob.token,fleet});
  assert.equal(bReady.phase,'playing');
  assert.equal(bReady.myFleet.length,10);
  assert.ok(bReady.enemy.every(x=>x===null));
  assert.ok(!JSON.stringify(bReady).includes('host_token_hash'));
  const first=bReady.turn==='host'?alice:bob;
  const second=bReady.turn==='host'?bob:alice;
  const miss=await json('fire',{code,token:first.token,cell:99});
  assert.equal(miss.enemy[99],'miss');
  assert.equal(miss.turn,second.role);
  await json('fire',{code,token:first.token,cell:98},409);
  for(const ship of fleet){
    for(const cell of ship){
      await json('state',{code,token:first.token});
      const result=await json('fire',{code,token:second.token,cell});
      assert.equal(result.turn,result.phase==='finished'?null:second.role);
    }
  }
  const won=await json('state',{code,token:second.token});
  assert.equal(won.phase,'finished');
  assert.equal(won.winner,second.role);
  assert.equal(won.enemyAfloat,0);
  assert.equal(won.enemyShots,20);
  assert.equal(won.enemy[0],'sunk');
  assert.equal(won.enemy[10],'blocked');
  const opposite=await json('state',{code,token:first.token});
  assert.equal(opposite.own[0],'sunk');
  assert.equal(opposite.enemy[99],'miss');
  await json('rematch',{code,token:alice.token});
  const rematch=await json('rematch',{code,token:bob.token});
  assert.equal(rematch.round,2);
  assert.equal(rematch.phase,'placement');
  assert.equal(rematch.enemyShots,0);
  assert.equal(rematch.myFleet,null);
  console.log('Live SeaBattle two-player smoke: PASS (invite, join, access, placement, miss, turns, 10 sinks, win, rematch).');
};
main().catch(error=>{console.error('Live multiplayer smoke failed:',error.message);process.exitCode=1;});
