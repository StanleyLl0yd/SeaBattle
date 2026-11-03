'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {pathToFileURL}=require('node:url');
const {join}=require('node:path');
const rules=import(pathToFileURL(join(__dirname,'../supabase/functions/seabattle-multiplayer/rules.mjs')).href);

const fleet=[[0,1,2,3],[20,21,22],[40,41,42],[60,61],[64,65],[80,81],[6],[8],[26],[28]];
test('authoritative validator enforces exact fleet, straight placement, and no touching',async()=>{
  const {validFleet}=await rules;
  assert.equal(validFleet(fleet),true);
  assert.equal(validFleet([...fleet.slice(0,9),[65]]),false);
  assert.equal(validFleet([...fleet.slice(0,9),[27]]),false);
  assert.equal(validFleet([...fleet.slice(0,9),[99]]),true);
  assert.equal(validFleet([...fleet.slice(0,9),[100]]),false);
  assert.equal(validFleet([...fleet.slice(0,9),[28,28]]),false);
  assert.equal(validFleet([[0,2,3,4],...fleet.slice(1)]),false);
  assert.equal(validFleet([[0,1,2,10],...fleet.slice(1)]),false);
  assert.equal(validFleet(fleet.slice(1)),false);
  assert.equal(validFleet(null),false);
});
test('server resolves miss, hit, sink, blocking, extra turn and illegal repeated cells',async()=>{
  const {fire,shotMap}=await rules;
  let result=fire(fleet,[],99);
  assert.equal(result.event.kind,'miss');
  assert.equal(result.extraTurn,false);
  result=fire(fleet,result.events,0);
  assert.equal(result.event.kind,'hit');
  assert.equal(result.extraTurn,true);
  for(const at of [1,2,3])result=fire(fleet,result.events,at);
  assert.equal(result.event.kind,'sunk');
  assert.equal(result.event.ship.length,4);
  const map=shotMap(result.events);
  assert.equal(map[0],'sunk');
  assert.equal(map[3],'sunk');
  assert.equal(map[10],'blocked');
  assert.throws(()=>fire(fleet,result.events,10),/CELL_UNAVAILABLE/);
  assert.throws(()=>fire(fleet,result.events,0),/CELL_UNAVAILABLE/);
  assert.throws(()=>fire(fleet,result.events,100),/INVALID_CELL/);
  assert.equal(map[99],'miss');
});
test('last ship win condition is server-authoritative and bounded',async()=>{
  const {fire}=await rules;
  let events=[],won=false;
  for(const ship of fleet)for(const at of ship){
    const next=fire(fleet,events,at);
    events=next.events;won=next.won;
  }
  assert.equal(events.length,20);
  assert.equal(won,true);
  assert.equal(events.filter(e=>e.kind==='sunk').length,10);
});
test('member projections do not reveal hidden opponent fleet or credentials',async()=>{
  const {memberView}=await rules;
  const room={
    code:'ABCD1234EFGH',phase:'playing',round:1,version:2,
    host_name:'Alice',guest_name:'Bob',
    host_fleet:fleet,guest_fleet:fleet.map(ship=>ship.map(x=>(x+5)%100)),
    host_shots:[{at:99,kind:'miss'}],guest_shots:[],
    host_ready:true,guest_ready:true,
    host_seen:'2026-11-03T12:00:00Z',guest_seen:'2026-11-03T11:59:00Z',
    turn:'host',winner:null,finish_reason:null,
    host_rematch:false,guest_rematch:false,
    host_token_hash:'secret-hash',guest_token_hash:'other-secret'
  };
  const view=memberView(room,'host',Date.parse('2026-11-03T12:00:00Z'));
  assert.equal(view.myFleet,room.host_fleet);
  assert.equal(view.enemy[99],'miss');
  assert.equal(view.opponentOnline,false);
  assert.equal(view.claimAvailable,false);
  assert.equal(view.reconnectSeconds,60);
  assert.equal(JSON.stringify(view).includes('guest_fleet'),false);
  assert.equal(JSON.stringify(view).includes('secret-hash'),false);
  assert.equal(JSON.stringify(view).includes('other-secret'),false);
  assert.equal(JSON.stringify(view).includes('guest_shots'),false);
  assert.equal(memberView(room,'host',Date.parse('2026-11-03T12:01:01Z')).claimAvailable,true);
});
