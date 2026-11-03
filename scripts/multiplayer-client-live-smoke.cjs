'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..'),html=readFileSync(join(root,'index.html'),'utf8');
const config=readFileSync(join(root,'js/multiplayer-config.js'),'utf8');
const source=readFileSync(join(root,'js/multiplayer.js'),'utf8');
const api=process.env.SEABATTLE_MULTIPLAYER_API;
assert.match(api||'',/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/seabattle-multiplayer$/);
const FLEET=[[0,1,2,3],[20,21,22],[40,41,42],[60,61],[64,65],[80,81],[6],[8],[26],[28]];
const makeFleet=()=>({ships:FLEET.map(cells=>({cells:[...cells]})),cells:Array(100).fill(-1)});
function browser(saved=new Map()){
  const nodes=new Map();
  const make=()=>({
    textContent:'',value:'',innerHTML:'',hidden:false,disabled:false,dataset:{},
    classList:{toggle(){}},handlers:{},
    addEventListener(name,fn){this.handlers[name]=fn;},
    setAttribute(name,value){this[name]=value;},
    querySelector(){return null;},select(){},click(){this.handlers.click?.();}
  });
  for(const m of html.matchAll(/\bid="([^"]+)"/g))nodes.set(m[1],make());
  const document={
    getElementById:id=>nodes.get(id),
    querySelector:()=>null,querySelectorAll:()=>[],activeElement:null,hidden:false,
    body:{classList:{toggle(){}}}
  };
  const loc={href:'https://stanleyll0yd.github.io/SeaBattle/'};
  const ctx=vm.createContext({
    document,window:{location:loc},location:loc,
    localStorage:{
      getItem:key=>saved.get(key)||null,
      setItem:(key,value)=>saved.set(key,value),
      removeItem:key=>saved.delete(key)
    },
    navigator:{clipboard:{writeText:async()=>{}}},
    fetch,URL,Response,AbortController,console,
    setTimeout:()=>0,clearTimeout:()=>{},confirm:()=>true,
    randomFleet:makeFleet,
    createBoard:()=>({ships:[],cells:Array(100).fill(-1)}),
    candidate:()=>({valid:false}),placeShip(){},
    language:'en',FLEET:[4,3,3,2,2,2,1,1,1,1],
    LETTERS:{en:['A','B','C','D','E','F','G','H','I','J'],
      ru:['А','Б','В','Г','Д','Е','Ж','З','И','К']}
  });
  vm.runInContext(config.replace(/const ONLINE_API = "[^"]*";/,'const ONLINE_API = '+JSON.stringify(api)+';')+'\n'+source,ctx);
  const evaluate=js=>vm.runInContext(js,ctx);
  evaluate('onlinePoll=()=>{}');
  evaluate('onlineSwitch(true)');
  return {nodes,saved,evaluate};
}
const run=async()=>{
  const alice=browser(),bob=browser();
  assert.equal(alice.nodes.get('online-open').hidden,false);
  alice.nodes.get('online-name').value='CI web Alice';
  await alice.evaluate('onlineStart("create")');
  const room=alice.evaluate('onlineSession.code');
  assert.match(room,/^[A-HJ-NP-Z2-9]{12}$/);
  const invite=alice.nodes.get('online-invitation').value;
  assert.equal(new URL(invite).searchParams.get('room'),room);
  assert.ok(!invite.includes(alice.evaluate('onlineSession.token')));
  bob.nodes.get('online-join-code').value=room;
  bob.nodes.get('online-name').value='CI web Bob';
  await bob.evaluate('onlineStart("join")');
  assert.equal(bob.evaluate('onlineView.phase'),'placement');
  await alice.evaluate('onlineAction("ready",{fleet:onlineCurrentFleet()})');
  await bob.evaluate('onlineAction("ready",{fleet:onlineCurrentFleet()})');
  const state=await alice.evaluate('onlineFetch("state",onlineSession)');
  alice.evaluate('onlineAccept('+JSON.stringify(state)+')');
  assert.equal(alice.evaluate('onlineView.phase'),'playing');
  assert.equal(bob.evaluate('onlineView.phase'),'playing');
  const start=alice.evaluate('onlineView.turn');
  const first=start==='host'?alice:bob,second=start==='host'?bob:alice;
  await first.evaluate('onlineAction("fire",{cell:99})');
  const updated=await second.evaluate('onlineFetch("state",onlineSession)');
  second.evaluate('onlineAccept('+JSON.stringify(updated)+')');
  assert.equal(second.evaluate('onlineView.turn'),second.evaluate('onlineView.role'));
  for(const at of FLEET.flat()){
    await first.evaluate('onlineFetch("state",onlineSession)');
    const accepted=await second.evaluate('onlineAction("fire",{cell:'+at+'})');
    assert.equal(accepted,true,'shot '+at+' accepted');
  }
  assert.equal(second.evaluate('onlineView.phase'),'finished');
  assert.equal(second.evaluate('onlineView.winner'),second.evaluate('onlineView.role'));
  assert.equal(second.evaluate('onlineView.enemyShots'),20);
  assert.match(second.nodes.get('online-their-grid').innerHTML,/class="cell sunk fired enemy-cell"/);
  await alice.evaluate('onlineAction("rematch")');
  await bob.evaluate('onlineAction("rematch")');
  const next=await alice.evaluate('onlineFetch("state",onlineSession)');
  assert.equal(next.phase,'placement');
  assert.equal(next.round,2);
  const reload=browser(alice.saved);
  assert.equal(reload.evaluate('onlineSession.code'),room,'reconnect state persisted');
  const recovered=await reload.evaluate('onlineFetch("state",onlineSession)');
  assert.equal(recovered.round,2);
  console.log('Live two-client SeaBattle controller smoke: PASS (two contexts, invite, ready, turns, victory, rematch, reconnect).');
};
run().catch(error=>{console.error('Live client smoke failed:',error.message);process.exitCode=1;});
