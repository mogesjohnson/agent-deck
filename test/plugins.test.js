'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { claudeCodePlugin } = require('../dist/plugins/claude-code');
const { codexPlugin } = require('../dist/plugins/codex');
const { fakeHome, ctx, clearEnv } = require('./helpers');

clearEnv();

test('claude-code: parses model, cwd, repo and last tool action', async () => {
  const home = fakeHome();
  const [s, ...rest] = await claudeCodePlugin.listSessions(ctx(home));
  assert.equal(rest.length, 0);
  assert.equal(s.id, 'claude:sess-active');
  assert.equal(s.agent, 'claude-code');
  assert.equal(s.model, 'claude-opus-4');
  assert.equal(s.cwd, '/work/agent-deck');
  assert.equal(s.repo, 'agent-deck');
  assert.equal(s.doing, 'tool Bash npm test');
});

test('claude-code: files older than the active window are skipped', async () => {
  const home = fakeHome();
  const c = ctx(home);
  c.activeWindowMs = 30 * 1000;
  assert.deepEqual(await claudeCodePlugin.listSessions(c), []);
  c.activeWindowMs = 24 * 60 * 60 * 1000;
  const ids = (await claudeCodePlugin.listSessions(c)).map((s) => s.id).sort();
  assert.deepEqual(ids, ['claude:sess-active', 'claude:sess-stale']);
});

test('claude-code: email comes from oauthAccount.emailAddress', async () => {
  const home = fakeHome();
  const [s] = await claudeCodePlugin.listSessions(ctx(home));
  assert.equal(s.email, 'moges@example.com');
});

test('claude-code: email falls back to accounts.json config dir match', async () => {
  const home = fakeHome();
  fs.rmSync(path.join(home, '.claude.json'));
  const accounts = [{ email: 'cfg@example.com', label: 'cfg', match: { claudeConfigDir: path.join(home, '.claude') } }];
  const [s] = await claudeCodePlugin.listSessions(ctx(home, accounts));
  assert.equal(s.email, 'cfg@example.com');
  assert.equal(s.accountId, 'cfg');
});

test('claude-code: reads an extra config dir from CLAUDE_CONFIG_DIR', async () => {
  const home = fakeHome();
  const other = fakeHome();
  fs.writeFileSync(path.join(other, '.claude', '.claude.json'), '{"oauthAccount":{"emailAddress":"alt@example.com"}}');
  process.env.CLAUDE_CONFIG_DIR = path.join(other, '.claude');
  try {
    const emails = (await claudeCodePlugin.listSessions(ctx(home))).map((s) => s.email).sort();
    assert.deepEqual(emails, ['alt@example.com', 'moges@example.com']);
  } finally {
    clearEnv();
  }
});

test('codex: parses rollout files for model, cwd and last tool call', async () => {
  const home = fakeHome();
  const list = await codexPlugin.listSessions(ctx(home));
  assert.equal(list.length, 1);
  const [s] = list;
  assert.equal(s.id, 'codex:abc');
  assert.equal(s.model, 'gpt-5-codex');
  assert.equal(s.cwd, '/work/codex-repo');
  assert.equal(s.repo, 'codex-repo');
  assert.equal(s.doing, 'tool shell bash -lc ls -la');
  assert.equal(s.email, undefined);
});

test('codex: tags email from accounts.json path prefix', async () => {
  const home = fakeHome();
  const accounts = [{ email: 'work@example.com', label: 'work', match: { paths: ['/work'] } }];
  const [s] = await codexPlugin.listSessions(ctx(home, accounts));
  assert.equal(s.email, 'work@example.com');
});

test('codex: config dir match wins and CODEX_HOME is scanned', async () => {
  const home = fakeHome();
  const other = fakeHome();
  process.env.CODEX_HOME = path.join(other, '.codex');
  try {
    const accounts = [
      { email: 'path@example.com', match: { paths: ['/work'] } },
      { email: 'home@example.com', match: { codexHome: path.join(other, '.codex') } },
    ];
    const emails = (await codexPlugin.listSessions(ctx(home, accounts))).map((s) => s.email).sort();
    assert.deepEqual(emails, ['home@example.com', 'path@example.com']);
  } finally {
    clearEnv();
  }
});

test('missing homes yield no sessions', async () => {
  const c = ctx(path.join(fakeHome(), 'nope'));
  assert.deepEqual(await claudeCodePlugin.listSessions(c), []);
  assert.deepEqual(await codexPlugin.listSessions(c), []);
});
