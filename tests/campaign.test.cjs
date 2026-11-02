'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
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
  assert.deepEqual(b.career(),{wins:0,losses:0,streak:0,bestStreak:0,achievements:[]});
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
  assert.match(b.nodes.get('promotion').textContent,/Старший матрос/);
  assert.match(b.nodes.get('career-rank').textContent,/Старший матрос/);
  const reopened=boot(saved,['ru-RU']);
  assert.equal(reopened.career().wins,1);
  assert.match(reopened.nodes.get('career-rank').textContent,/Senior Seaman/);
});

test('rank selector and remaining-win indicator localize without changing progress',()=>{
  const b=boot();
  assert.match(b.nodes.get('quick-level').innerHTML,/value="19"/);
  assert.match(b.nodes.get('career-progress-text').textContent,/Wins until promotion: 1 \(0 \/ 1\)/);
  b.eval('setLanguage("ru")');
  assert.match(b.nodes.get('career-progress-text').textContent,/Побед до повышения: 1 \(0 \/ 1\)/);
  assert.match(b.nodes.get('quick-level').innerHTML,/Адмирал флота/);
  assert.match(b.nodes.get('rank-list').innerHTML,/Главный корабельный старшина/);
  assert.equal(b.doc.documentElement.lang,'ru');
});

test('unavailable browser storage does not break campaign play',()=>{
  const b=boot();
  b.eval('localStorage.getItem=()=>{throw new Error("blocked")};career=loadCareer()');
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
