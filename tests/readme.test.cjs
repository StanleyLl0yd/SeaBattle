'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const read = name => readFileSync(join(root, name), 'utf8');
const english = read('README.md');
const russian = read('README.ru.md');
const artwork = read('assets/readme-banner.svg');
const { version } = JSON.parse(read('package.json'));

const docs = [
  ['README.md', english, ['Fleet & rules', 'Take command', 'Language & accessibility', 'Run & develop', 'Release & project links']],
  ['README.ru.md', russian, ['Флот и правила', 'Управление', 'Язык и доступность', 'Запуск и разработка', 'Версия и ссылки']]
];

test('English and Russian have identical structure and functional language navigation', () => {
  for (const [name, content, headings] of docs) {
    assert.ok(content.startsWith('<p align="center">'), name);
    assert.match(content, /<img src="assets\/readme-banner\.svg"/);
    assert.equal((content.match(/<img src="assets\/readme-banner\.svg"/g) ?? []).length, 1);
    for (const path of ['README.md', 'README.ru.md']) {
      assert.equal((content.match(new RegExp('href="' + path.replace('.', '\\.') + '"', 'g')) ?? []).length, 2,
        name + ' must provide top and bottom language switches to ' + path);
    }
    const titles = [...content.matchAll(/^## (?:⚓|🎯|🌐|🛠|🚢) (0[1-5]) · (.+)$/gm)];
    assert.equal(titles.length, 5, name);
    assert.deepEqual(titles.map(m => m[1]), ['01', '02', '03', '04', '05']);
    assert.deepEqual(titles.map(m => m[2]), headings);
    assert.match(content, /<p align="center"><sub>⚓ /);
    assert.equal((content.match(/<hr\b|^---$/gm) ?? []).length, 2);
    assert.match(content, /https:\/\/stanleyll0yd\.github\.io\/SeaBattle\//);
    assert.match(content, /https:\/\/github\.com\/StanleyLl0yd\/SeaBattle\/actions\/workflows\/ci\.yml/);
    assert.match(content, /\[AGENTS\.md\]\(AGENTS\.md\)/);
    assert.match(content, /\[CHANGELOG\.md\]\(CHANGELOG\.md\)/);
    assert.match(content, /npm test/);
    assert.ok(content.includes(String.fromCharCode(96) + version + String.fromCharCode(96)),
      name + ' version must match package.json');
  }
});

test('bilingual gameplay facts and fleet tables stay equivalent', () => {
  for (const [name, content] of docs) {
    assert.match(content, /10 × 10/);
    const rows = content.match(/^\| [1-4] \| [1-4] \| [1-6] \|$/gm) ?? [];
    assert.deepEqual(rows.map(row => row.match(/\d/g).map(Number)), [
      [4, 1, 4], [3, 2, 6], [2, 3, 6], [1, 4, 4]
    ], name);
    assert.match(content, /\| \*\*[^|]+\*\* \| \*\*10\*\* \| \*\*20\*\* \|/);
    assert.match(content, /EN\/RU/);
    assert.match(content, /Node\.js 22\+/);
    assert.match(content, /index\.html/);
    assert.match(content, /GitHub Pages/);
  }
  assert.match(english, /English is the default/i);
  assert.match(russian, /Английский — язык по умолчанию/);
  assert.match(english, /no account, server, installation/);
  assert.match(russian, /без регистрации, сервера, установки/);
});

test('shared maritime hero is safe, self-contained, and uses the app palette', () => {
  assert.match(artwork, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(artwork, /<title id="title">SEA BATTLE \/ МОРСКОЙ БОЙ<\/title>/);
  for (const color of ['#081522', '#102338', '#58d9e8', '#49768e', '#ff777e', '#f3bd72']) {
    assert.ok(artwork.includes(color), 'Missing game palette color ' + color);
  }
  assert.match(artwork, /pattern id="grid"/);
  assert.match(artwork, /<text .*SEA BATTLE/);
  assert.doesNotMatch(artwork, /<script\b|<foreignObject\b|<image\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  assert.match(artwork, /<\/svg>\s*$/);
  assert.equal((artwork.match(/<svg\b/g) ?? []).length, 1);
  assert.equal((artwork.match(/<\/svg>/g) ?? []).length, 1);
});

test('agent instructions require two matching documents and preserve the hero', () => {
  const agents = read('AGENTS.md');
  assert.match(agents, /## README language and visual identity \(mandatory\)/);
  assert.match(agents, /both READMEs in the same PR/);
  assert.match(agents, /assets\/readme-banner\.svg/);
  assert.match(agents, /tests\/readme\.test\.cjs/);
});
