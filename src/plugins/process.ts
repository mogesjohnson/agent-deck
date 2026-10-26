import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { matchAccount } from '../accounts';
import { AgentPlugin, PluginContext, Session } from '../types';
import { repoName } from '../util';

const AGENTS = ['claude', 'codex', 'grok', 'gemini', 'antigravity'];

export interface Proc {
  pid: number;
  cmd: string;
  cwd?: string;
}

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(file, args, { maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout) => resolve(err ? '' : String(stdout)));
  });
}

/** Splits a command line on whitespace, keeping "quoted parts" (Windows paths with spaces) whole. */
export function splitArgs(cmd: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"?|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) out.push(m[1] ?? m[2]);
  return out;
}

/** Returns the agent name if the command line is one of the known CLIs. */
export function detectAgent(cmd: string): string | undefined {
  const parts = splitArgs(cmd).slice(0, 3);
  for (const part of parts) {
    const base = path.posix.basename(part.replace(/\\/g, '/')).toLowerCase().replace(/\.(exe|cmd|js|mjs)$/, '');
    for (const a of AGENTS) if (base === a || base === `${a}-cli` || base === `@${a}`) return a;
  }
  const m = /[\\/](?:@anthropic-ai[\\/]claude-code|@openai[\\/]codex|@google[\\/]gemini-cli)[\\/]/i.exec(cmd);
  if (m) return m[0].includes('claude') ? 'claude' : m[0].includes('codex') ? 'codex' : 'gemini';
  return undefined;
}

/** /proc/<pid>/cmdline is NUL-separated argv. */
export function parseProcCmdline(raw: string): string {
  return raw.split('\0').join(' ').trim();
}

/** Parses `ps -axo pid=,command=` output. */
export function parsePs(txt: string): Proc[] {
  const procs: Proc[] = [];
  for (const line of txt.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (m) procs.push({ pid: Number(m[1]), cmd: m[2] });
  }
  return procs;
}

/** Parses `lsof -Fn` output for the cwd entry. */
export function parseLsofCwd(txt: string): string | undefined {
  const line = txt.split(/\r?\n/).find((l) => l.startsWith('n'));
  return line ? line.slice(1) : undefined;
}

/** Parses Win32_Process rows from ConvertTo-Json (one object or an array). */
export function parseWin32(txt: string): Proc[] {
  try {
    const data = JSON.parse(txt);
    const list = Array.isArray(data) ? data : [data];
    return list.map((p: any) => ({ pid: p.ProcessId, cmd: p.CommandLine || p.Name || '' }));
  } catch {
    return [];
  }
}

/** Reads `--model x` or `--model=x` from a command line. */
export function parseModel(cmd: string): string | undefined {
  return /--model[= ](\S+)/.exec(cmd)?.[1];
}

async function linuxProcs(): Promise<Proc[]> {
  const out: Proc[] = [];
  for (const d of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const cmd = parseProcCmdline(fs.readFileSync(`/proc/${d}/cmdline`, 'utf8'));
      if (!cmd) continue;
      let cwd: string | undefined;
      try {
        cwd = fs.readlinkSync(`/proc/${d}/cwd`);
      } catch {
        /* no permission */
      }
      out.push({ pid: Number(d), cmd, cwd });
    } catch {
      /* exited */
    }
  }
  return out;
}

async function macProcs(): Promise<Proc[]> {
  return parsePs(await run('ps', ['-axo', 'pid=,command=']));
}

async function macCwd(pid: number): Promise<string | undefined> {
  const txt = await run('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-Fn']);
  return parseLsofCwd(txt);
}

async function winProcs(): Promise<Proc[]> {
  const ps = 'Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress';
  const txt = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  return parseWin32(txt);
}

export const processPlugin: AgentPlugin = {
  name: 'process',
  async listSessions(ctx: PluginContext) {
    const procs =
      ctx.platform === 'linux' ? await linuxProcs() : ctx.platform === 'darwin' ? await macProcs() : ctx.platform === 'win32' ? await winProcs() : [];
    const out: Session[] = [];
    for (const p of procs) {
      if (p.pid === process.pid) continue;
      const agent = detectAgent(p.cmd);
      if (!agent) continue;
      if (ctx.platform === 'darwin') p.cwd = await macCwd(p.pid);
      const acct = matchAccount(ctx.accounts, { cwd: p.cwd });
      out.push({
        id: `proc:${p.pid}`,
        agent,
        model: parseModel(p.cmd),
        email: acct?.email,
        accountId: acct?.label,
        cwd: p.cwd,
        repo: repoName(p.cwd),
        doing: `process ${p.pid}`,
        updatedAt: ctx.now,
        pid: p.pid,
      });
    }
    return out;
  },
};
