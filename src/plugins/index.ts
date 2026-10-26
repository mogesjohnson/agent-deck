import * as os from 'os';
import { loadAccounts, normPath } from '../accounts';
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
  return dedupe(results.slice(0, 2).flat(), results[2]);
}

/** Drops process entries that match a file-based session of the same agent and cwd. */
export function dedupe(files: Session[], procs: Session[]): Session[] {
  const key = (agent: string, cwd?: string) => (cwd ? `${agent.replace('-code', '')}|${normPath(cwd)}` : undefined);
  const seen = new Set(files.map((s) => key(s.agent, s.cwd)).filter(Boolean));
  const kept = procs.filter((s) => !seen.has(key(s.agent, s.cwd)));
  return [...files, ...kept]
    .map((s) => ({ ...s, email: s.email ?? 'unknown' }))
    .sort((a, b) => (a.email + a.agent + a.id).localeCompare(b.email + b.agent + b.id));
}
