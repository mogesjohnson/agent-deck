'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { fakeHome } = require('./helpers');

const CLI = path.join(__dirname, '..', 'dist', 'cli.js');

function run(args, home) {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.CLAUDE_CONFIG_DIR;
  delete env.CODEX_HOME;
  return execFileSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8' });
}

/** The fixture times are fixed, so make the active files current for a real run. */
function liveHome() {
  const home = fakeHome();
  const now = new Date();
  fs.utimesSync(path.join(home, '.claude/projects/-work-agent-deck/sess-active.jsonl'), now, now);
  fs.utimesSync(path.join(home, '.codex/sessions/2026/10/25/rollout-2026-10-25-abc.jsonl'), now, now);
  return home;
}

test('--json lists fixture sessions with emails', () => {
  const list = JSON.parse(run(['--json'], liveHome())).filter((s) => !s.id.startsWith('proc:'));
  const byId = Object.fromEntries(list.map((s) => [s.id, s]));
  assert.deepEqual(Object.keys(byId).sort(), ['claude:sess-active', 'codex:abc']);
  assert.equal(byId['claude:sess-active'].email, 'moges@example.com');
  assert.equal(byId['codex:abc'].email, 'work@example.com');
  assert.equal(byId['codex:abc'].accountId, 'work');
});

test('--once prints text and --help prints usage', () => {
  const home = liveHome();
  assert.match(run(['--once'], home), /claude-code {2}model=claude-opus-4 {2}email=moges@example\.com/);
  assert.match(run(['--help'], home), /Usage: agent-deck/);
});
