'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { matchAccount, normPath } = require('../dist/accounts');
const { detectAgent, splitArgs } = require('../dist/plugins/process');
const { dedupe } = require('../dist/plugins');

test('normPath handles Windows paths with spaces and mixed slashes on any host', () => {
  assert.equal(normPath('C:\\Users\\Moges Johnson\\src\\'), 'c:/users/moges johnson/src');
  assert.equal(normPath('c:/Users\\Moges Johnson//src/app'), 'c:/users/moges johnson/src/app');
});

test('matchAccount matches Windows paths with spaces and mixed slashes', () => {
  const accounts = [
    { email: 'cfg@x', match: { claudeConfigDir: 'C:/Users/Moges Johnson/.claude-work' } },
    { email: 'path@x', match: { paths: ['C:\\Users\\Moges Johnson\\src\\work'] } },
  ];
  assert.equal(matchAccount(accounts, { claudeConfigDir: 'c:\\users\\moges johnson\\.claude-work\\' })?.email, 'cfg@x');
  assert.equal(matchAccount(accounts, { cwd: 'C:/Users/Moges Johnson/src/work\\repo' })?.email, 'path@x');
  assert.equal(matchAccount(accounts, { cwd: 'C:\\Users\\Moges Johnson\\src\\workshop' }), undefined);
});

test('detectAgent handles quoted Windows executables with spaces', () => {
  assert.deepEqual(splitArgs('"C:\\Program Files\\x.exe" -a "b c"'), ['C:\\Program Files\\x.exe', '-a', 'b c']);
  assert.equal(detectAgent('"C:\\Users\\Moges Johnson\\.local\\bin\\claude.exe" --model opus'), 'claude');
  assert.equal(detectAgent('"C:\\Users\\Moges Johnson\\AppData\\Roaming\\npm\\codex.cmd"'), 'codex');
});

test('dedupe ignores case and slash differences in Windows cwds and skips unknown cwds', () => {
  const files = [
    { id: 'claude:1', agent: 'claude-code', cwd: 'C:\\Users\\Moges Johnson\\src\\app', updatedAt: 0 },
    { id: 'codex:2', agent: 'codex', updatedAt: 0 },
  ];
  const procs = [
    { id: 'proc:1', agent: 'claude', cwd: 'c:/users/moges johnson/src/app/', updatedAt: 0 },
    { id: 'proc:2', agent: 'codex', updatedAt: 0 },
  ];
  assert.deepEqual(dedupe(files, procs).map((s) => s.id).sort(), ['claude:1', 'codex:2', 'proc:2']);
});
