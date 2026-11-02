'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Expected one inline game script');

function boot(languages, fallback = 'en-US') {
  const nodes = new Map();
  const documentEvents = new Map();
  const make = () => ({
    textContent: '', innerHTML: '', style: {}, dataset: {}, children: [],
    handlers: {}, classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(name, callback) { this.handlers[name] = callback; },
    click() { this.handlers.click?.(); },
    setAttribute(name, value) { this[name] = value; },
    querySelectorAll() { return []; }, replaceChildren(...children) { this.children = children; }
  });
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  for (const id of ids) nodes.set(id, make());
  const textNodes = [...html.matchAll(/\bdata-i18n="([^"]+)"/g)].map(m => {
    const element = make();
    element.dataset.i18n = m[1];
    return element;
  });
  const ariaNodes = [...html.matchAll(/\bdata-i18n-aria-label="([^"]+)"/g)].map(m => {
    const element = make();
    element.dataset.i18nAriaLabel = m[1];
    return element;
  });
  const columns = [make(), make()];
  const doc = {
    documentElement: { lang: 'en' }, title: '',
    getElementById(id) { return nodes.get(id); },
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return textNodes;
      if (selector === '[data-i18n-aria-label]') return ariaNodes;
      if (selector === '.cols') return columns;
      return [];
    },
    createElement() { return make(); },
    addEventListener(name, callback) { documentEvents.set(name, callback); }
  };
  const context = vm.createContext({
    document: doc,
    navigator: { languages, language: fallback },
    setTimeout() { return 0; }
  });
  vm.runInContext(script, context, { filename: 'index.html' });
  return { doc, nodes, textNodes, ariaNodes, columns, context,
    eval: source => vm.runInContext(source, context),
    keydown: input => {
      let prevented = false;
      documentEvents.get('keydown')({
        code: '', key: '', target: { tagName: 'BODY' },
        preventDefault() { prevented = true; },
        ...input
      });
      return prevented;
    }
  };
}

test('English first, exact Russian browser locale, and safe fallbacks', () => {
  for (const [preferred, fallback, expected] of [
    [['en-US', 'ru-RU'], 'ru-RU', 'en'],
    [['ru-RU', 'en-US'], 'en-US', 'ru'],
    [['ru'], 'en-US', 'ru'],
    [['ru_RU'], 'en-US', 'ru'],
    [['uk-UA'], 'ru-RU', 'en'],
    [['de-DE'], 'de-DE', 'en'],
    [[], 'ru-RU', 'ru'],
    [[], '', 'en']
  ]) {
    const b = boot(preferred, fallback);
    assert.equal(b.doc.documentElement.lang, expected);
    assert.equal(b.nodes.get('language').value, expected);
    assert.equal(b.doc.title, expected === 'ru' ? 'Морской бой — игра против компьютера' : 'Sea Battle — Play Against the Computer');
    assert.equal(b.columns[0].children[0].textContent, expected === 'ru' ? 'А' : 'A');
    assert.equal(b.columns[1].children[9].textContent, expected === 'ru' ? 'К' : 'J');
    assert.equal(b.textNodes.find(x => x.dataset.i18n === 'heading').textContent, expected === 'ru' ? 'Морской бой' : 'Sea Battle');
  }
});

test('both dictionaries cover every visible label and every runtime translation', () => {
  const b = boot(['en-US']);
  const [en, ru] = b.eval('[I18N.en, I18N.ru]');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ru).sort());
  assert.ok(Object.keys(en).length >= 50);
  for (const node of b.textNodes) assert.ok(en[node.dataset.i18n] && ru[node.dataset.i18n]);
  for (const node of b.ariaNodes) assert.ok(en[node.dataset.i18nAriaLabel] && ru[node.dataset.i18nAriaLabel]);
  for (const dict of [en, ru]) {
    for (const key of Object.keys(dict)) {
      assert.ok(dict[key] && typeof dict[key] === 'string', key);
      assert.deepEqual([...dict[key].matchAll(/\{([^}]+)\}/g)].map(m => m[1]).sort(),
        [...en[key].matchAll(/\{([^}]+)\}/g)].map(m => m[1]).sort(), key);
    }
  }
});

test('switching language updates live status and accessible cell labels without resetting game', () => {
  const b = boot(['en-US']);
  b.eval('startBattle(); updateStatus("playerSunk", { at: 0, size: 4 }); render();');
  const state = b.eval('({phase:game.phase, player:game.player, enemy:game.enemy})');
  assert.match(b.nodes.get('status-text').textContent, /^A1: enemy ship \(4 cells\) sunk/);
  assert.match(b.nodes.get('enemy-board').innerHTML, /aria-label="A1: Unknown"/);
  b.eval('setLanguage("ru")');
  assert.equal(b.doc.documentElement.lang, 'ru');
  assert.match(b.nodes.get('status-text').textContent, /^А1: корабль \(4 пал.\) потоплен/);
  assert.match(b.nodes.get('enemy-board').innerHTML, /aria-label="А1: Неизвестно"/);
  assert.strictEqual(b.eval('game.player'), state.player);
  assert.strictEqual(b.eval('game.enemy'), state.enemy);
  assert.equal(b.eval('game.phase'), state.phase);
  b.eval('setLanguage("en")');
  assert.equal(b.nodes.get('language').value, 'en');
  assert.match(b.nodes.get('status-text').textContent, /^A1: enemy ship/);
  assert.equal(b.doc.title, 'Sea Battle — Play Against the Computer');
});

test('manual ship setup and completed battle messages localize at runtime', () => {
  const b = boot(['ru-RU']);
  b.eval('ui.manual && (game.player = createBoard(), game.manual = true, render())');
  assert.match(b.nodes.get('setup-hint').textContent, /Поставь 4-палубный/);
  b.eval('setLanguage("en")');
  assert.match(b.nodes.get('setup-hint').textContent, /Place a 4-cell ship/);
  b.eval('game.phase = "finished"; updateStatus("win"); render()');
  assert.match(b.nodes.get('status-text').textContent, /Victory!/);
  b.eval('setLanguage("ru")');
  assert.match(b.nodes.get('status-text').textContent, /Победа!/);
  b.eval('updateStatus("computerMiss",{at:99});render()');
  assert.match(b.nodes.get('status-text').textContent, /К10/);
  b.eval('setLanguage("en")');
  assert.match(b.nodes.get('status-text').textContent, /J10/);
});


test('R-position key rotates manual ships on any keyboard layout, without repeating', () => {
  const b = boot(['ru-RU']);
  b.eval('game.player = createBoard(); game.manual = true; game.horizontal = true; render()');
  assert.equal(b.nodes.get('rotate').disabled, false);
  for (const [key, code] of [['r', 'KeyR'], ['к', 'KeyR'], ['ق', 'KeyR'], ['γ', 'KeyR']]) {
    const previous = b.eval('game.horizontal');
    assert.equal(b.keydown({ key, code }), true, 'Expected ' + key + ' to rotate');
    assert.equal(b.eval('game.horizontal'), !previous);
  }
  assert.equal(b.keydown({ key: 'r', code: '' }), true, 'Legacy key-only events remain supported');
  assert.equal(b.eval('game.horizontal'), false);
  assert.equal(b.keydown({ key: 'к', code: 'KeyR', repeat: true }), false);
  assert.equal(b.eval('game.horizontal'), false);
});

test('rotation shortcut respects modifiers, composing, editable targets and game phase', () => {
  const b = boot(['en-US']);
  b.eval('game.player = createBoard(); game.manual = true; game.horizontal = true; render()');
  const base = { key: 'к', code: 'KeyR' };
  for (const change of [
    { ctrlKey: true }, { altKey: true }, { metaKey: true },
    { isComposing: true }, { target: { tagName: 'SELECT' } },
    { target: { tagName: 'INPUT' } }, { target: { tagName: 'TEXTAREA' } },
    { target: { tagName: 'DIV', isContentEditable: true } },
    { key: 't', code: 'KeyT' }
  ]) {
    assert.equal(b.keydown({ ...base, ...change }), false);
    assert.equal(b.eval('game.horizontal'), true);
  }
  b.eval('game.phase = "playing"; render()');
  assert.equal(b.keydown(base), false);
  b.eval('game.phase = "setup"; game.manual = false; render()');
  assert.equal(b.keydown(base), false);
  b.eval('game.manual = true; game.player = randomFleet(); render()');
  assert.equal(b.keydown(base), false, 'Shortcut must respect disabled Rotate button');
});

test('offline English default markup, no remote code, and keyboard controls remain', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<select[^>]+id="language"/);
  assert.match(html, /<option value="en"/);
  assert.match(html, /<option value="ru"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /<script\s+src=|<link\s+[^>]*href="https?:/i);
  assert.ok(html.includes('event.code === "KeyR"'));
  assert.doesNotMatch(html.slice(0, html.indexOf('<script>')), /[А-ЯЁа-яё]/);
});
