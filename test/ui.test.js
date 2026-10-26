'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { grid, tile } = require('../dist/layout');
const { fit, wrap } = require('../dist/tui');
const { oneLine } = require('../dist/util');
const { parseArgs } = require('../dist/args');

const SIZES = [[80, 23], [120, 39], [200, 59], [40, 20], [300, 15]];

test('tile covers the screen exactly with no overlap for 1..9 panes', () => {
  for (const [cols, rows] of SIZES) {
    for (let n = 1; n <= 9; n++) {
      const rects = tile(n, cols, rows);
      assert.equal(rects.length, n);
      const cells = new Uint8Array(cols * rows);
      for (const r of rects) {
        assert.ok(r.w > 0 && r.h > 0, `empty pane n=${n} ${cols}x${rows}`);
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells[y * cols + x]++;
      }
      assert.ok(cells.every((c) => c === 1), `gap or overlap n=${n} ${cols}x${rows}`);
    }
  }
});

test('grid picks sensible shapes', () => {
  assert.deepEqual(grid(0, 80, 24), { c: 1, r: 1 });
  assert.deepEqual(grid(1, 80, 24), { c: 1, r: 1 });
  assert.deepEqual(grid(2, 160, 40), { c: 2, r: 1 });
  assert.deepEqual(grid(4, 120, 40), { c: 2, r: 2 });
  for (let n = 1; n <= 9; n++) {
    const g = grid(n, 120, 40);
    assert.ok(g.c * g.r >= n && (g.c - 1) * g.r < n + g.r);
  }
});

test('grid never makes columns narrower than 20 chars when avoidable', () => {
  for (let n = 2; n <= 9; n++) assert.ok(40 / grid(n, 40, 40).c >= 20);
});

test('fit pads, truncates with an ellipsis and counts code points', () => {
  assert.equal(fit('abc', 5), 'abc  ');
  assert.equal(fit('abcdef', 4), 'abc…');
  assert.equal(fit('abc', 0), '');
  assert.equal([...fit('▶ 日本語テキスト', 5)].length, 5);
});

test('wrap splits into width chunks up to a max', () => {
  assert.deepEqual(wrap('abcdefg', 3, 5), ['abc', 'def', 'g']);
  assert.deepEqual(wrap('abcdefg', 3, 2), ['abc', 'def']);
  assert.deepEqual(wrap('', 3, 2), []);
});

test('oneLine collapses whitespace and truncates', () => {
  assert.equal(oneLine('  a\n\tb  '), 'a b');
  assert.equal(oneLine('x'.repeat(10), 5), 'xxxx…');
  assert.equal(oneLine('   '), undefined);
  assert.equal(oneLine(42), undefined);
});

test('parseArgs reads flags and interval', () => {
  assert.deepEqual(parseArgs([]), { help: false, json: false, once: false, interval: 2000 });
  assert.deepEqual(parseArgs(['--json', '--once', '-h']), { help: true, json: true, once: true, interval: 2000 });
  assert.equal(parseArgs(['--interval', '500']).interval, 500);
  assert.equal(parseArgs(['--interval', 'abc']).interval, 2000);
  assert.equal(parseArgs(['--interval']).interval, 2000);
});
