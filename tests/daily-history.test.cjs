'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const test=require('node:test');
const daily=readFileSync(join(__dirname,'..','js','daily.js'),'utf8');
function history(date, storage){
  const context={localStorage:storage};
  return JSON.parse(JSON.stringify(runInNewContext(daily+'\nrecentDailyScores('+JSON.stringify(date)+')',context)));
}
test('seven UTC dates are newest-first and leap and month boundaries are UTC-safe',()=>{
  const scores={'2024-03-01':30,'2024-02-29':29,'2024-02-28':28,'2024-02-24':24};
  const result=history('2024-03-01',{getItem:()=>JSON.stringify(scores)});
  assert.deepEqual(result.map(x=>x.date),['2024-03-01','2024-02-29','2024-02-28','2024-02-27','2024-02-26','2024-02-25','2024-02-24']);
  assert.deepEqual(result.map(x=>x.shots),[30,29,28,null,null,null,24]);
});
test('empty and malformed records never leak layouts or modify daily storage',()=>{
  let writes=0;
  const record={'2026-11-02':20,'2026-11-01':101,'2026-10-31':19,
    '2026-10-30':'30','2026-10-29':34,'2026-10-28':null,
    enemyLayout:[[1,2,3]],coordinates:[1,9,12]};
  const rows=history('2026-11-02',{getItem:()=>JSON.stringify(record),setItem:()=>writes++});
  assert.deepEqual(rows.map(x=>x.shots),[20,null,null,null,34,null,null]);
  assert.equal(writes,0);
  assert.equal(JSON.stringify(rows).includes('enemyLayout'),false);
  assert.equal(JSON.stringify(rows).includes('coordinates'),false);
  assert.deepEqual(history('2026-11-02',{getItem:()=>'{broken'}).map(x=>x.shots),Array(7).fill(null));
  assert.deepEqual(history('2026-11-02',{getItem:()=>JSON.stringify([])}).map(x=>x.shots),Array(7).fill(null));
  assert.deepEqual(history('2026-11-02',{getItem:()=>{throw Error('denied')}}).map(x=>x.shots),Array(7).fill(null));
});
test('invalid UTC dates are rejected without touching storage',()=>{
  let reads=0;
  const storage={getItem:()=>{reads++;return '{}';}};
  for(const invalid of ['2026-02-30','2026-13-01','2026-00-15','yesterday','2026-01-01T00:00']){
    assert.deepEqual(history(invalid,storage),[]);
  }
  assert.equal(reads,0);
});
