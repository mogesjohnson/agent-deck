import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Account } from './types';

export function accountsPath(home = os.homedir()): string {
  return path.join(home, '.agent-deck', 'accounts.json');
}

/** Loads ~/.agent-deck/accounts.json. Missing or invalid file yields []. */
export function loadAccounts(file = accountsPath()): Account[] {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = Array.isArray(data?.accounts) ? data.accounts : [];
    return list.filter((a: Account) => a && typeof a.email === 'string');
  } catch {
    return [];
  }
}

export function normPath(p: string): string {
  let n = path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
  if (process.platform === 'win32' || /^[a-zA-Z]:\//.test(n)) n = n.toLowerCase();
  return n;
}

function under(child: string, parent: string): boolean {
  const c = normPath(child);
  const p = normPath(parent);
  return c === p || c.startsWith(p + '/');
}

/** Finds the account for a session by config dir or working-directory prefix. */
export function matchAccount(
  accounts: Account[],
  hint: { codexHome?: string; claudeConfigDir?: string; cwd?: string },
): Account | undefined {
  for (const a of accounts) {
    const m = a.match || {};
    if (hint.codexHome && m.codexHome && under(hint.codexHome, m.codexHome)) return a;
    if (hint.claudeConfigDir && m.claudeConfigDir && under(hint.claudeConfigDir, m.claudeConfigDir)) return a;
  }
  if (hint.cwd) {
    for (const a of accounts) {
      for (const p of a.match?.paths || []) if (under(hint.cwd, p)) return a;
    }
  }
  return undefined;
}
