'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const {html,script,paths}=require('./source.cjs');

function boot(saved=new Map(),language='en-US') {
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
    document,navigator:{languages:[language]},
    localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)},
    confirm:()=>true,setTimeout(){}
  });
  vm.runInContext(script,context);
  return {saved,nodes,eval:source=>vm.runInContext(source,context),
    stats:()=>JSON.parse(vm.runInContext('JSON.stringify(personalStats)',context))};
}

test('statistics are loaded after career, ordered before the UI and included in the offline shell',()=>{
  assert.equal(paths[2],'js/stats.js');
  assert.match(html,/<script defer src="js\/stats\.js"><\/script>/);
  assert.match(html,/<details class="stats-panel"/);
  const b=boot();
  assert.match(b.nodes.get('stats-summary').textContent,/Games: 0.*Wins: 0/);
  assert.equal(b.nodes.get('stats-list').children.length,6);
  assert.equal(b.saved.size,0,'loading and rendering must not write data');
});

test('only completed matches are recorded once, and never raw board or shot information',()=>{
  const saved=new Map(),b=boot(saved);
  b.nodes.get('game-mode').value='quick';
  b.nodes.get('game-mode').handlers.change();
  b.eval('startBattle()');
  assert.equal(saved.has('seabattle.stats.v1'),false);
  b.eval('game.enemy=createBoard();placeShip(game.enemy,[0]);playerFire(0)');
  b.eval('finish("player")');
  const stats=b.stats();
  assert.deepEqual(stats.quick,{games:1,wins:1,shots:1,hits:1,best:1});
  assert.equal(stats.us.games+stats.ru.games,0,'quick battles cannot count as career');
  assert.match(b.nodes.get('stats-summary').textContent,/Games: 1.*Wins: 1/);
  const record=JSON.parse(saved.get('seabattle.stats.v1'));
  assert.equal(record.version,1);
  assert.deepEqual(Object.keys(record),['version','modes']);
  assert.deepEqual(Object.keys(record.modes.quick),['games','wins','shots','hits','best']);
  assert.doesNotMatch(JSON.stringify(record),/cells|ships|trace|fleet|coords|board|index|seed|dailyDate/);
  assert.equal(saved.has('seabattle.careers.v2'),false);
  assert.equal(saved.has('seabattle.daily.v1'),false);
  assert.deepEqual(boot(saved).stats().quick,stats.quick,'completed results persist across reloads');
});

test('mode and navy isolation, aggregate hit accuracy and best victorious result',()=>{
  const b=boot();
  assert.equal(b.eval('recordPersonalResult("player","campaign","ru",25,20)'),true);
  assert.equal(b.eval('recordPersonalResult("computer","campaign","us",10,6)'),true);
  assert.equal(b.eval('recordPersonalResult("player","quick","us",40,20)'),true);
  assert.equal(b.eval('recordPersonalResult("player","quick","ru",30,20)'),true);
  assert.equal(b.eval('recordPersonalResult("player","daily","ru",29,20)'),true);
  assert.equal(b.eval('recordPersonalResult("player","warrant","us",34,20)'),true);
  assert.equal(b.eval('recordPersonalResult("computer","fleet","us",12,7)'),true);
  const s=b.stats();
  assert.deepEqual(s.quick,{games:2,wins:2,shots:70,hits:40,best:30});
  assert.deepEqual(s.us,{games:1,wins:0,shots:10,hits:6,best:null});
  assert.deepEqual(s.ru,{games:1,wins:1,shots:25,hits:20,best:25});
  assert.equal(s.daily.games,1);
  assert.equal(s.warrant.games,1);
  assert.equal(s.fleet.wins,0);
  b.eval('render()');
  assert.match(b.nodes.get('stats-summary').textContent,/Games: 7.*Wins: 5.*Losses: 2.*Accuracy: 76%/);
  assert.ok(b.nodes.get('stats-list').children.some(item=>/Quick battle.*Best victory shots: 30/.test(item.textContent)));
  assert.equal(b.eval('recordPersonalResult("player","unknown","ru",25,20)'),false);
  assert.equal(b.eval('recordPersonalResult("player","campaign","xx",25,20)'),false);
  assert.equal(b.eval('recordPersonalResult("player","quick","ru",101,20)'),false);
  assert.equal(b.eval('recordPersonalResult("player","quick","ru",20,21)'),false);
  assert.equal(b.stats().quick.games,2);
});

test('corrupt, hostile or blocked storage cannot break play or contaminate records',()=>{
  for(const input of ['{broken','null','[]','{"version":2,"modes":{}}']) {
    const b=boot(new Map([['seabattle.stats.v1',input]]));
    assert.equal(b.stats().quick.games,0);
  }
  const malicious={version:1,modes:{
    quick:{games:1000001,wins:1000001,shots:0,hits:0,best:1},
    ru:{games:1,wins:3,shots:101,hits:21,best:0},
    daily:{games:1,wins:1,shots:25,hits:20,best:25,secret:'should be discarded'}
  }};
  const b=boot(new Map([['seabattle.stats.v1',JSON.stringify(malicious)]]));
  assert.equal(b.stats().quick.games,0);
  assert.equal(b.stats().ru.games,0);
  assert.deepEqual(b.stats().daily,{games:1,wins:1,shots:25,hits:20,best:25});
  b.eval('localStorage.setItem=()=>{throw Error("blocked")}');
  b.eval('recordPersonalResult("computer","quick","ru",30,12);render()');
  assert.equal(b.stats().quick.games,1);
  b.eval('localStorage.getItem=()=>{throw Error("blocked")}');
  assert.equal(b.eval('loadPersonalStats().quick.games'),0);
});

test('RU/EN stats panel re-renders without changing game, and career reset leaves stats intact',()=>{
  const saved=new Map(),b=boot(saved,'ru-RU');
  b.eval('recordPersonalResult("player","quick","ru",30,20);render()');
  assert.match(b.nodes.get('stats-summary').textContent,/Партий: 1.*Побед: 1.*Точность: 67%/);
  assert.match(b.nodes.get('stats-list').children[2].textContent,/Быстрый бой/);
  const prior=b.eval('JSON.stringify(game.player.cells)');
  b.eval('setLanguage("en")');
  assert.match(b.nodes.get('stats-summary').textContent,/Games: 1.*Wins: 1/);
  assert.equal(b.eval('JSON.stringify(game.player.cells)'),prior);
  b.nodes.get('career-reset').click();
  assert.equal(b.stats().quick.games,1);
  assert.equal(b.eval('career.wins'),0);
  assert.equal(b.saved.has('seabattle.stats.v1'),true);
});
