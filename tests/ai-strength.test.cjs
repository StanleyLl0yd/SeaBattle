'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const source=require('./source.cjs').script;
const currentAi=readFileSync(join(root,'js','ai.js'),'utf8');
const stableAi=readFileSync(join(__dirname,'fixtures','ai-1.0.0.js'),'utf8');
const stableSource=source.replace(currentAi,stableAi);
const previousAi=readFileSync(join(__dirname,'fixtures','ai-1.1.0.js'),'utf8');
const previousSource=source.replace(currentAi,previousAi);
assert.notEqual(source,stableSource,'benchmark must compare different implementations');

function engine(script,seed=123456789){
  let state=seed>>>0;
  const math=Object.create(Math);
  math.random=()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);
  const context=vm.createContext({Math:math,document:{getElementById:()=>({})}});
  const boundary=script.indexOf('function updateStatus(');
  assert.ok(boundary>0);
  vm.runInContext(script.slice(0,boundary)+
    '\nglobalThis.api={randomFleet,createBoard,placeShip,FLEET,AI_BITS,AI_PLACEMENTS,aiChooseShot,fireAt,remaining,'+
    'aiJointPosterior:(typeof aiJointPosterior==="function" ? aiJointPosterior : null)};',context);
  return {api:context.api,seed(n){state=n>>>0;}};
}
function mean(values){return values.reduce((sum,n)=>sum+n,0)/values.length;}
function play(e,raw,level){
  const board=JSON.parse(raw);
  let count=0;
  while(e.api.remaining(board)){
    const cell=e.api.aiChooseShot(board,level);
    assert.ok(Number.isInteger(cell)&&cell>=0&&cell<100&&board.shots[cell]===null);
    assert.notEqual(e.api.fireAt(board,cell).kind,'already');
    assert.ok(++count<=100);
  }
  return count;
}

test('joint posterior covers every visible hit and enumerates constrained final fleets',()=>{
  const e=engine(source);
  const shots=Array(100).fill('miss');
  shots[44]='hit';shots[45]='hit';shots[46]=null;
  shots[60]='hit';shots[70]=null;
  const active=e.api.AI_BITS[44]|e.api.AI_BITS[45]|e.api.AI_BITS[60];
  const forbidden=shots.reduce((mask,v,i)=>v!=='hit'&&v!==null?mask|e.api.AI_BITS[i]:mask,0n);
  const legal=[[],[],[],[],[]];
  for(const size of [2,3])legal[size]=e.api.AI_PLACEMENTS[size].filter(p=>
    (p.mask&forbidden)===0n&&(p.halo&active)===(p.mask&active));
  const posterior=e.api.aiJointPosterior(shots,[3,2],legal,active,19);
  assert.ok(posterior&&posterior.solutions>=1,'both damaged ships must be represented');
  assert.ok(posterior.heat[46]>0&&posterior.heat[70]>0);
  assert.equal(posterior.heat[99],0);
  const known={shots,ships:[{size:3,sunk:false},{size:2,sunk:false}],
    get cells(){throw Error('Hidden geometry read');}};
  assert.equal(e.api.aiChooseShot(known,19),46,'higher-value aligned continuation first');
});

test('upper ranks remain fair with inaccessible ship geometry and safe fallback',()=>{
  const e=engine(source);
  for(const level of [13,15,16,17,18,19]){
    const board={shots:Array(100).fill(null),ships:Array.from(e.api.FLEET,size=>({
      size,sunk:false,get cells(){throw Error('hidden ship cells');}
    })),get cells(){throw Error('hidden board cells');}};
    const first=e.api.aiChooseShot(board,level);
    assert.ok(first>=0&&first<100);
    board.shots[first]='miss';
    const second=e.api.aiChooseShot(board,level);
    assert.ok(second!==first&&board.shots[second]===null);
  }
  const impossible={shots:Array(100).fill('miss'),ships:[{size:1,sunk:false}]};
  impossible.shots[45]='hit';impossible.shots[44]='hit';impossible.shots[46]=null;
  assert.equal(e.api.aiJointPosterior(impossible.shots,[1],e.api.AI_PLACEMENTS,
    e.api.AI_BITS[44]|e.api.AI_BITS[45],19),null);
});

test('novice ranks retain their accessible, legal version 1.0.0 behavior',()=>{
  const old=engine(stableSource),fresh=engine(source);
  for(const level of [1,2]){
    old.seed(0xc01d1e+level);fresh.seed(0xc01d1e+level);
    const board=old.api.randomFleet();
    const raw=JSON.stringify(board);
    old.seed(0xdead007+level);fresh.seed(0xdead007+level);
    assert.equal(old.api.aiChooseShot(JSON.parse(raw),level),
      fresh.api.aiChooseShot(JSON.parse(raw),level),'unmodified rank '+level);
  }
});


test('rank 17–19 covering residues intersect every legal multi-cell placement',()=>{
  const e=engine(source);
  for(const size of [2,3,4]){
    for(const placement of e.api.AI_PLACEMENTS[size]){
      const covered=placement.cells.some(i=>
        (Math.floor(i/10)+i%10)%size===0);
      assert.ok(covered,'every length-'+size+' ship must intersect its cover');
    }
    for(const level of [19]){
      const observed={shots:Array(100).fill(null),ships:[{size,sunk:false}],
        get cells(){throw Error('hidden board cells inspected');}};
      for(let n=0;n<6;n++){
        const cell=e.api.aiChooseShot(observed,level);
        assert.equal((Math.floor(cell/10)+cell%10)%size,0,
          'hunt must use a guaranteed covering residue');
      }
    }
  }
});

test('rank 19 benchmark against frozen 1.1.0 on identical random and perimeter fleets',()=>{
  const old=engine(previousSource),fresh=engine(source);
  old.seed(0x1acef00d);
  const boards=Array.from({length:32},()=>JSON.stringify(old.api.randomFleet()));
  const perimeter=[['J3','J4','J5','J6'],['A3','A4','A5'],['F1','G1','H1'],
    ['C1','D1'],['A7','A8'],['G10','H10'],['A1'],['J1'],['A10'],['J10']];
  const edge=old.api.createBoard();
  for(const cells of perimeter)old.api.placeShip(edge,
    cells.map(c=>'ABCDEFGHIJ'.indexOf(c[0])+(Number(c.slice(1))-1)*10));
  boards.push(...Array(12).fill(JSON.stringify(edge)));
  const baseline=[],upgraded=[];
  for(let i=0;i<boards.length;i++){
    const seed=(0xf0bada ^ Math.imul(i+1,7919))>>>0;
    old.seed(seed);baseline.push(play(old,boards[i],19));
    fresh.seed(seed);upgraded.push(play(fresh,boards[i],19));
  }
  const before=mean(baseline),after=mean(upgraded);
  console.log('AI benchmark v1.1.0 vs v1.2.0: '+JSON.stringify({
    fleets:boards.length,baseMean:before,newMean:after,
    edgeBase:mean(baseline.slice(32)),edgeNew:mean(upgraded.slice(32)),
    randomBase:mean(baseline.slice(0,32)),randomNew:mean(upgraded.slice(0,32))
  }));
  assert.ok(after<before-0.25,'upgraded AI must beat frozen 1.1.0 overall');
  assert.ok(mean(upgraded.slice(0,32))<mean(baseline.slice(0,32)),
    'upgraded AI must improve the random-fleet cohort');
  assert.ok(mean(upgraded.slice(32))<=mean(baseline.slice(32))+1.5,
    'the perimeter cohort must not regress materially');
  assert.ok(mean(upgraded.slice(32))<46,'perimeter defense must remain practical');
});

test('19 levels form a gradual, distinct skill curve on 60 matched fleets',()=>{
  const e=engine(source);
  e.seed(0x127caa8f);
  const boards=Array.from({length:60},()=>JSON.stringify(e.api.randomFleet()));
  const averages=[];
  for(let level=1;level<=19;level++){
    const scores=[];
    for(let i=0;i<boards.length;i++){
      e.seed((0x5ea8babe^Math.imul(i+1,10691))>>>0);
      scores.push(play(e,boards[i],level));
    }
    averages.push(mean(scores));
  }
  console.log('AI full-level curve v1.2.0: '+JSON.stringify(averages.map((shots,i)=>({
    level:i+1,meanShots:Math.round(shots*10)/10
  }))));
  const novice=mean(averages.slice(0,4)),middle=mean(averages.slice(7,12)),
    admiral=mean(averages.slice(15));
  assert.ok(novice>middle+4,'middle ranks must improve meaningfully on novice play');
  assert.ok(middle>admiral+1,'admiral ranks must improve on middle ranks');
  for(let i=1;i<averages.length;i++)assert.ok(Math.abs(averages[i]-averages[i-1])<18,
    'adjacent rank cliff between '+i+' and '+(i+1)+': '+JSON.stringify(averages));
});


test('admiral strength generalizes across four defense styles, not just a fixed edge board',()=>{
  const previous=engine(previousSource),advanced=engine(source);
  const boards=[];
  for(const style of ['balanced','edge','center','spread'])for(let n=0;n<36;n++){
    advanced.seed((0xa51f77c^Math.imul(n+1,42193)^style.length*197)>>>0);
    boards.push({style,raw:JSON.stringify(advanced.api.randomFleet(undefined,style))});
  }
  const results={previous:[],mid:[],upper:[],admiral:[]};
  for(let i=0;i<boards.length;i++){
    const seed=(0xcc0ffee^Math.imul(i+1,61813))>>>0;
    previous.seed(seed);results.previous.push(play(previous,boards[i].raw,19));
    advanced.seed(seed);results.mid.push(play(advanced,boards[i].raw,12));
    advanced.seed(seed);results.upper.push(play(advanced,boards[i].raw,16));
    advanced.seed(seed);results.admiral.push(play(advanced,boards[i].raw,19));
  }
  const overall=Object.fromEntries(Object.entries(results).map(([key,values])=>[key,mean(values)]));
  const byStyle={};
  for(const style of ['balanced','edge','center','spread']){
    const indices=boards.map((b,i)=>b.style===style?i:-1).filter(i=>i>=0);
    byStyle[style]=Object.fromEntries(Object.entries(results).map(([key,values])=>
      [key,mean(indices.map(i=>values[i]))]));
  }
  console.log('AI stratified admiral benchmark: '+JSON.stringify({fleets:boards.length,overall,byStyle}));
  assert.ok(overall.admiral<overall.previous,
    'rank 19 must beat its frozen 1.1.0 policy on varied defenses');
  assert.ok(overall.admiral<overall.mid-1,
    'rank 19 must outperform rank 12 against varied defenses');
  assert.ok(overall.admiral<=overall.upper+0.75,
    'rank 19 must not substantially underperform rank 16 on varied defenses');
});
