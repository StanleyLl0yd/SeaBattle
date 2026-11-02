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
    game:()=>JSON.parse(vm.runInContext('JSON.stringify({mode:game.mode,level:game.level,phase:game.phase,promotion:game.promotion,specialPromotion:game.specialPromotion,navy:game.navy})',context))
  };
}


test('US main ladder has 19 aligned E/O codes, separate W-1..W-5 and historical Fleet Admiral',()=>{
  const b=boot();
  assert.equal(b.eval('navy'),'us');
  assert.deepEqual(Array.from(b.eval('US_CODES')), [
    'E-1','E-2','E-3','E-4','E-5','E-6','E-7','E-8','E-9',
    'O-1','O-2','O-3','O-4','O-5','O-6','O-7','O-8','O-9','O-10'
  ]);
  assert.equal(b.eval('US_RANKS.en[0]'),'Seaman Recruit');
  assert.equal(b.eval('US_RANKS.en[18]'),'Admiral');
  assert.equal(b.eval('US_RANKS.ru[12]'),'Лейтенант-коммандер');
  assert.deepEqual(Array.from(b.eval('WARRANT_CODES')),['W-1','W-2','W-3','W-4','W-5']);
  assert.deepEqual(Array.from(b.eval('WARRANT_WINS')),[2,4,7,10,14]);
  assert.equal(b.eval('warrantRankForWins(14)'),5);
  assert.equal(b.eval('RANK_NAMES.ru[18]'),'Адмирал флота');
  assert.match(b.nodes.get('rank-list').innerHTML,/Admiral \(O-10\)/);
  assert.equal(b.nodes.get('career-special').hidden,false);
});

test('locale chooses initial navy but language switch does not switch navy or erase progress',()=>{
  const ru=boot(new Map(),true,['ru-RU']);
  assert.equal(ru.eval('navy'),'ru');
  assert.equal(ru.nodes.get('career-special').hidden,true);
  ru.eval('startBattle();finish("player");render()');
  assert.equal(ru.career().wins,1);
  ru.eval('setLanguage("en")');
  assert.equal(ru.eval('navy'),'ru');
  assert.match(ru.nodes.get('career-rank').textContent,/Senior Seaman/);
  const us=boot(new Map(),true,['en-US']);
  assert.equal(us.eval('navy'),'us');
  us.eval('setLanguage("ru")');
  assert.equal(us.eval('navy'),'us');
  assert.match(us.nodes.get('rank-list').innerHTML,/Матрос-рекрут.*Seaman Recruit/);
});

test('legacy RU career migrates with all earned wins and medals, no destructive removal',()=>{
  const key='seabattle.career.v1';
  const old={wins:23,losses:5,streak:3,bestStreak:4,
    achievements:['achievementFirst','achievementStreak']};
  const storage=new Map([[key,JSON.stringify(old)]]);
  const us=boot(storage,true,['en-US']);
  assert.equal(us.career().wins,0);
  assert.equal(us.eval('careers.ru.wins'),23);
  assert.equal(us.eval('rankForWins(careers.ru.wins)'),13);
  us.eval('startBattle();finish("player");render()');
  assert.equal(us.career().wins,1);
  assert.equal(storage.get(key),JSON.stringify(old),'Never modify legacy progress');
  const stored=JSON.parse(storage.get('seabattle.careers.v2'));
  assert.equal(stored.version,2);
  assert.equal(stored.ru.wins,23);
  assert.equal(stored.us.wins,1);
  const reopened=boot(storage,true,['en-US']);
  reopened.nodes.get('navy-select').value='ru';
  reopened.nodes.get('navy-select').handlers.change();
  assert.equal(reopened.career().wins,23);
  assert.ok(reopened.career().achievements.includes('achievementStreak'));
  assert.equal(reopened.game().level,13);
  reopened.eval('setLanguage("en")');
  assert.match(reopened.nodes.get('career-rank').textContent,/Captain 3rd Rank/);
});

test('nation selection swaps independent careers only in setup and saves preference',()=>{
  const storage=new Map();
  const b=boot(storage);
  b.eval('startBattle();finish("player");render();setUpGame()');
  assert.equal(b.career().wins,1);
  b.nodes.get('navy-select').value='ru';
  b.nodes.get('navy-select').handlers.change();
  assert.equal(b.eval('navy'),'ru');
  assert.equal(b.career().wins,0);
  b.eval('startBattle();finish("player");render();setUpGame()');
  assert.equal(b.career().wins,1);
  b.nodes.get('navy-select').value='us';
  b.nodes.get('navy-select').handlers.change();
  assert.equal(b.career().wins,1);
  assert.equal(storage.get('seabattle.navy.v1'),'us');
  b.eval('startBattle()');
  b.nodes.get('navy-select').value='ru';
  b.nodes.get('navy-select').handlers.change();
  assert.equal(b.eval('navy'),'us','Cannot change active battle nation');
  assert.equal(b.game().phase,'playing');
  const reopen=boot(storage);
  assert.equal(reopen.eval('navy'),'us');
  assert.equal(reopen.career().wins,1);
});

test('Warrant trials lock until US main E-7, then unlock all five grades without main wins',()=>{
  const b=boot();
  b.nodes.get('game-mode').value='warrant';
  b.nodes.get('game-mode').handlers.change();
  assert.equal(b.game().mode,'campaign');
  assert.equal(b.nodes.get('mode-warrant').disabled,true);
  b.eval('career.wins=9;saveCareers();render()');
  assert.equal(b.nodes.get('mode-warrant').disabled,false);
  b.nodes.get('game-mode').value='warrant';
  b.nodes.get('game-mode').handlers.change();
  assert.equal(b.game().mode,'warrant');
  assert.equal(b.game().level,9);
  for(let n=1;n<=14;n++) {
    b.eval('startBattle();finish("player");render()');
    assert.equal(b.career().warrantWins,n);
    assert.equal(b.career().wins,9,'Specialist trials never count as campaign wins');
    assert.equal(b.game().specialPromotion,[2,4,7,10,14].includes(n)?b.eval('warrantRankForWins('+n+')'):0);
    b.eval('finish("player")');
    assert.equal(b.career().warrantWins,n,'Double results must not count');
    b.eval('setUpGame()');
  }
  assert.equal(b.eval('warrantRankForWins(career.warrantWins)'),5);
  assert.equal(b.game().level,19);
  assert.match(b.nodes.get('career-special').textContent,/Chief Warrant Officer 5/);
});

test('Fleet Admiral is an optional historic five-star award after three consecutive level-19 wins',()=>{
  const b=boot();
  b.nodes.get('game-mode').value='fleet';
  b.nodes.get('game-mode').handlers.change();
  assert.equal(b.game().mode,'campaign','Fleet mode locked below Admiral');
  b.eval('career.wins=45;saveCareers();render()');
  assert.equal(b.nodes.get('mode-fleet').disabled,false);
  b.nodes.get('game-mode').value='fleet';
  b.nodes.get('game-mode').handlers.change();
  assert.equal(b.game().level,19);
  for(let i=0;i<2;i++)b.eval('startBattle();finish("player");render();setUpGame()');
  assert.equal(b.career().fleetStreak,2);
  assert.equal(b.career().fleetAdmiral,false);
  b.eval('startBattle();finish("computer");render();setUpGame()');
  assert.equal(b.career().fleetStreak,0);
  for(let i=0;i<3;i++){
    b.eval('startBattle();finish("player");render()');
    assert.equal(b.game().specialPromotion,i===2?6:0);
    b.eval('setUpGame()');
  }
  assert.equal(b.career().fleetAdmiral,true);
  assert.equal(b.career().wins,45);
  assert.match(b.nodes.get('career-special').textContent,/historical|no longer/i);
  b.eval('startBattle();finish("computer");render()');
  assert.equal(b.career().fleetAdmiral,true,'Once earned, award is permanent');
});

test('reset clears selected navy only; RU original storage stays available',()=>{
  const storage=new Map([['seabattle.career.v1',JSON.stringify({
    wins:9,losses:0,streak:0,bestStreak:0,achievements:[]
  })]]);
  const b=boot(storage,true,['en-US']);
  b.eval('startBattle();finish("player");render()');
  b.nodes.get('career-reset').click();
  assert.equal(b.career().wins,0);
  assert.equal(b.eval('careers.ru.wins'),9);
  assert.ok(storage.has('seabattle.career.v1'));
  b.nodes.get('navy-select').value='ru';
  b.nodes.get('navy-select').handlers.change();
  assert.equal(b.career().wins,9);
});

test('malformed dual profile safely falls back to valid legacy RU profile',()=>{
  const legacy={wins:12,losses:1,streak:0,bestStreak:2,achievements:[]};
  const saved=new Map([['seabattle.career.v1',JSON.stringify(legacy)],
    ['seabattle.careers.v2','{broken']]);
  const b=boot(saved);
  assert.equal(b.eval('careers.ru.wins'),12);
  assert.equal(b.eval('careers.us.wins'),0);
  b.eval('startBattle();finish("player");render()');
  assert.equal(b.career().wins,1);
  const after=JSON.parse(saved.get('seabattle.careers.v2'));
  assert.equal(after.ru.wins,12);
});

test('existing Fleet Admiral progress of three or four wins is honored on upgrade',()=>{
  for(const oldStreak of [3,4,5]) {
    const us={wins:45,losses:0,streak:0,bestStreak:0,achievements:[],
      warrantWins:0,warrantLosses:0,fleetStreak:oldStreak,fleetAdmiral:false};
    const ru={wins:0,losses:0,streak:0,bestStreak:0,achievements:[]};
    const saved=new Map([['seabattle.careers.v2',JSON.stringify({version:2,us,ru})]]);
    const b=boot(saved);
    assert.equal(b.career().fleetStreak,3);
    assert.equal(b.career().fleetAdmiral,true,'Earlier completed streak must count for relaxed threshold');
    assert.equal(b.career().wins,45);
    b.eval('startBattle();finish("computer");render()');
    assert.equal(b.career().fleetAdmiral,true);
  }
});
