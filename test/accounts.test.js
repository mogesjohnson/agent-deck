'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadAccounts, accountsPath, matchAccount, normPath } = require('../dist/accounts');
const { FIXTURE } = require('./helpers');

test('loadAccounts reads accounts.json and drops entries without email', () => {
  const list = loadAccounts(accountsPath(FIXTURE));
  assert.deepEqual(list.map((a) => a.email), ['work@example.com']);
});

test('loadAccounts returns [] for missing or invalid files', () => {
  assert.deepEqual(loadAccounts(path.join(FIXTURE, 'missing.json')), []);
  assert.deepEqual(loadAccounts(path.join(FIXTURE, '.claude', 'projects', '-work-agent-deck', 'sess-active.jsonl')), []);
});

test('matchAccount prefers config dir, then path prefix', () => {
  const root = path.resolve('/acct');
  const accounts = [
    { email: 'p@x', match: { paths: [path.join(root, 'src')] } },
    { email: 'c@x', match: { claudeConfigDir: path.join(root, 'cfg') } },
  ];
  const cwd = path.join(root, 'src', 'repo');
  assert.equal(matchAccount(accounts, { claudeConfigDir: path.join(root, 'cfg'), cwd })?.email, 'c@x');
  assert.equal(matchAccount(accounts, { cwd })?.email, 'p@x');
  assert.equal(matchAccount(accounts, { cwd: path.join(root, 'srcfoo') }), undefined);
  assert.equal(matchAccount(accounts, {}), undefined);
});

test('normPath strips trailing slashes and uses forward slashes', () => {
  const n = normPath(path.resolve('/a/b') + path.sep);
  assert.ok(!n.endsWith('/'));
  assert.ok(!n.includes('\\'));
});
