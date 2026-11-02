'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Inline browser game must remain self-contained');
const boundary = script.indexOf('    function updateStatus(');
assert.ok(boundary > 0);

function engine(seed = 12345) {
  let state = seed >>> 0;
  const random = Object.create(Math);
  random.random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
  const sandbox = vm.createContext({ Math: random, document: { getElementById: () => ({}) } });
  vm.runInContext(script.slice(0, boundary) +
    '\nglobalThis.api = {SIZE,FLEET,createBoard,placeShip,candidate,fireAt,remaining,aiChooseShot};',
  sandbox, { filename: 'index.html' });
  return sandbox.api;
}

test('AI never reads hidden ship locations, even during full-fleet inference', () => {
  const ai = engine();
  const known = { shots: Array(100).fill(null), ships: Array.from(ai.FLEET, size => ({
    size, sunk: false, get cells() { throw new Error('Hidden ship geometry was inspected'); }
  })), get cells() { throw new Error('Hidden board was inspected'); } };
  const first = ai.aiChooseShot(known);
  assert.ok(Number.isInteger(first) && first >= 0 && first < 100);
  known.shots[first] = 'miss';
  const second = ai.aiChooseShot(known);
  assert.ok(Number.isInteger(second) && second !== first && second >= 0 && second < 100);
});

test('AI finishes aligned hits before resuming exploration', () => {
  const ai = engine();
  const known = { shots: Array(100).fill(null), ships: [{ size: 4, sunk: false }] };
  known.shots[44] = 'hit';
  known.shots[45] = 'hit';
  for (let i = 0; i < 32; i++) {
    const next = ai.aiChooseShot(known);
    assert.ok(next === 43 || next === 46, 'Only exposed ends of the ship may be targeted');
  }
  known.shots[43] = 'miss';
  assert.equal(ai.aiChooseShot(known), 46);
});

test('AI handles sunk ships and blocked cells without duplicate or illegal shots', () => {
  const ai = engine();
  const board = ai.createBoard();
  ai.placeShip(board, [0]);
  ai.placeShip(board, [55, 56, 57]);
  assert.equal(ai.fireAt(board, 0).kind, 'sunk');
  assert.equal(ai.fireAt(board, 55).kind, 'hit');
  assert.equal(ai.fireAt(board, 56).kind, 'hit');
  for (let i = 0; i < 24; i++) {
    const index = ai.aiChooseShot(board);
    assert.ok(Number.isInteger(index) && board.shots[index] === null);
    assert.ok(index === 54 || index === 57, 'Finish the aligned damaged ship before hunting');
  }
});

test('AI remains bounded and legal against difficult perimeter placement', () => {
  const ai = engine();
  const fleet = [
    ['J3','J4','J5','J6'], ['A3','A4','A5'], ['F1','G1','H1'],
    ['C1','D1'], ['A7','A8'], ['G10','H10'],
    ['A1'], ['J1'], ['A10'], ['J10']
  ];
  let total = 0;
  for (let run = 0; run < 30; run++) {
    const board = ai.createBoard();
    for (const ship of fleet) {
      ai.placeShip(board, ship.map(cell => 'ABCDEFGHIJ'.indexOf(cell[0]) + (Number(cell.slice(1)) - 1) * 10));
    }
    let shots = 0;
    while (ai.remaining(board)) {
      const index = ai.aiChooseShot(board);
      assert.ok(Number.isInteger(index) && index >= 0 && index < 100);
      assert.equal(board.shots[index], null);
      assert.notEqual(ai.fireAt(board, index).kind, 'already');
      assert.ok(++shots <= 100);
    }
    total += shots;
  }
  assert.ok(total / 30 < 60, 'Perimeter strategy must remain practical, average=' + total / 30);
});

test('AI falls back gracefully for constrained endgames', () => {
  const ai = engine();
  const board = { shots: Array(100).fill('miss'), ships: [{ size: 1, sunk: false }] };
  board.shots[99] = null;
  assert.equal(ai.aiChooseShot(board), 99);
  board.shots[99] = 'miss';
  assert.equal(ai.aiChooseShot(board), null);
});

test('bounded sampler uses no remote service, dynamic script or persistent store', () => {
  assert.match(script, /AI_PLACEMENTS/);
  assert.match(script, /Date\.now\(\) \+ 14/);
  assert.match(script, /nodes > 900/);
  assert.doesNotMatch(script, /\bfetch\(|\bXMLHttpRequest\b|\blocalStorage\b|\bindexedDB\b/);
});
