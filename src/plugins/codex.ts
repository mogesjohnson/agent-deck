import * as fs from 'fs';
import * as path from 'path';
import { matchAccount } from '../accounts';
import { AgentPlugin, PluginContext, Session } from '../types';
import { findRecent, oneLine, parseLines, readHead, readTail, repoName } from '../util';

function homes(ctx: PluginContext): string[] {
  const dirs = new Set<string>([path.join(ctx.home, '.codex')]);
  if (process.env.CODEX_HOME) dirs.add(process.env.CODEX_HOME);
  for (const a of ctx.accounts) if (a.match?.codexHome) dirs.add(a.match.codexHome);
  return [...dirs];
}

function lastDoing(entries: any[]): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const p = entries[i].payload;
    if (!p) continue;
    if (p.type === 'agent_message' || p.type === 'user_message') return oneLine(`${p.type}: ${p.message}`);
    if (p.type === 'function_call' || p.type === 'custom_tool_call') {
      let arg = p.arguments ?? p.input ?? '';
      try {
        const j = JSON.parse(arg);
        arg = Array.isArray(j.command) ? j.command.join(' ') : j.command ?? arg;
      } catch {
        /* raw args */
      }
      return oneLine(`tool ${p.name} ${arg}`);
    }
    if (p.type === 'message' && Array.isArray(p.content)) {
      const t = p.content.map((c: any) => c.text).filter(Boolean).join(' ');
      if (t) return oneLine(`${p.role}: ${t}`);
    }
  }
  return undefined;
}

/**
 * Codex keeps the account email only inside auth tokens, so no email is read here.
 * Accounts are tagged from accounts.json instead.
 */
export const codexPlugin: AgentPlugin = {
  name: 'codex',
  async listSessions(ctx) {
    const out: Session[] = [];
    for (const home of homes(ctx)) {
      const files = findRecent(path.join(home, 'sessions'), (n) => /^rollout-.*\.jsonl$/.test(n), ctx.now - ctx.activeWindowMs);
      for (const f of files) {
        const head = parseLines(readHead(f));
        const tail = parseLines(readTail(f));
        const meta = head.find((e) => e.type === 'session_meta')?.payload ?? {};
        let model: string | undefined;
        let cwd: string | undefined = meta.cwd;
        for (const e of [...head, ...tail]) {
          if (e.type === 'turn_context' && e.payload) {
            model = e.payload.model ?? model;
            cwd = e.payload.cwd ?? cwd;
          }
        }
        const acct = matchAccount(ctx.accounts, { codexHome: home, cwd });
        out.push({
          id: `codex:${meta.id ?? path.basename(f, '.jsonl')}`,
          agent: 'codex',
          model: model ?? meta.model,
          email: acct?.email,
          accountId: acct?.label,
          cwd,
          repo: repoName(cwd),
          doing: lastDoing(tail),
          updatedAt: fs.statSync(f).mtimeMs,
        });
      }
    }
    return out;
  },
};
