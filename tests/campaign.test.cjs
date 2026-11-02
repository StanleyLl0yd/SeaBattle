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

test('all 19 ranks and the cumulative 45-win milestone match the approved ladder',()=>{
  const b=boot();
  assert.deepEqual(Array.from(b.eval('PROMOTION_WINS')), [1,2,3,5,7,9,11,13,15,17,20,23,26,29,32,36,40,45]);
  assert.equal(b.eval('RANK_NAMES.en.length'),19);
  assert.equal(b.eval('RANK_NAMES.ru.length'),19);
  assert.equal(b.eval('RANK_NAMES.ru[0]'),'Матрос');
  assert.equal(b.eval('RANK_NAMES.ru[18]'),'Адмирал флота');
  assert.equal(b.eval('US_RANKS.en[18]'),'Admiral');
  for(let wins=0;wins<=50;wins++){
    const expected=1+[1,2,3,5,7,9,11,13,15,17,20,23,26,29,32,36,40,45].filter(n=>wins>=n).length;
    assert.equal(b.eval('rankForWins('+wins+')'),expected,'win count '+wins);
  }
});

test('campaign wins unlock ranks exactly once, losses never demote',()=>{
  const b=boot();
  assert.equal(b.game().mode,'campaign');
  for(let win=1;win<=45;win++){
    b.eval('startBattle();finish("player");render()');
    assert.equal(b.career().wins,win);
    assert.equal(b.game().promotion, [1,2,3,5,7,9,11,13,15,17,20,23,26,29,32,36,40,45].includes(win) ? b.eval('rankForWins('+win+')') : 0);
    b.eval('finish("player")');
    assert.equal(b.career().wins,win,'double-finish must not duplicate victory');
    b.eval('setUpGame()');
  }
  assert.equal(b.eval('rankForWins(career.wins)'),19);
  assert.equal(b.nodes.get('career-progress').value,1);
  b.eval('startBattle();finish("computer");render()');
  assert.equal(b.eval('rankForWins(career.wins)'),19);
  assert.equal(b.career().losses,1);
  assert.equal(b.career().streak,0);
  assert.ok(b.nodes.get('career-progress-text').textContent.includes('Highest rank'));
  assert.ok(b.career().achievements.includes('achievementStreak'));
});

test('quick battles support all ranks, do not grant career victories',()=>{
  const b=boot();
  b.nodes.get('game-mode').value='quick';
  b.nodes.get('game-mode').handlers.change();
  b.nodes.get('quick-level').value='19';
  b.nodes.get('quick-level').handlers.change();
  assert.equal(b.game().level,19);
  b.eval('startBattle();finish("player");render()');
  assert.deepEqual(b.career(),{wins:0,losses:0,streak:0,bestStreak:0,achievements:[],
    warrantWins:0,warrantLosses:0,fleetStreak:0,fleetAdmiral:false});
  assert.match(b.nodes.get('status-text').textContent,/Quick battle/);
  b.eval('setUpGame()');
  assert.equal(b.game().level,19);
  b.nodes.get('game-mode').value='campaign';
  b.nodes.get('game-mode').handlers.change();
  assert.equal(b.game().level,1);
});

test('career and honors persist, language changes do not reset the match',()=>{
  const saved=new Map();
  const b=boot(saved);
  b.eval('startBattle();game.enemy=createBoard();placeShip(game.enemy,[0]);playerFire(0)');
  assert.equal(b.career().wins,1);
  assert.ok(b.career().achievements.includes('achievementFirst'));
  assert.ok(b.career().achievements.includes('achievementPrecision'));
  assert.equal(b.game().promotion,2);
  b.eval('setLanguage("ru")');
  assert.match(b.nodes.get('promotion').textContent,/Матрос-ученик/);
  assert.match(b.nodes.get('career-rank').textContent,/Матрос-ученик/);
  const reopened=boot(saved,true,['en-US']);
  assert.equal(reopened.career().wins,1);
  assert.match(reopened.nodes.get('career-rank').textContent,/Seaman Apprentice/);
});

test('rank selector and remaining-win indicator localize without changing progress',()=>{
  const b=boot();
  assert.match(b.nodes.get('quick-level').innerHTML,/value="19"/);
  assert.match(b.nodes.get('career-progress-text').textContent,/Wins until promotion: 1 \(0 \/ 1\)/);
  b.eval('setLanguage("ru")');
  assert.match(b.nodes.get('career-progress-text').textContent,/Побед до повышения: 1 \(0 \/ 1\)/);
  assert.match(b.nodes.get('quick-level').innerHTML,/Адмирал \(O-10\)/);
  assert.match(b.nodes.get('rank-list').innerHTML,/Главный петти-офицер/);
  assert.equal(b.doc.documentElement.lang,'ru');
});

test('unavailable browser storage does not break campaign play',()=>{
  const b=boot();
  b.eval('localStorage.getItem=()=>{throw new Error("blocked")};careers=loadCareers();career=careers[navy]');
  assert.equal(b.career().wins,0);
  b.eval('localStorage.setItem=()=>{throw new Error("blocked")};startBattle();finish("player");render()');
  assert.equal(b.career().wins,1);
});

test('reset requires confirmation and drops all career data, not game options',()=>{
  const saved=new Map();
  const b=boot(saved,false);
  b.eval('startBattle();finish("player");render()');
  b.nodes.get('career-reset').click();
  assert.equal(b.career().wins,1);
  const approved=boot(saved,true);
  approved.nodes.get('career-reset').click();
  assert.equal(approved.career().wins,0);
  assert.equal(approved.game().phase,'setup');
  assert.equal(boot(saved).career().wins,0);
});

test('malformed, oversized and blocked browser storage fail closed',()=>{
  for(const value of ['not json','{"wins":-1}', '{"wins":9007199254740992}',
    '{"wins":2,"losses":0,"streak":3,"bestStreak":3,"achievements":[]}',
    '{"wins":2,"losses":0,"streak":0,"bestStreak":0,"achievements":"bogus"}']){
    const b=boot(new Map([['seabattle.career.v1',value]]));
    assert.equal(b.career().wins,0);
  }
  const b=boot();
  assert.equal(b.eval('freshCareer().wins'),0);
});


test('Russian victory counts decline correctly in rank milestones and Warrant trials',()=>{
  const b=boot(new Map(),true,['ru-RU']);
  const samples={
    0:'0 побед',1:'1 победа',2:'2 победы',3:'3 победы',4:'4 победы',5:'5 побед',
    7:'7 побед',9:'9 побед',10:'10 побед',11:'11 побед',12:'12 побед',
    13:'13 побед',14:'14 побед',15:'15 побед',17:'17 побед',20:'20 побед',21:'21 победа',
    22:'22 победы',23:'23 победы',24:'24 победы',25:'25 побед',26:'26 побед',29:'29 побед',
    32:'32 победы',36:'36 побед',40:'40 побед',45:'45 побед',
    101:'101 победа',111:'111 побед',112:'112 побед',121:'121 победа'
  };
  for(const [n,expected] of Object.entries(samples))
    assert.equal(b.eval('formatWinCount('+n+')'),expected,n);
  const ranks=b.nodes.get('rank-list').innerHTML;
  assert.match(ranks,/Старший матрос · 1 победа/);
  for(const threshold of [5,7,9,11,13,15,17,20,23,26,29,32,36,40,45])
    assert.ok(ranks.includes(' · '+samples[threshold]),'rank milestone '+threshold);
  assert.doesNotMatch(ranks,/5 победы|7 победы|11 победы|15 победы|20 победы/);
  b.nodes.get('navy-select').value='us';
  b.nodes.get('navy-select').handlers.change();
  assert.match(b.nodes.get('career-special').textContent,/2 победы/);
  b.eval('career.warrantWins=3;render()');
  assert.match(b.nodes.get('career-special').textContent,/1 победа/);
});

test('English victory counts use singular and plural independently of navy',()=>{
  const b=boot(new Map(),true,['en-US']);
  assert.equal(b.eval('formatWinCount(1)'),'1 victory');
  assert.equal(b.eval('formatWinCount(2)'),'2 victories');
  assert.equal(b.eval('formatWinCount(45)'),'45 victories');
  assert.match(b.nodes.get('rank-list').innerHTML,/Seaman Apprentice \(E-2\) · 1 victory/);
  assert.match(b.nodes.get('rank-list').innerHTML,/Petty Officer Second Class \(E-5\) · 5 victories/);
  assert.match(b.nodes.get('career-special').textContent,/2 victories/);
  b.eval('setLanguage("ru")');
  assert.match(b.nodes.get('rank-list').innerHTML,/Матрос-ученик \(E-2\).*1 победа/);
  b.eval('setLanguage("en")');
  assert.match(b.nodes.get('rank-list').innerHTML,/1 victory/);
});

test('defeat by actual computer turn shows visible new-battle action and preserves career',()=>{
  const b=boot(new Map(),true,['ru-RU']);
  assert.equal(b.nodes.get('result-actions').hidden,true);
  b.eval('startBattle()');
  assert.equal(b.nodes.get('result-actions').hidden,true);
  b.nodes.get('play-again').click();
  assert.equal(b.game().phase,'playing','Hidden action must not restart during a battle');
  b.eval('game.player=createBoard();placeShip(game.player,[99]);game.player.shots.fill("miss");game.player.shots[99]=null;game.turn="computer";computerFire(epoch)');
  assert.equal(b.game().phase,'finished');
  assert.equal(b.nodes.get('result-actions').hidden,false);
  assert.equal(b.career().losses,1);
  assert.equal(b.career().wins,0);
  assert.match(b.nodes.get('status-text').textContent,/Поражение/);
  b.nodes.get('play-again').click();
  assert.equal(b.game().phase,'setup');
  assert.equal(b.nodes.get('result-actions').hidden,true);
  assert.equal(b.career().losses,1,'Restarting must not erase or duplicate a loss');
  assert.equal(b.career().wins,0);
  assert.equal(b.eval('game.player.ships.length'),10);
});

test('new-battle action appears after player victory, translates live and respects quick mode',()=>{
  const b=boot(new Map(),true,['en-US']);
  b.nodes.get('game-mode').value='quick';
  b.nodes.get('game-mode').handlers.change();
  b.nodes.get('quick-level').value='19';
  b.nodes.get('quick-level').handlers.change();
  b.eval('startBattle();game.enemy=createBoard();placeShip(game.enemy,[0]);playerFire(0)');
  assert.equal(b.game().phase,'finished');
  assert.equal(b.nodes.get('result-actions').hidden,false);
  assert.equal(b.career().wins,0,'Quick victories still do not advance careers');
  b.eval('setLanguage("ru")');
  assert.equal(b.eval('I18N.ru.playAgain'),'↻ Новая партия');
  assert.match(b.nodes.get('status-text').textContent,/Победа/);
  assert.equal(b.nodes.get('result-actions').hidden,false);
  b.nodes.get('play-again').click();
  assert.equal(b.game().phase,'setup');
  assert.equal(b.game().mode,'quick');
  assert.equal(b.game().level,19);
  assert.equal(b.nodes.get('result-actions').hidden,true);
});
