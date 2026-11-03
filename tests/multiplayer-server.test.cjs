'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {pathToFileURL}=require('node:url');
const {join}=require('node:path');
const {createHandler}=awaitImport();
function awaitImport(){
  const file=pathToFileURL(join(__dirname,'../supabase/functions/seabattle-multiplayer/index.mjs')).href;
  return {createHandler: (...args)=>import(file).then(m=>m.createHandler(...args))};
}
class Store{
  constructor(){this.rooms=new Map();}
  async cleanup(now){for(const [key,r] of this.rooms)if(r.expires_at<=now)this.rooms.delete(key);}
  async insert(row){if(this.rooms.has(row.code))return null;this.rooms.set(row.code,structuredClone(row));return structuredClone(row);}
  async get(code){return structuredClone(this.rooms.get(code)||null);}
  async cas(code,version,patch){
    const row=this.rooms.get(code);
    if(!row||row.version!==version)return null;
    const next={...row,...structuredClone(patch)};
    this.rooms.set(code,next);return structuredClone(next);
  }
  async touch(code,role,date){const row=this.rooms.get(code);row[role+'_seen']=date;}
}
const ships=[[0,1,2,3],[20,21,22],[40,41,42],[60,61],[64,65],[80,81],[6],[8],[26],[28]];
const request=async(handler,action,values={})=>{
  const response=await handler(new Request('https://edge.example.test', {
    method:'POST',headers:{origin:'https://stanleyll0yd.github.io','content-type':'application/json'},
    body:JSON.stringify({action,...values})
  }));
  return {status:response.status,body:await response.json()};
};
test('two players create, join, ready, shoot and reject cheating with private fleets',async()=>{
  let now=Date.parse('2026-11-03T12:00:00Z');
  const store=new Store(),handler=await createHandler(store,()=>now);
  const a=await request(handler,'create',{name:'Alice'});
  assert.equal(a.status,201);
  assert.equal(a.body.phase,'waiting');
  assert.equal(a.body.token.length,48);
  const code=a.body.code;
  const b=await request(handler,'join',{code,name:'Bob'});
  assert.equal(b.status,200);
  assert.equal(b.body.phase,'placement');
  assert.equal((await request(handler,'join',{code,name:'Eve'})).status,409);
  assert.equal((await request(handler,'state',{code,token:'z'.repeat(48)})).status,403);
  assert.equal((await request(handler,'ready',{code,token:a.body.token,fleet:ships.slice(1)})).status,400);
  const readyA=await request(handler,'ready',{code,token:a.body.token,fleet:ships});
  assert.equal(readyA.status,200);
  assert.equal(readyA.body.phase,'placement');
  const readyB=await request(handler,'ready',{code,token:b.body.token,fleet:ships});
  assert.equal(readyB.body.phase,'playing');
  assert.equal(readyB.body.opponentReady,true);
  assert.equal(readyB.body.myFleet.length,10);
  assert.equal(readyB.body.enemy.every(x=>x===null),true);
  assert.equal(JSON.stringify(readyB.body).includes('host_token_hash'),false);
  const shooter=readyB.body.turn==='guest'?b.body:a.body;
  const defender=readyB.body.turn==='guest'?a.body:b.body;
  const fired=await request(handler,'fire',{code,token:shooter.token,cell:0});
  assert.equal(fired.status,200);
  assert.equal(fired.body.enemy[0],'hit');
  assert.equal(fired.body.turn,readyB.body.turn,'hit keeps the turn');
  assert.equal((await request(handler,'fire',{code,token:shooter.token,cell:0})).status,409);
  assert.equal((await request(handler,'fire',{code,token:defender.token,cell:1})).status,409);
  const defenderView=await request(handler,'state',{code,token:defender.token});
  assert.equal(defenderView.body.own[0],'hit');
  assert.equal(defenderView.body.enemy[0],null);
  for(const at of [1,2,3]){
    const result=await request(handler,'fire',{code,token:shooter.token,cell:at});
    assert.equal(result.status,200);
  }
  const view=await request(handler,'state',{code,token:shooter.token});
  assert.equal(view.body.enemy[0],'sunk');
  assert.equal(view.body.enemy[10],'blocked');
});
test('disconnect timer, claim victory, rematch votes and session recovery',async()=>{
  let now=Date.parse('2026-11-03T12:00:00Z');
  const store=new Store(),handler=await createHandler(store,()=>now);
  const a=(await request(handler,'create')).body;
  const b=(await request(handler,'join',{code:a.code})).body;
  await request(handler,'ready',{code:a.code,token:a.token,fleet:ships});
  await request(handler,'ready',{code:a.code,token:b.token,fleet:ships});
  assert.equal((await request(handler,'claim',{code:a.code,token:a.token})).status,409);
  now+=121000;
  assert.equal((await request(handler,'claim',{code:a.code,token:a.token})).status,200);
  const state=(await request(handler,'state',{code:a.code,token:b.token})).body;
  assert.equal(state.phase,'finished');
  assert.equal(state.winner,'host');
  assert.equal(state.finishReason,'disconnect');
  assert.equal((await request(handler,'rematch',{code:a.code,token:a.token})).body.myRematch,true);
  const rematch=(await request(handler,'rematch',{code:a.code,token:b.token})).body;
  assert.equal(rematch.phase,'placement');
  assert.equal(rematch.round,2);
  assert.equal(rematch.myFleet,null);
  assert.equal(rematch.enemyShots,0);
  assert.equal((await request(handler,'state',{code:a.code,token:a.token})).body.role,'host');
});
test('foreign origins and invalid requests do not reach the room store',async()=>{
  const store=new Store(),handler=await createHandler(store);
  const denied=await handler(new Request('https://edge.example.test',{method:'POST',
    headers:{origin:'https://evil.example', 'content-type':'application/json'},
    body:'{"action":"create"}'}));
  assert.equal(denied.status,403);
  assert.equal(store.rooms.size,0);
  assert.equal((await request(handler,'state',{code:'bad',token:'foo'})).status,400);
  assert.equal((await request(handler,'create',{name:'   '})).status,201);
});

test('simultaneous invitations admit only one guest; concurrent shots serialize by version',async()=>{
  const store=new Store(),handler=await createHandler(store);
  const host=(await request(handler,'create')).body;
  const attempts=await Promise.all([
    request(handler,'join',{code:host.code,name:'Guest one'}),
    request(handler,'join',{code:host.code,name:'Guest two'})
  ]);
  assert.deepEqual(attempts.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
  const guest=attempts.find(x=>x.status===200).body;
  await request(handler,'ready',{code:host.code,token:host.token,fleet:ships});
  const state=(await request(handler,'ready',{code:host.code,token:guest.token,fleet:ships})).body;
  const token=state.turn==='host'?host.token:guest.token;
  const shots=await Promise.all([
    request(handler,'fire',{code:host.code,token,cell:0}),
    request(handler,'fire',{code:host.code,token,cell:1})
  ]);
  assert.deepEqual(shots.map(x=>x.status).sort((a,b)=>a-b),[200,409]);
  const result=(await request(handler,'state',{code:host.code,token})).body;
  assert.equal(result.enemyShots,1,'only one turn mutation may commit');
});
test('24-hour absolute expiry rejects old credentials and purges expired rows',async()=>{
  let now=Date.parse('2026-11-03T12:00:00Z');
  const store=new Store(),handler=await createHandler(store,()=>now);
  const host=(await request(handler,'create')).body;
  now+=86400000;
  assert.equal((await request(handler,'state',{code:host.code,token:host.token})).status,410);
  const fresh=await request(handler,'create');
  assert.equal(fresh.status,201);
  assert.equal(store.rooms.has(host.code),false);
});

test('large requests are rejected without processing room creation',async()=>{
  const store=new Store(),handler=await createHandler(store);
  const response=await handler(new Request('https://edge.example.test',{method:'POST',
    headers:{origin:'https://stanleyll0yd.github.io'},
    body:JSON.stringify({action:'create',padding:'x'.repeat(9000)})}));
  assert.equal(response.status,413);
  assert.equal(store.rooms.size,0);
});

test('room capacity policy is mapped to HTTP 429 instead of an internal error',async()=>{
  const store=new Store();
  store.insert=async()=>{throw Object.assign(new Error('ROOM_RATE_LIMIT'),{code:'ROOM_RATE_LIMIT',status:429});};
  const handler=await createHandler(store);
  const result=await request(handler,'create');
  assert.equal(result.status,429);
  assert.equal(result.body.error,'ROOM_RATE_LIMIT');
});
