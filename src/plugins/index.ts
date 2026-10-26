import * as os from 'os';
import { loadAccounts } from '../accounts';
import { AgentPlugin, PluginContext, Session } from '../types';
import { claudeCodePlugin } from './claude-code';
import { codexPlugin } from './codex';
import { processPlugin } from './process';

export const plugins: AgentPlugin[] = [claudeCodePlugin, codexPlugin, processPlugin];

export function makeContext(activeWindowMs = 10 * 60 * 1000): PluginContext {
  return { home: os.homedir(), platform: process.platform, accounts: loadAccounts(), activeWindowMs, now: Date.now() };
}

/**
 * Runs every plugin. Process entries whose cwd already has a file-based session of the
 * same agent are dropped so one agent shows as one pane.
 */
export async function collectSessions(ctx = makeContext()): Promise<Session[]> {
  const results = await Promise.all(plugins.map((p) => p.listSessions(ctx).catch(() => [] as Session[])));
  const files = results.slice(0, 2).flat();
  const seen = new Set(files.map((s) => `${s.agent.replace('-code', '')}|${s.cwd}`));
  const procs = results[2].filter((s) => !seen.has(`${s.agent}|${s.cwd}`));
  return [...files, ...procs]
    .map((s) => ({ ...s, email: s.email ?? 'unknown' }))
    .sort((a, b) => (a.email + a.agent + a.id).localeCompare(b.email + b.agent + b.id));
}
