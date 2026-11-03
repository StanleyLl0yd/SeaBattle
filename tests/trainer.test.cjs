'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const {html,script}=require('./source.cjs');

function boot(saved=new Map()){
  const nodes=new Map();
  const node=()=>({
    textContent:'',innerHTML:'',style:{},dataset:{},children:[],handlers:{},
    classList:{toggle(){},add(){},remove(){}},
    addEventListener(type,fn){this.handlers[type]=fn;},
    click(){this.handlers.click?.();},
    querySelectorAll(){return[];},setAttribute(){},
    replaceChildren(...children){this.children=children;}
  });
  for(const m of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(m[1],node());
  const texts=[...html.matchAll(/\bdata-i18n="([^"]+)"/g)].map(m=>{
    const n=node();n.dataset.i18n=m[1];return n;
  });
  const arias=[...html.matchAll(/\bdata-i18n-aria-label="([^"]+)"/g)].map(m=>{
    const n=node();n.dataset.i18nAriaLabel=m[1];return n;
  });
  const document={
    documentElement:{lang:'en'},getElementById:id=>nodes.get(id),createElement:node,
    querySelectorAll:selector=>selector==='[data-i18n]'?texts:selector==='[data-i18n-aria-label]'?arias:
      selector==='.cols'?[node(),node()]:[],
    addEventListener(){}
  };
  const context=vm.createContext({
    document,navigator:{languages:['en-US']},
    localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,val)=>saved.set(key,val)},
    setTimeout(){}
  });
  vm.runInContext(script,context);
  return {nodes,saved,eval:source=>vm.runInContext(source,context)};
}

test('trainer ranks only public legal unshot candidates and never reads hidden positions',()=>{
  const b=boot();
  b.eval('var exposed={shots:Array(100).fill(null),ships:FLEET.map(size=>({size,sunk:false}))}');
  b.eval('Object.defineProperty(exposed,"cells",{get(){throw Error("Hidden board read")}})');
  b.eval('exposed.ships.forEach(s=>Object.defineProperty(s,"cells",{get(){throw Error("Hidden ship read")}}))');
  const initial=JSON.parse(b.eval('JSON.stringify(tacticalCandidates(exposed))'));
  assert.equal(initial.mode,'hunt');
  assert.equal(initial.top.length,3);
  assert.ok(initial.top.every(x=>x.score>0&&x.index>=0&&x.index<100));
  assert.ok(initial.top.every((x,i)=>!i||initial.top[i-1].score>=x.score));
  b.eval('exposed.shots[44]="hit";exposed.shots[45]="hit"');
  const targeted=JSON.parse(b.eval('JSON.stringify(tacticalCandidates(exposed))'));
  assert.equal(targeted.mode,'target');
  assert.ok(targeted.top.every(x=>x.index!==44&&x.index!==45));
  assert.equal(b.eval('tacticalSnapshot(exposed,34).selected'),0);
  assert.ok(b.eval('tacticalSnapshot(exposed,43).selected')>0);
  assert.deepEqual(JSON.parse(b.eval('JSON.stringify(tacticalCandidates({shots:Array(100).fill("miss"),ships:[]}))')),{mode:'hunt',top:[]});
});

test('trainer stays mounted throughout quick battles but is interactive only on human turns',()=>{
  const b=boot();
  assert.equal(b.nodes.get('trainer-panel').hidden,true);
  b.nodes.get('game-mode').value='quick';
  b.nodes.get('game-mode').handlers.change();
  b.eval('startBattle()');
  assert.equal(b.nodes.get('trainer-panel').hidden,false);
  assert.equal(b.nodes.get('trainer-advice').hidden,true);
  b.nodes.get('trainer-toggle').click();
  assert.equal(b.nodes.get('trainer-advice').hidden,false);
  assert.match(b.nodes.get('trainer-suggestions').textContent,/Search candidates/);
  assert.match(b.nodes.get('trainer-comparison').textContent,/first shot/);
  b.eval('game.turn="computer";render()');
  assert.equal(b.nodes.get('trainer-panel').hidden,false,'no panel collapse during the computer turn');
  assert.equal(b.nodes.get('trainer-toggle').disabled,true);
  assert.equal(b.nodes.get('trainer-advice').hidden,false,'open hints stay mounted while the computer fires');
  b.nodes.get('trainer-toggle').click();
  assert.equal(b.eval('game.trainerVisible'),true,'no toggling while computer fires');
  b.eval('game.turn="player";render()');
  assert.equal(b.nodes.get('trainer-panel').hidden,false);
  assert.equal(b.nodes.get('trainer-toggle').disabled,false);
  b.eval('game.phase="finished";render()');
  assert.equal(b.nodes.get('trainer-panel').hidden,true);
  b.eval('setUpGame()');
  assert.equal(b.eval('game.trainerVisible'),false);
  b.nodes.get('game-mode').value='daily';b.nodes.get('game-mode').handlers.change();
  b.eval('startBattle()');
  assert.equal(b.nodes.get('trainer-panel').hidden,true);
  b.nodes.get('trainer-toggle').click();
  assert.equal(b.eval('game.trainerVisible'),false);
});

test('previous-shot comparison localizes and does not mutate fleets or storage',()=>{
  const saved=new Map(),b=boot(saved);
  b.nodes.get('game-mode').value='quick';b.nodes.get('game-mode').handlers.change();
  b.eval('startBattle()');
  const before=JSON.stringify([...saved.entries()]);
  const layout=b.eval('JSON.stringify(game.enemy.cells)');
  b.nodes.get('trainer-toggle').click();
  b.eval('playerFire(0);game.turn="player";render()');
  assert.equal(b.eval('game.trace.length'),1);
  assert.equal(b.eval('game.trace[0].chosen'),0);
  assert.match(b.nodes.get('trainer-comparison').textContent,/Last shot compared before firing: A1/);
  b.eval('setLanguage("ru")');
  assert.match(b.nodes.get('trainer-toggle').textContent,/Скрыть/);
  assert.match(b.nodes.get('trainer-suggestions').textContent,/Клетки поиска|Клетки добивания/);
  assert.match(b.nodes.get('trainer-comparison').textContent,/Последний выстрел: сравнение до выстрела: А1/);
  assert.equal(b.eval('JSON.stringify(game.enemy.cells)'),layout);
  assert.equal(JSON.stringify([...saved.entries()]),before,'hints never write to storage');
});

test('combat status and tactical advice reserve stable heights across shot updates',()=>{
  assert.match(html,/\.statusbar \{[^}]*height:78px;/);
  assert.match(html,/\.status-text \{[^}]*max-height:100%; overflow-y:auto;/);
  assert.match(html,/#trainer-advice:not\(\[hidden\]\) \{[^}]*height:7em; overflow-y:auto;/);
  assert.match(html,/@media\(max-width:720px\) \{ \.statusbar \{ height:104px; \}/);
  assert.match(html,/@media\(max-width:390px\) \{ \.statusbar \{ height:124px; \}/);
});
