'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readTail, readHead } = require('../dist/util');

function tmpFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-deck-util-'));
  const f = path.join(dir, 'f.jsonl');
  fs.writeFileSync(f, content);
  return f;
}

test('readTail keeps a first line that starts exactly at the window edge', () => {
  const f = tmpFile('aaaa\nbbbb\ncccc\n');
  assert.deepEqual(readTail(f, 10), ['bbbb', 'cccc']);
});

test('readTail still drops a partial first line', () => {
  const f = tmpFile('aaaa\nbbbb\ncccc\n');
  assert.deepEqual(readTail(f, 8), ['cccc']);
});

test('readHead keeps the last line when the file exactly fills the buffer', () => {
  const f = tmpFile('aaaa\nbbbb');
  assert.deepEqual(readHead(f, 9), ['aaaa', 'bbbb']);
});

test('readHead drops a cut-off last line when the file is longer than the buffer', () => {
  const f = tmpFile('aaaa\nbbbbbb\n');
  assert.deepEqual(readHead(f, 9), ['aaaa']);
});
