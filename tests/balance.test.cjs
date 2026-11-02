'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const {script} = require('./source.cjs');
assert.ok(script);
const boundary = script.indexOf('function updateStatus(');
assert.ok(boundary > 0);

function engine() {
  let state = 0x12345678;
  const random = Object.create(Math);
  random.random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
  const ctx = vm.createContext({Math:random, document:{getElementById:()=>({})}});
  vm.runInContext(script.slice(0,boundary) +
    '\nglobalThis.api={randomFleet,createBoard,placeShip,FLEET,aiChooseShot,fireAt,remaining};',ctx);
  return {api:ctx.api,seed:value=>{state=value>>>0;}};
}
function mean(data){return data.reduce((a,b)=>a+b,0)/data.length;}
function play(ai,raw,level) {
  const board=JSON.parse(raw);
  let shots=0;
  while(ai.remaining(board)){
    const index=ai.aiChooseShot(board,level);
    assert.ok(Number.isInteger(index)&&index>=0&&index<100&&board.shots[index]===null);
    assert.notEqual(ai.fireAt(board,index).kind,'already');
    assert.ok(++shots<=100);
  }
  return shots;
}
const perimeter=[
  ['J3','J4','J5','J6'],['A3','A4','A5'],['F1','G1','H1'],
  ['C1','D1'],['A7','A8'],['G10','H10'],
  ['A1'],['J1'],['A10'],['J10']
];
function perimeterFleet(ai){
  const b=ai.createBoard();
  for(const cells of perimeter)
    ai.placeShip(b,cells.map(c=>'ABCDEFGHIJ'.indexOf(c[0])+(Number(c.slice(1))-1)*10));
  return JSON.stringify(b);
}
test('difficulty transitions remain gradual on hostile perimeter layouts',()=>{
  const {api,seed}=engine(),raw=perimeterFleet(api);
  const levels=[3,6,8,9,12,15,19], scores={};
  for(const level of levels) {
    const results=[];
    for(let i=0;i<34;i++){
      seed((0x6633ccee ^ Math.imul(level,19937) ^ Math.imul(i+1,31253))>>>0);
      results.push(play(api,raw,level));
    }
    scores[level]=mean(results);
  }
  assert.ok(scores[3]-scores[8]>12,JSON.stringify(scores));
  assert.ok(scores[8]-scores[9]>0 && scores[8]-scores[9]<16,JSON.stringify(scores));
  assert.ok(scores[9]-scores[19]>7,JSON.stringify(scores));
  assert.ok(scores[19]<45,JSON.stringify(scores));
});

test('late difficulty is stronger overall without breaking ordinary fleets',()=>{
  const {api,seed}=engine();
  const boards=Array.from({length:45},()=>JSON.stringify(api.randomFleet()));
  const scores={};
  for(const level of [1,3,6,9,12,19]) {
    const data=[];
    for(let i=0;i<boards.length;i++){
      seed((0xcca73031 ^ Math.imul(level,39119) ^ Math.imul(i+1,28229))>>>0);
      data.push(play(api,boards[i],level));
    }
    scores[level]=mean(data);
  }
  assert.ok(scores[1]-scores[3]>3,JSON.stringify(scores));
  assert.ok(scores[1]-scores[19]>4,JSON.stringify(scores));
  assert.ok(scores[19]<61,JSON.stringify(scores));
  assert.ok(Math.abs(scores[9]-scores[19])<8,JSON.stringify(scores));
});
test('full alternating-turn battles preserve hit-repeat, miss-transfer and first shot',()=>{
  const {api,seed}=engine();
  const battles=55;
  const fleetPairs=Array.from({length:battles},()=>[
    JSON.stringify(api.randomFleet()),JSON.stringify(api.randomFleet())
  ]);
  const outcomes={};
  for(const level of [1,19]){
    let proxyWins=0;
    for(let i=0;i<battles;i++){
      seed((0xbada55 ^ Math.imul(level,97777) ^ Math.imul(i+1,7919))>>>0);
      const player=JSON.parse(fleetPairs[i][0]),enemy=JSON.parse(fleetPairs[i][1]);
      let turn='player',actions=0;
      while(true){
        const target=turn==='player'?enemy:player;
        const index=api.aiChooseShot(target,turn==='player'?12:level);
        assert.ok(Number.isInteger(index)&&target.shots[index]===null);
        const result=api.fireAt(target,index);
        assert.ok(++actions<=180);
        if(api.remaining(target)===0){ if(turn==='player') proxyWins++; break; }
        if(result.kind==='miss')turn=turn==='player'?'computer':'player';
      }
    }
    outcomes[level]=proxyWins;
  }
  assert.ok(outcomes[1]>outcomes[19]+5,JSON.stringify(outcomes));
});
