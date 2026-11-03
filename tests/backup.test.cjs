'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const {script,html,paths}=require('./source.cjs');

function boot(saved=new Map(), locale='en-US', storageOverride=null) {
  const nodes=new Map();
  const make=()=>({
    textContent:'',value:'',innerHTML:'',style:{},dataset:{},children:[],handlers:{},
    classList:{toggle(){},add(){},remove(){}},
    addEventListener(type,fn){this.handlers[type]=fn;},
    click(){this.handlers.click?.();},
    querySelectorAll(){return[];},
    setAttribute(){},
    replaceChildren(...children){this.children=children;}
  });
  for(const match of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1],make());
  const trans=[...html.matchAll(/\bdata-i18n="([^"]+)"/g)].map(match=>{
    const el=make();el.dataset.i18n=match[1];return el;
  });
  const aria=[...html.matchAll(/\bdata-i18n-aria-label="([^"]+)"/g)].map(match=>{
    const el=make();el.dataset.i18nAriaLabel=match[1];return el;
  });
  const document={
    documentElement:{lang:'en'},getElementById:id=>nodes.get(id),createElement:make,
    querySelectorAll:selector=>selector==='[data-i18n]'?trans:
      selector==='[data-i18n-aria-label]'?aria:selector==='.cols'?[make(),make()]:[],
    addEventListener(){}
  };
  const storage=storageOverride || {
    getItem:key=>saved.get(key)??null,
    setItem:(key,value)=>saved.set(key,value),
    removeItem:key=>saved.delete(key)
  };
  const context=vm.createContext({
    document,navigator:{languages:[locale]},localStorage:storage,confirm:()=>true,setTimeout(){}
  });
  vm.runInContext(script,context);
  return {nodes,saved,eval:code=>vm.runInContext(code,context)};
}

test('backup module is ordered before UI and bundled in offline assets',()=>{
  assert.ok(paths.includes('js/backup.js'));
  assert.ok(paths.indexOf('js/daily.js')<paths.indexOf('js/backup.js'));
  assert.ok(paths.indexOf('js/backup.js')<paths.indexOf('js/ui.js'));
  assert.match(html,/<script defer src="js\/backup\.js"><\/script>/);
  assert.match(html,/<textarea[^>]+id="backup-text"/);
});

test('complete local aggregates round-trip without hidden data or legacy writes',()=>{
  const first=boot();
  first.eval('careers.ru.wins=3;careers.ru.bestStreak=2;careers.us.wins=7;careers.us.streak=1;careers.us.bestStreak=1;navy="ru";career=careers.ru');
  first.eval('recordPersonalResult("player","quick","ru",28,20)');
  first.eval('saveDailyScore("2026-11-02",30);saveDailyScore("2026-11-02",25)');
  const backup=first.eval('createProgressBackup()');
  const parsed=JSON.parse(backup);
  assert.deepEqual(Object.keys(parsed).sort(),['careers','daily','first','journal','navy','stats','version']);
  assert.equal(parsed.version,2);
  assert.deepEqual(parsed.first,{});
  assert.deepEqual(parsed.journal.matches,[]);
  assert.equal(parsed.careers.ru.wins,3);
  assert.equal(parsed.careers.us.wins,7);
  assert.equal(parsed.daily['2026-11-02'],25);
  assert.equal(parsed.stats.modes.quick.best,28);
  assert.doesNotMatch(backup,/cells|ships|trace|shotCoordinates|seed|opponent|identifier/);
  const second=boot();
  assert.equal(second.eval('restoreProgressBackup('+JSON.stringify(backup)+')'),'backupImported');
  assert.equal(second.eval('career.wins'),3);
  assert.equal(second.eval('navy'),'ru');
  assert.equal(second.eval('personalStats.quick.games'),1);
  assert.equal(second.saved.get('seabattle.daily.v1'),'{"2026-11-02":25}');
  assert.equal(second.saved.has('seabattle.career.v1'),false);
  const snapshot=new Map(second.saved);
  assert.equal(second.eval('restoreProgressBackup('+JSON.stringify(backup)+')'),'backupImported');
  assert.deepEqual(second.saved,snapshot,'same backup must be idempotent');
});

test('invalid, oversized and extraneous input is rejected before any write',()=>{
  const b=boot();
  const normal=JSON.parse(b.eval('createProgressBackup()'));
  const examples=[
    '{','x'.repeat(32769),'null','[]',
    JSON.stringify({...normal,version:3}),
    JSON.stringify({...normal,private:'fleet'}),
    JSON.stringify({...normal,navy:'xx'}),
    JSON.stringify({...normal,daily:{'2026-02-30':25}}),
    JSON.stringify({...normal,daily:{'2026-11-02':0}}),
    JSON.stringify({...normal,careers:{...normal.careers,ru:{...normal.careers.ru,wins:1000001}}}),
    JSON.stringify({...normal,stats:{...normal.stats,modes:{...normal.stats.modes,quick:{...normal.stats.modes.quick,games:1,wins:2}}}}),
    '{"version":1,"careers":{},"navy":"ru","daily":{},"stats":{},"__proto__":{"polluted":true}}'
  ];
  for(const value of examples){
    const before=new Map(b.saved);
    assert.equal(b.eval('restoreProgressBackup('+JSON.stringify(value)+')'),'backupInvalid');
    assert.deepEqual(b.saved,before);
  }
  assert.equal(b.eval('({}).polluted'),undefined);
});

test('restore cannot interrupt a running game and requires an explicit UI confirmation',()=>{
  const b=boot();
  const backup=b.eval('createProgressBackup()');
  b.eval('startBattle()');
  const state=b.eval('JSON.stringify(game.player.cells)');
  assert.equal(b.eval('restoreProgressBackup('+JSON.stringify(backup)+')'),'backupPlaying');
  assert.equal(b.eval('JSON.stringify(game.player.cells)'),state);
  assert.equal(b.saved.size,0);
  assert.equal(b.nodes.get('backup-restore').disabled,true);
});

test('storage failures trigger rollback and do not update in-memory profiles',()=>{
  const saved=new Map([['seabattle.navy.v1','us'],['seabattle.daily.v1','{"2026-11-01":25}']]);
  const b=boot(saved);
  const backup=b.eval('createProgressBackup()');
  const newer=JSON.parse(backup);
  newer.navy='ru';
  newer.daily={'2026-11-02':23};
  const changed=JSON.stringify(newer);
  const before=new Map(saved);
  const prior=b.eval('navy');
  let count=0;
  const storage=b.eval('localStorage');
  storage.setItem=(key,value)=>{if(++count===2) throw Error('quota');saved.set(key,value);};
  assert.equal(b.eval('restoreProgressBackup('+JSON.stringify(changed)+')'),'backupStorageError');
  assert.deepEqual(saved,before);
  assert.equal(b.eval('navy'),prior);
  storage.getItem=()=>{throw Error('blocked');};
  assert.equal(b.eval('restoreProgressBackup('+JSON.stringify(changed)+')'),'backupStorageError');
});

test('bilingual controls export selectable text and confirm restore',()=>{
  const b=boot(new Map(),'ru-RU');
  b.nodes.get('backup-export').click();
  assert.match(b.nodes.get('backup-status').textContent,/резервн/i);
  assert.ok(b.nodes.get('backup-text').value.includes('"version":1'));
  b.nodes.get('backup-restore').click();
  assert.match(b.nodes.get('backup-status').textContent,/восстановлен/);
  b.eval('setLanguage("en")');
  assert.match(b.nodes.get('backup-status').textContent,/restored/i);
  assert.equal(b.nodes.get('backup-text').value,'');
});

test('schema key checking cannot confuse delimiters or accept inherited fields',()=>{
  const b=boot();
  assert.equal(b.eval('backupHasKeys({"first|second":1},["first","second"])'),false);
  assert.equal(b.eval('backupHasKeys({"first":1,"second":2},["first","second"])'),true);
  assert.equal(b.eval('backupHasKeys(Object.create({second:2}),["second"])'),false);
  const valid=JSON.parse(b.eval('createProgressBackup()'));
  valid.daily={'2026-02-30':22};
  assert.equal(b.eval('parseProgressBackup('+JSON.stringify(JSON.stringify(valid))+')'),null);
});

test('backup v2 round-trips official Daily and journal, while legacy v1 remains importable',()=>{
  const first=boot();
  first.eval('beginDailyFirst("2026-11-03");completeDailyFirst("2026-11-03",32)');
  first.eval('recordJournal("player","quick","ru",19,35,20)');
  first.eval('completeSeries({level:19,played:3,wins:2,shots:90})');
  const text=first.eval('createProgressBackup()'),json=JSON.parse(text);
  assert.equal(json.version,2);
  assert.equal(json.first["2026-11-03"],32);
  assert.equal(json.journal.matches.length,1);
  assert.equal(json.journal.seriesBest["19"].wins,2);
  const other=boot();
  assert.equal(other.eval('restoreProgressBackup('+JSON.stringify(text)+')'),'backupImported');
  assert.equal(other.eval('dailyFirstScore("2026-11-03")'),32);
  assert.equal(other.eval('journal.matches.length'),1);
  assert.equal(other.eval('journal.seriesBest["19"].wins'),2);
  for(const invalid of [
    {...json,first:{"2026-02-30":24}},
    {...json,journal:{...json.journal,matches:[{...json.journal.matches[0],cells:[12]}]}},
    {...json,journal:{...json.journal,seriesBest:{"19":{wins:4,shots:70}}}}
  ]){
    const before=new Map(other.saved);
    assert.equal(other.eval('restoreProgressBackup('+JSON.stringify(JSON.stringify(invalid))+')'),'backupInvalid');
    assert.deepEqual(other.saved,before);
  }
  const legacy=JSON.parse(text);
  delete legacy.first;delete legacy.journal;legacy.version=1;
  assert.equal(other.eval('restoreProgressBackup('+JSON.stringify(JSON.stringify(legacy))+')'),'backupImported');
  assert.equal(other.eval('journal.matches.length'),0);
  assert.equal(other.eval('dailyFirstScore("2026-11-03")'),undefined);
});
