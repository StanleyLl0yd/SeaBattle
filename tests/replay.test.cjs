'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const {script,html,paths}=require('./source.cjs');

function boot(saved=new Map()) {
  const nodes=new Map(),timeouts=[];
  const make=()=>({
    value:'',checked:false,textContent:'',innerHTML:'',style:{},dataset:{},children:[],
    classList:{toggle(){},add(){},remove(){}},handlers:{},
    addEventListener(k,fn){this.handlers[k]=fn;},click(){this.handlers.click?.();},
    querySelectorAll(){return[];},setAttribute(){},replaceChildren(...items){this.children=items;}
  });
  for(const m of html.matchAll(/\bid="([^"]+)"/g))nodes.set(m[1],make());
  const translated=[...html.matchAll(/\bdata-i18n="([^"]+)"/g)].map(m=>{
    const n=make();n.dataset.i18n=m[1];return n;});
  const arias=[...html.matchAll(/\bdata-i18n-aria-label="([^"]+)"/g)].map(m=>{
    const n=make();n.dataset.i18nAriaLabel=m[1];return n;});
  const document={documentElement:{lang:'en'},getElementById:id=>nodes.get(id),
    createElement:make,addEventListener(){},
    querySelectorAll:sel=>sel==='[data-i18n]'?translated:
      sel==='[data-i18n-aria-label]'?arias:sel==='.cols'?[make(),make()]:[]};
  const storage={getItem:key=>saved.get(key)??null,
    setItem:(key,value)=>saved.set(key,value),
    removeItem:key=>saved.delete(key)};
  const context=vm.createContext({document,navigator:{languages:['en-US']},
    localStorage:storage,confirm:()=>true,
    setTimeout:(fn,ms)=>{timeouts.push({fn,ms});return timeouts.length;}});
  vm.runInContext(script,context,{filename:'runtime'});
  return {nodes,saved,timeouts,eval:code=>vm.runInContext(code,context),
    json:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',context))};
}

test('new runtime module is cached offline, ordered and localized',()=>{
  assert.ok(paths.indexOf('js/daily.js')<paths.indexOf('js/replay.js'));
  assert.ok(paths.indexOf('js/replay.js')<paths.indexOf('js/ui.js'));
  for(const id of ['series-panel','series-details','stats-trend','fast-tempo','rematch'])
    assert.match(html,new RegExp('id="'+id+'"'));
  const b=boot();
  b.eval('setLanguage("ru")');
  assert.match(b.nodes.get('stats-trend').textContent,/Победы/);
  assert.match(b.nodes.get('series-details').textContent,/Три боя/);
});

test('only first started Daily run receives an official score, practice best remains separate',()=>{
  const b=boot();
  const date='2026-11-03';
  assert.equal(b.eval('beginDailyFirst("'+date+'")'),true);
  assert.equal(b.eval('beginDailyFirst("'+date+'")'),false);
  assert.equal(b.eval('completeDailyFirst("'+date+'",35)'),true);
  assert.equal(b.eval('completeDailyFirst("'+date+'",20)'),false);
  assert.equal(b.eval('saveDailyScore("'+date+'",35)'),35);
  assert.equal(b.eval('saveDailyScore("'+date+'",28)'),28);
  assert.equal(b.eval('dailyFirstScore("'+date+'")'),35);
  assert.equal(b.eval('dailyBest("'+date+'")'),28);
  assert.equal(b.eval('beginDailyFirst("2026-11-04")'),true);
  assert.equal(b.eval('beginDailyFirst("2026-11-04")'),false,
    'abandoning a started official attempt must not allow a retry');
  assert.equal(b.eval('dailyFirstScore("2026-11-04")'),null);
  assert.equal(b.eval('beginDailyFirst("2026-02-30")'),false);
  assert.doesNotMatch(b.saved.get('seabattle.daily.first.v1'),/ships|cells|coordinates|trace/);
  const other=boot(b.saved);
  assert.equal(other.eval('dailyFirstScore("'+date+'")'),35);
  assert.equal(other.eval('beginDailyFirst("'+date+'")'),false);
});

test('legacy Daily scores are practice-only and past saved bests are unchanged',()=>{
  const saved=new Map([['seabattle.daily.v1','{"2026-11-03":27}']]);
  const b=boot(saved);
  assert.equal(b.eval('beginDailyFirst("2026-11-03")'),false);
  assert.equal(b.eval('dailyFirstScore("2026-11-03")'),undefined);
  assert.equal(b.eval('saveDailyScore("2026-11-03",25)'),25);
  assert.equal(b.saved.has('seabattle.daily.first.v1'),false);
});

test('series runs three battles at a single difficulty and records only best summaries',()=>{
  const b=boot();
  b.nodes.get('game-mode').value='series';
  b.nodes.get('quick-level').value='19';
  b.nodes.get('game-mode').handlers.change();
  for(let round=1;round<=3;round++){
    if(round===1)b.eval('startBattle()');
    else b.nodes.get('play-again').click();
    assert.equal(b.eval('game.phase'),'playing');
    assert.equal(b.eval('game.level'),19);
    b.eval('game.enemy=createBoard();placeShip(game.enemy,[0]);playerFire(0)');
    assert.equal(b.eval('game.phase'),'finished');
    assert.equal(b.eval('seriesRun.played'),round);
  }
  assert.equal(b.eval('seriesRun.wins'),3);
  assert.equal(b.eval('journal.matches.length'),3);
  assert.equal(b.eval('journal.seriesBest["19"].wins'),3);
  assert.equal(b.eval('journal.seriesBest["19"].shots'),3);
  assert.equal(b.eval('personalStats.quick.games'),3,'series feeds existing quick aggregates');
  const stored=b.saved.get('seabattle.journal.v1');
  assert.doesNotMatch(stored,/cells|ships|trace|layout|coordinates/);
  assert.equal(b.nodes.get('rematch').hidden,true);
  b.nodes.get('play-again').click();
  assert.equal(b.eval('game.phase'),'setup');
  assert.equal(b.eval('seriesRun'),null);
  assert.equal(boot(b.saved).eval('journal.seriesBest["19"].wins'),3);
});

test('instant rematch reuses player fleet and difficulty, but regenerates opponent',()=>{
  const b=boot();
  b.nodes.get('game-mode').value='quick';
  b.nodes.get('quick-level').value='18';
  b.nodes.get('game-mode').handlers.change();
  const player=b.eval('JSON.stringify(game.player.ships.map(s=>s.cells))');
  const enemy=b.eval('JSON.stringify(game.enemy.ships.map(s=>s.cells))');
  b.eval('startBattle();game.enemy=createBoard();placeShip(game.enemy,[0]);playerFire(0)');
  b.nodes.get('rematch').click();
  assert.equal(b.eval('game.phase'),'playing');
  assert.equal(b.eval('game.level'),18);
  assert.equal(b.eval('game.mode'),'quick');
  assert.equal(b.eval('JSON.stringify(game.player.ships.map(s=>s.cells))'),player);
  assert.notEqual(b.eval('JSON.stringify(game.enemy.ships.map(s=>s.cells))'),enemy);
});

test('fast computer tempo is optional and persists locally',()=>{
  const b=boot();
  b.nodes.get('fast-tempo').checked=true;
  b.nodes.get('fast-tempo').handlers.change();
  assert.equal(b.eval('fastTempo'),true);
  assert.equal(b.saved.get('seabattle.tempo.v1'),'fast');
  const second=boot(b.saved);
  assert.equal(second.nodes.get('fast-tempo').checked,true);
  second.eval('startBattle()');
  const miss=second.eval('game.enemy.cells.findIndex(v=>v===-1)');
  second.eval('playerFire('+miss+')');
  assert.equal(second.timeouts.at(-1).ms,85);
});

test('journal records only bounded summaries and computes recent progress',()=>{
  const b=boot();
  const date=b.eval('utcChallengeDate()');
  for(let i=0;i<23;i++)
    b.eval('recordJournal("'+(i%2?'player':'computer')+'","quick","ru",'+
      (1+i%19)+','+(24+i%10)+','+(10+i%10)+')');
  const journal=b.json('journal');
  assert.equal(journal.matches.length,23);
  assert.ok(journal.matches.every(row=>row.date===date));
  const summary=b.json('recentPerformance()');
  assert.equal(summary.current.games,10);
  assert.equal(summary.previous.games,10);
  assert.equal(summary.days7,1);
  assert.ok(Number.isInteger(summary.monthBest));
  assert.equal(b.eval('recordJournal("bad","quick","ru",19,30,20)'),false);
  assert.equal(b.eval('journal.matches.length'),23);
  assert.doesNotMatch(b.saved.get('seabattle.journal.v1'),/ship|board|trace|coordinate/);
});

test('all opponent fleet styles remain legal and daily puzzle remains deterministic',()=>{
  const b=boot();
  for(const style of ['balanced','edge','center','spread'])for(let n=0;n<25;n++){
    const legal=b.eval('randomFleet(Math.random,"'+style+'")');
    assert.equal(legal.ships.length,10);
    assert.equal(legal.cells.filter(x=>x!==-1).length,20);
    for(let i=0;i<100;i++)if(legal.cells[i]!==-1)for(const j of b.eval('neighbors('+i+')'))
      if(legal.cells[j]!==-1)assert.equal(legal.cells[i],legal.cells[j]);
  }
  assert.equal(b.eval('JSON.stringify(dailyFleet("2026-11-03").ships.map(s=>s.cells))'),
    b.eval('JSON.stringify(dailyFleet("2026-11-03").ships.map(s=>s.cells))'));
});
