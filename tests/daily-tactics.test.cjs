'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const {script} = require('./source.cjs');
assert.ok(script);

function boot(saved = new Map(), confirmReset = true, languages = ['en-US']) {
  const nodes = new Map();
  const newNode = () => ({
    textContent:'', innerHTML:'', dataset:{}, style:{}, children:[],
    classList:{ toggle(){},add(){},remove(){} }, handlers:{},
    addEventListener(name, handler){ this.handlers[name] = handler; },
    click(){ this.handlers.click?.(); },
    setAttribute(){}, querySelectorAll(){return[];},
    replaceChildren(...elements){this.children=elements;}
  });
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1],newNode());
  const textNodes = [...html.matchAll(/\bdata-i18n="([^"]+)"/g)].map(m=> {
    const node=newNode();node.dataset.i18n=m[1];return node;
  });
  const ariaNodes = [...html.matchAll(/\bdata-i18n-aria-label="([^"]+)"/g)].map(m=> {
    const node=newNode();node.dataset.i18nAriaLabel=m[1];return node;
  });
  const doc={
    documentElement:{lang:'en'},
    getElementById:id=>nodes.get(id),
    querySelectorAll(selector){
      if(selector==='[data-i18n]')return textNodes;
      if(selector==='[data-i18n-aria-label]')return ariaNodes;
      if(selector==='.cols')return [newNode(),newNode()];
      return [];
    },
    createElement:newNode,addEventListener(){}
  };
  const storage={
    getItem:key=>saved.get(key)??null,
    setItem:(key,value)=>saved.set(key,value)
  };
  const context=vm.createContext({
    document:doc,navigator:{languages,language:languages[0]},
    localStorage:storage,confirm:()=>confirmReset,setTimeout(){}
  });
  vm.runInContext(script,context,{filename:'index.html'});
  return {
    nodes,storage,saved,doc,
    eval:source=>vm.runInContext(source,context),
    career:()=>JSON.parse(vm.runInContext('JSON.stringify(career)',context)),
    game:()=>JSON.parse(vm.runInContext('JSON.stringify({mode:game.mode,level:game.level,phase:game.phase,promotion:game.promotion})',context))
  };
}


test('daily fleet is UTC deterministic, legal and changes with date',()=>{
  const b=boot();
  const fst=b.eval('JSON.stringify(dailyFleet("2026-11-02").ships.map(x=>x.cells))');
  assert.equal(fst,b.eval('JSON.stringify(dailyFleet("2026-11-02").ships.map(x=>x.cells))'));
  const next=b.eval('JSON.stringify(dailyFleet("2026-11-03").ships.map(x=>x.cells))');
  assert.notEqual(fst,next);
  assert.equal(b.eval('dailyFleet("2026-11-02").ships.length'),10);
  assert.equal(b.eval('dailyFleet("2026-11-02").cells.filter(c=>c!==-1).length'),20);
  assert.equal(b.eval('utcChallengeDate(new Date("2026-11-02T23:59:00Z"))'),'2026-11-02');
  assert.equal(b.eval('utcChallengeDate(new Date("2026-11-03T00:00:00Z"))'),'2026-11-03');
  assert.throws(()=>b.eval('dailyFleet("2026-02-30")'),/Invalid|RangeError/);
});

test('daily one-player battle retains turn after a miss and does not affect navy careers',()=>{
  const saved=new Map();
  const b=boot(saved,true,['ru-RU']);
  b.nodes.get('game-mode').value='daily';
  b.nodes.get('game-mode').handlers.change();
  assert.equal(b.game().mode,'daily');
  assert.equal(b.eval('game.enemy.ships.length'),10);
  assert.equal(b.nodes.get('daily-panel').hidden,false);
  b.eval('startBattle()');
  const miss=b.eval('game.enemy.cells.findIndex(x=>x===-1)');
  b.eval('playerFire('+miss+')');
  assert.equal(b.game().phase,'playing');
  assert.equal(b.eval('game.turn'),'player');
  assert.equal(b.eval('game.trace.length'),1);
  assert.equal(b.eval('game.trace[0].outcome'),'miss');
  assert.equal(b.career().wins,0);
  b.eval('game.enemy=createBoard();placeShip(game.enemy,[0]);playerFire(0)');
  assert.equal(b.game().phase,'finished');
  assert.equal(b.nodes.get('daily-share').hidden,false);
  assert.equal(b.nodes.get('tactical-panel').hidden,false);
  assert.equal(b.career().wins,0);
  assert.equal(b.career().losses,0);
  assert.equal(b.eval('game.trace.length'),2);
  assert.ok(b.eval('game.dailyResult.best')===null || Number.isInteger(b.eval('game.dailyResult.best')));
  assert.ok(b.eval('dailyShareText(game.dailyResult.date,20,20,"ru")').includes('20'));
  assert.ok(!b.eval('dailyShareText(game.dailyResult.date,20,20,"ru")').includes('А1'));
  b.nodes.get('play-again').click();
  assert.equal(b.game().phase,'setup');
  assert.equal(b.game().mode,'daily');
});

test('daily score stores best only, validates bad input and never stores board coordinates',()=>{
  const saved=new Map(),b=boot(saved);
  assert.equal(b.eval('saveDailyScore("2026-11-02",40)'),40);
  assert.equal(b.eval('saveDailyScore("2026-11-02",55)'),40);
  assert.equal(b.eval('saveDailyScore("2026-11-02",32)'),32);
  assert.equal(b.eval('dailyBest("2026-11-02")'),32);
  assert.equal(b.eval('saveDailyScore("2026-11-02",19)'),null);
  assert.equal(b.eval('saveDailyScore("bad",21)'),null);
  const stored=saved.get('seabattle.daily.v1');
  assert.ok(stored.includes('"2026-11-02":32'));
  assert.doesNotMatch(stored,/ships|cells|shots|board|fleet|coordinates/);
});

test('tactical snapshots use only publicly observed shots and ship lengths',()=>{
  const b=boot();
  b.eval('var evidence={shots:Array(100).fill(null),ships:FLEET.map(size=>({size,sunk:false}))}');
  b.eval('Object.defineProperty(evidence,"cells",{get(){throw Error("hidden cells accessed")}})');
  b.eval('evidence.ships.forEach(ship=>Object.defineProperty(ship,"cells",{get(){throw Error("hidden ship accessed")}}))');
  const result=b.eval('tacticalSnapshot(evidence,44)');
  assert.equal(result.mode,'hunt');
  assert.ok(result.max>=result.selected);
  b.eval('evidence.shots[44]="hit"');
  const target=b.eval('tacticalSnapshot(evidence,45)');
  assert.equal(target.mode,'target');
  assert.ok(target.selected>0);
  const report=b.eval('summarizeTactics([{mode:"hunt",outcome:"miss",promising:true,max:6,selected:6},{mode:"target",outcome:"hit",promising:false,max:5,selected:3}])');
  assert.equal(report.shots,2);
  assert.equal(report.huntShots,1);
  assert.equal(report.targetHits,1);
  assert.equal(report.alternatives,1);
});

test('targeting ignores impossible perpendicular continuations after aligned hits',()=>{
  const b=boot();
  b.eval('var exposed={shots:Array(100).fill(null),ships:[{size:3,sunk:false},{size:2,sunk:false}]};exposed.shots[44]="hit";exposed.shots[45]="hit"');
  b.eval('Object.defineProperty(exposed,"cells",{get(){throw Error("Hidden cells read")}})');
  const perpendicular=b.eval('tacticalSnapshot(exposed,34)');
  const aligned=b.eval('tacticalSnapshot(exposed,43)');
  assert.equal(perpendicular.mode,'target');
  assert.equal(perpendicular.selected,0);
  assert.ok(aligned.selected>0);
  assert.equal(perpendicular.promising,false);
  b.eval('exposed.shots[43]="blocked"');
  assert.equal(b.eval('tacticalSnapshot(exposed,34).bestCell'),46);
  assert.ok(b.eval('tacticalSnapshot(exposed,46).promising'));
});

test('review examples retain a visual line break on narrow screens',()=>{
  assert.match(html,/\.tactical-panel #tactical-details\s*\{\s*white-space:\s*pre-line;/);
});

test('language switching updates challenge and review without resetting a completed game',()=>{
  const b=boot();
  b.nodes.get('game-mode').value='daily';
  b.nodes.get('game-mode').handlers.change();
  b.eval('startBattle();game.enemy=createBoard();placeShip(game.enemy,[0]);playerFire(0)');
  assert.equal(b.game().phase,'finished');
  b.eval('setLanguage("ru")');
  assert.match(b.nodes.get('daily-details').textContent,/Испытание по UTC/);
  assert.match(b.nodes.get('tactical-details').textContent,/Выстрелов/);
  assert.equal(b.game().phase,'finished');
  b.eval('setLanguage("en")');
  assert.match(b.nodes.get('tactical-details').textContent,/Search shots/);
});

test('same daily UTC fleet across Russian and American careers and locales',()=>{
  const ru=boot(new Map(),true,['ru-RU']);
  const us=boot(new Map(),true,['en-US']);
  for(const day of ['2026-11-02','2026-11-03','2027-01-01']){
    const expression='JSON.stringify(dailyFleet("'+day+'").cells)';
    assert.equal(ru.eval(expression),us.eval(expression));
  }
  ru.eval('setLanguage("en")');
  us.eval('setLanguage("ru")');
  assert.equal(ru.eval('JSON.stringify(dailyFleet("2026-11-02").cells)'),
    us.eval('JSON.stringify(dailyFleet("2026-11-02").cells)'));
});

test('postgame review names concrete higher-scored cells only after a finished match',()=>{
  const b=boot(new Map(),true,['ru-RU']);
  b.eval('startBattle()');
  b.eval('game.trace=[{mode:"hunt",chosen:0,bestCell:44,selected:1,max:5,promising:false,outcome:"miss"}];render()');
  assert.equal(b.nodes.get('tactical-panel').hidden,true);
  b.eval('game.phase="finished";render()');
  assert.equal(b.nodes.get('tactical-panel').hidden,false);
  assert.match(b.nodes.get('tactical-details').textContent,/А1 → Д5/);
  b.eval('setLanguage("en")');
  assert.match(b.nodes.get('tactical-details').textContent,/A1 → E5/);
});
