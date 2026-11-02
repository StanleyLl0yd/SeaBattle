'use strict';
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const {script} = require('./source.cjs');
assert.ok(script, 'Game modules must be available');
const marker = script.indexOf('    function updateStatus(');
assert.ok(marker > 0, 'Game engine functions were not found');
const context = vm.createContext({document: {getElementById: () => ({})}});
vm.runInContext(script.slice(0, marker) +
  '\nglobalThis.api = {SIZE,FLEET,createBoard,candidate,placeShip,randomFleet,fireAt,remaining,shotCount,hitCount,neighbors,aiChooseShot};',
  context, {filename: 'index.html'});
const {SIZE,FLEET,createBoard,candidate,placeShip,randomFleet,fireAt,remaining,shotCount,hitCount,neighbors,aiChooseShot} = context.api;

test('HTML loads local game modules, is localized and has working controls', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport"/);
  for (const id of ['player-board','enemy-board','auto','manual','rotate','undo','start','new-game','language']) {
    assert.ok(html.includes('id="' + id + '"'), id);
  }
  assert.doesNotMatch(html, /<link\s+[^>]*href="https?:/i);\n  for (const path of require('./source.cjs').paths) assert.ok(html.includes('src="'+path+'"'));
});

test('200 generated fleets have legal sizes and do not touch', () => {
  assert.equal(SIZE, 10);
  assert.deepEqual(Array.from(FLEET), [4,3,3,2,2,2,1,1,1,1]);
  for (let run = 0; run < 200; run++) {
    const b = randomFleet();
    assert.equal(b.cells.length, 100);
    assert.equal(b.ships.length, 10);
    assert.deepEqual(Array.from(b.ships, ship => ship.size), Array.from(FLEET));
    assert.equal(b.cells.filter(id => id !== -1).length, 20);
    for (let i = 0; i < 100; i++) {
      if (b.cells[i] === -1) continue;
      assert.ok(b.ships[b.cells[i]].cells.includes(i));
      for (const j of neighbors(i)) {
        if (b.cells[j] !== -1) assert.equal(b.cells[j], b.cells[i], 'ships may not touch diagonally');
      }
    }
  }
});

test('manual placement rejects edges, overlap and adjacent ships', () => {
  const b = createBoard();
  assert.equal(candidate(b, 4, 9, true).valid, false);
  assert.equal(candidate(b, 4, 90, false).valid, false);
  const place = candidate(b, 4, 0, true);
  assert.equal(place.valid, true);
  placeShip(b, place.cells);
  assert.equal(candidate(b, 3, 0, false).valid, false);
  assert.equal(candidate(b, 1, 14, true).valid, false);
  assert.equal(candidate(b, 1, 44, true).valid, true);
});

test('hits, misses, sinking, blocking and repeat shots', () => {
  const b = createBoard();
  placeShip(b, [0,1]);
  assert.equal(fireAt(b, 99).kind, 'miss');
  assert.equal(fireAt(b, 99).kind, 'already');
  assert.equal(fireAt(b, 0).kind, 'hit');
  assert.equal(fireAt(b, 0).kind, 'already');
  assert.equal(fireAt(b, 1).kind, 'sunk');
  for (const i of [0,1]) assert.equal(b.shots[i], 'sunk');
  for (const i of [2,10,11,12]) assert.equal(b.shots[i], 'blocked');
  assert.equal(fireAt(b, 2).kind, 'already');
  assert.equal(remaining(b), 0);
  assert.equal(hitCount(b), 2);
  assert.equal(shotCount(b), 3);
  assert.equal(fireAt(b, -1).kind, 'already');
  assert.equal(fireAt(b, 100).kind, 'already');
});

test('computer completes 100 games without invalid or duplicate shots', () => {
  for (let game = 0; game < 100; game++) {
    const b = randomFleet();
    let shots = 0;
    while (remaining(b)) {
      const target = aiChooseShot(b);
      assert.ok(Number.isInteger(target) && target >= 0 && target < 100);
      assert.equal(b.shots[target], null);
      assert.notEqual(fireAt(b, target).kind, 'already');
      assert.ok(++shots <= 100);
    }
    assert.equal(hitCount(b), 20);
  }
});
