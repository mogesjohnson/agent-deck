import { collectSessions } from './plugins';
import { tile } from './layout';
import { Session } from './types';

const ESC = '\x1b[';
const out = (s: string) => process.stdout.write(s);

function fit(s: string, w: number): string {
  const chars = [...s];
  if (chars.length > w) return chars.slice(0, Math.max(0, w - 1)).join('') + (w > 0 ? '…' : '');
  return s + ' '.repeat(w - chars.length);
}

function wrap(s: string, w: number, max: number): string[] {
  const chars = [...s];
  const lines: string[] = [];
  for (let i = 0; i < chars.length && lines.length < max; i += w) lines.push(chars.slice(i, i + w).join(''));
  return lines;
}

export class Deck {
  sessions: Session[] = [];
  selected = 0;
  open = new Set<string>();
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(private intervalMs = 2000) {}

  async start() {
    const stdin = process.stdin;
    out(`${ESC}?1049h${ESC}?25l`);
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', (k: string) => this.key(k));
    process.stdout.on('resize', () => this.render());
    process.on('exit', () => out(`${ESC}?25h${ESC}?1049l`));
    await this.refresh();
    this.timer = setInterval(() => this.refresh(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    process.exit(0);
  }

  async refresh() {
    if (this.busy) return;
    this.busy = true;
    try {
      const selId = this.sessions[this.selected]?.id;
      this.sessions = await collectSessions();
      const idx = this.sessions.findIndex((s) => s.id === selId);
      this.selected = idx >= 0 ? idx : Math.min(this.selected, Math.max(0, this.sessions.length - 1));
      this.render();
    } finally {
      this.busy = false;
    }
  }

  key(k: string) {
    const n = this.sessions.length;
    const cur = this.sessions[this.selected];
    if (k === 'q' || k === '\x03') return this.stop();
    if (k === '\t' || k === `${ESC}C` || k === `${ESC}B`) this.selected = n ? (this.selected + 1) % n : 0;
    else if (k === `${ESC}Z` || k === `${ESC}D` || k === `${ESC}A`) this.selected = n ? (this.selected - 1 + n) % n : 0;
    else if ((k === '\r' || k === ' ') && cur) {
      if (this.open.has(cur.id)) this.open.delete(cur.id);
      else this.open.add(cur.id);
    } else if (k === 'a') {
      const allOpen = this.sessions.every((s) => this.open.has(s.id));
      this.open = allOpen ? new Set() : new Set(this.sessions.map((s) => s.id));
    } else if (k === 'r') return void this.refresh();
    this.render();
  }

  render() {
    const cols = process.stdout.columns || 80;
    const rows = (process.stdout.rows || 24) - 1;
    const buf: string[] = [`${ESC}2J`];
    const put = (x: number, y: number, s: string) => buf.push(`${ESC}${y + 1};${x + 1}H${s}`);
    const emails = new Set(this.sessions.map((s) => s.email));
    const status = ` agent-deck  ${this.sessions.length} sessions  ${emails.size} accounts  tab/arrows select  enter/space toggle  a all  q quit `;
    put(0, rows, `${ESC}7m${fit(status, cols)}${ESC}0m`);
    if (!this.sessions.length) {
      put(2, 1, 'No active agent sessions found. Polling every 2s...');
      out(buf.join(''));
      return;
    }
    tile(this.sessions.length, cols, rows).forEach((r, i) => this.pane(put, r, this.sessions[i], i === this.selected));
    out(buf.join(''));
  }

  private pane(put: (x: number, y: number, s: string) => void, r: { x: number; y: number; w: number; h: number }, s: Session, sel: boolean) {
    if (r.w < 4 || r.h < 3) return;
    const color = sel ? `${ESC}1;36m` : `${ESC}2m`;
    const iw = r.w - 2;
    const isOpen = this.open.has(s.id);
    const title = ` ${isOpen ? '▼' : '▶'} ${s.agent} `;
    put(r.x, r.y, `${color}┌${fit(title, iw).replace(/ +$/, (m) => '─'.repeat(m.length))}┐${ESC}0m`);
    const lines: string[] = [`model: ${s.model ?? 'unknown'}`, `email: ${s.email ?? 'unknown'}${s.accountId ? ` (${s.accountId})` : ''}`];
    if (isOpen) {
      lines.push(`repo:  ${s.repo ?? 'unknown'}`, `cwd:   ${s.cwd ?? 'unknown'}`);
      lines.push(...wrap(`doing: ${s.doing ?? 'unknown'}`, iw, Math.max(1, r.h - 2 - lines.length)));
    }
    for (let y = 1; y < r.h - 1; y++) {
      const text = lines[y - 1] ?? '';
      put(r.x, r.y + y, `${color}│${ESC}0m${fit(text, iw)}${color}│${ESC}0m`);
    }
    put(r.x, r.y + r.h - 1, `${color}└${'─'.repeat(iw)}┘${ESC}0m`);
  }
}
