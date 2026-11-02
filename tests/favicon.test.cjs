'use strict';

const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const icon = readFileSync(join(root, 'assets', 'seabattle-icon.svg'), 'utf8');
const ico = readFileSync(join(root, 'favicon.ico'));

test('favicon tags reference project-relative static assets, not remote origins', () => {
  assert.match(html, /<link rel="icon" type="image\/x-icon" href="favicon\.ico">/);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="assets\/seabattle-icon\.svg">/);
  assert.doesNotMatch(html, /href="\/(?:favicon\.ico|assets\/seabattle-icon\.svg)"/);
  assert.ok(existsSync(join(root, 'favicon.ico')));
  assert.ok(existsSync(join(root, 'assets', 'seabattle-icon.svg')));
});

test('ICO has valid PNG-backed 16 and 32 pixel browser icon entries', () => {
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  assert.ok(count >= 2);
  const sizes = [];
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  for (let i = 0; i < count; i++) {
    const offset = 6 + 16 * i;
    const width = ico[offset] || 256;
    const height = ico[offset + 1] || 256;
    assert.equal(width, height);
    const length = ico.readUInt32LE(offset + 8);
    const start = ico.readUInt32LE(offset + 12);
    assert.ok(start + length <= ico.length, 'Icon entry exceeds file length');
    assert.ok(ico.subarray(start, start + 8).equals(png), 'Icon entry must be PNG');
    sizes.push(width);
  }
  assert.ok(sizes.includes(16) && sizes.includes(32), 'Browser icon must include 16px and 32px');
});

test('SVG remains simple, self-contained and crisp at small sizes', () => {
  assert.match(icon, /viewBox="0 0 256 256"/);
  assert.match(icon, /fill="#082C45"/);
  assert.match(icon, /fill="#40DFE8"/);
  assert.match(icon, /stroke="#FF6779"/);
  assert.doesNotMatch(icon, /<(?:image|script|foreignObject)\b|https?:\/\/|data:/i);
});

test('GitHub Pages uploads both favicon files at their referenced paths', () => {
  assert.match(workflow, /cp index\.html dist\/index\.html/);
  assert.match(workflow, /cp favicon\.ico dist\/favicon\.ico/);
  assert.match(workflow, /cp assets\/seabattle-icon\.svg dist\/assets\/seabattle-icon\.svg/);
  assert.match(workflow, /Upload website artifact/);
  assert.match(workflow, /needs: test/);
});
