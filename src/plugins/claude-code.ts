import * as fs from 'fs';
import * as path from 'path';
import { matchAccount } from '../accounts';
import { AgentPlugin, PluginContext, Session } from '../types';
import { findRecent, oneLine, parseLines, readTail, repoName } from '../util';

function configDirs(ctx: PluginContext): string[] {
  const dirs = new Set<string>([path.join(ctx.home, '.claude')]);
  if (process.env.CLAUDE_CONFIG_DIR) dirs.add(process.env.CLAUDE_CONFIG_DIR);
  for (const a of ctx.accounts) if (a.match?.claudeConfigDir) dirs.add(a.match.claudeConfigDir);
  return [...dirs];
}

/** Only the non-secret oauthAccount.emailAddress field is read; nothing else is kept. */
function configEmail(ctx: PluginContext, dir: string): string | undefined {
  const candidates = [path.join(dir, '.claude.json')];
  if (dir === path.join(ctx.home, '.claude')) candidates.push(path.join(ctx.home, '.claude.json'));
  for (const f of candidates) {
    try {
      const email = JSON.parse(fs.readFileSync(f, 'utf8'))?.oauthAccount?.emailAddress;
      if (typeof email === 'string') return email;
    } catch {
      /* missing */
    }
  }
  return undefined;
}

function describe(entries: any[]): { model?: string; cwd?: string; doing?: string } {
  let model: string | undefined;
  let cwd: string | undefined;
  let doing: string | undefined;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (!cwd && typeof e.cwd === 'string') cwd = e.cwd;
    if (!model && typeof e.message?.model === 'string' && e.message.model !== '<synthetic>') model = e.message.model;
    if (!doing && (e.type === 'assistant' || e.type === 'user')) {
      const c = e.message?.content;
      if (typeof c === 'string') doing = oneLine(`${e.type}: ${c}`);
      else if (Array.isArray(c)) {
        for (let j = c.length - 1; j >= 0 && !doing; j--) {
          const b = c[j];
          if (b.type === 'tool_use') {
            const arg = b.input?.command ?? b.input?.file_path ?? b.input?.pattern ?? b.input?.description ?? '';
            doing = oneLine(`tool ${b.name} ${typeof arg === 'string' ? arg : ''}`);
          } else if (b.type === 'text') doing = oneLine(`${e.type}: ${b.text}`);
        }
      }
    }
    if (model && cwd && doing) break;
  }
  return { model, cwd, doing };
}

export const claudeCodePlugin: AgentPlugin = {
  name: 'claude-code',
  async listSessions(ctx) {
    const out: Session[] = [];
    for (const dir of configDirs(ctx)) {
      const files = findRecent(path.join(dir, 'projects'), (n) => n.endsWith('.jsonl'), ctx.now - ctx.activeWindowMs, 3);
      if (!files.length) continue;
      const cfgEmail = configEmail(ctx, dir);
      for (const f of files) {
        const info = describe(parseLines(readTail(f)));
        const acct = matchAccount(ctx.accounts, { claudeConfigDir: dir, cwd: info.cwd });
        out.push({
          id: `claude:${path.basename(f, '.jsonl')}`,
          agent: 'claude-code',
          model: info.model,
          email: cfgEmail ?? acct?.email,
          accountId: acct?.label,
          cwd: info.cwd,
          repo: repoName(info.cwd),
          doing: info.doing,
          updatedAt: fs.statSync(f).mtimeMs,
        });
      }
    }
    return out;
  },
};
