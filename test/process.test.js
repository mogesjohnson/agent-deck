'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../dist/plugins/process');
const { dedupe } = require('../dist/plugins');

test('detectAgent recognises CLIs across platforms', () => {
  assert.equal(p.detectAgent('claude --model opus'), 'claude');
  assert.equal(p.detectAgent('/usr/local/bin/codex exec'), 'codex');
  assert.equal(p.detectAgent('node /usr/lib/node_modules/@google/gemini-cli/dist/index.js'), 'gemini');
  assert.equal(p.detectAgent('C:\\Program Files\\nodejs\\node.exe C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js'), 'claude');
  assert.equal(p.detectAgent('C:\\tools\\grok.exe'), 'grok');
  assert.equal(p.detectAgent('vim notes.md'), undefined);
  assert.equal(p.detectAgent(''), undefined);
});

test('parseProcCmdline joins NUL-separated argv', () => {
  assert.equal(p.parseProcCmdline('node\0/opt/codex\0--model\0gpt-5\0'), 'node /opt/codex --model gpt-5');
  assert.equal(p.parseProcCmdline(''), '');
});

test('parsePs reads pid and command from ps output', () => {
  const txt = '    1 /sbin/launchd\n  4242 /opt/homebrew/bin/claude --model sonnet\r\n\n';
  assert.deepEqual(p.parsePs(txt), [
    { pid: 1, cmd: '/sbin/launchd' },
    { pid: 4242, cmd: '/opt/homebrew/bin/claude --model sonnet' },
  ]);
});

test('parseLsofCwd reads the n-line', () => {
  assert.equal(p.parseLsofCwd('p4242\nfcwd\nn/Users/moges/src/app\n'), '/Users/moges/src/app');
  assert.equal(p.parseLsofCwd(''), undefined);
});

test('parseWin32 handles arrays, single objects, null command lines and junk', () => {
  const arr = JSON.stringify([
    { ProcessId: 10, Name: 'System', CommandLine: null },
    { ProcessId: 11, Name: 'codex.exe', CommandLine: 'C:\\Users\\Moges Johnson\\bin\\codex.exe --model=o3' },
  ]);
  assert.deepEqual(p.parseWin32(arr), [
    { pid: 10, cmd: 'System' },
    { pid: 11, cmd: 'C:\\Users\\Moges Johnson\\bin\\codex.exe --model=o3' },
  ]);
  assert.deepEqual(p.parseWin32('{"ProcessId":5,"Name":"x","CommandLine":"claude"}'), [{ pid: 5, cmd: 'claude' }]);
  assert.deepEqual(p.parseWin32(''), []);
});

test('parseModel supports --model x and --model=x', () => {
  assert.equal(p.parseModel('claude --model opus'), 'opus');
  assert.equal(p.parseModel('codex --model=o3 exec'), 'o3');
  assert.equal(p.parseModel('codex exec'), undefined);
});

test('dedupe drops processes that match a file session of the same agent and cwd', () => {
  const files = [
    { id: 'claude:1', agent: 'claude-code', cwd: '/r/a', updatedAt: 0, email: 'a@x' },
    { id: 'codex:2', agent: 'codex', cwd: '/r/b', updatedAt: 0 },
  ];
  const procs = [
    { id: 'proc:1', agent: 'claude', cwd: '/r/a', updatedAt: 0 },
    { id: 'proc:2', agent: 'codex', cwd: '/r/b', updatedAt: 0 },
    { id: 'proc:3', agent: 'claude', cwd: '/r/b', updatedAt: 0 },
    { id: 'proc:4', agent: 'gemini', cwd: '/r/a', updatedAt: 0 },
  ];
  const out = dedupe(files, procs);
  assert.deepEqual(out.map((s) => s.id).sort(), ['claude:1', 'codex:2', 'proc:3', 'proc:4']);
  assert.ok(out.every((s) => s.email));
});
