import * as fs from 'fs';
import * as path from 'path';

/** Reads up to `bytes` from the end of a file, dropping a partial first line. */
export function readTail(file: string, bytes = 64 * 1024): string[] {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    const lines = buf.toString('utf8').split('\n');
    if (start > 0) lines.shift();
    return lines.filter((l) => l.trim());
  } catch {
    return [];
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function readHead(file: string, bytes = 16 * 1024): string[] {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    const lines = buf.subarray(0, n).toString('utf8').split('\n');
    if (n === bytes) lines.pop();
    return lines.filter((l) => l.trim());
  } catch {
    return [];
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function parseLines(lines: string[]): any[] {
  const out: any[] = [];
  for (const l of lines) {
    try {
      out.push(JSON.parse(l));
    } catch {
      /* skip partial lines */
    }
  }
  return out;
}

/** Recursively lists files matching `test` and modified after `since`. */
export function findRecent(root: string, test: (name: string) => boolean, since: number, depth = 6): string[] {
  const out: string[] = [];
  const walk = (dir: string, d: number) => {
    let ents: fs.Dirent[];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && d > 0) walk(p, d - 1);
      else if (e.isFile() && test(e.name)) {
        try {
          if (fs.statSync(p).mtimeMs >= since) out.push(p);
        } catch {
          /* vanished */
        }
      }
    }
  };
  walk(root, depth);
  return out;
}

const repoCache = new Map<string, string>();

/** Repo name from git remote origin in .git/config, else the folder name. */
export function repoName(cwd?: string): string | undefined {
  if (!cwd) return undefined;
  const hit = repoCache.get(cwd);
  if (hit) return hit;
  let name = path.basename(cwd.replace(/[\\/]+$/, '')) || cwd;
  let dir = cwd;
  for (let i = 0; i < 20; i++) {
    const cfg = path.join(dir, '.git', 'config');
    if (fs.existsSync(cfg)) {
      try {
        const txt = fs.readFileSync(cfg, 'utf8');
        const m = /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(txt);
        if (m) name = m[1].replace(/\.git$/, '').split(/[/:]/).pop() || name;
        else name = path.basename(dir);
      } catch {
        /* unreadable */
      }
      break;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  repoCache.set(cwd, name);
  return name;
}

export function oneLine(s: unknown, max = 200): string | undefined {
  if (typeof s !== 'string') return undefined;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}
