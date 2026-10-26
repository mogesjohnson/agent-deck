'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixtures', 'home');
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

/** Copies the fixture home to a temp dir and sets file mtimes relative to NOW. */
function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-deck-'));
  fs.cpSync(FIXTURE, home, { recursive: true });
  const set = (rel, agoMs) => {
    const t = new Date(NOW - agoMs);
    fs.utimesSync(path.join(home, rel), t, t);
  };
  set('.claude/projects/-work-agent-deck/sess-active.jsonl', 60 * 1000);
  set('.claude/projects/-work-agent-deck/sess-stale.jsonl', 60 * 60 * 1000);
  set('.codex/sessions/2026/10/25/rollout-2026-10-25-abc.jsonl', 2 * 60 * 1000);
  set('.codex/sessions/2026/10/25/rollout-2026-10-25-old.jsonl', 2 * 60 * 60 * 1000);
  set('.codex/sessions/2026/10/25/other.jsonl', 1000);
  return home;
}

function ctx(home, accounts = []) {
  return { home, platform: process.platform, accounts, activeWindowMs: 10 * 60 * 1000, now: NOW };
}

function clearEnv() {
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.CODEX_HOME;
}

module.exports = { FIXTURE, NOW, fakeHome, ctx, clearEnv };
