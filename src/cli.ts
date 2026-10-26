#!/usr/bin/env node
import { collectSessions } from './plugins';
import { Deck } from './tui';
import { parseArgs } from './args';

const HELP = `agent-deck: tiled view of every active AI coding agent session

Usage: agent-deck [--once] [--json] [--interval <ms>]
  --once        print sessions once as text and exit (no TUI)
  --json        print sessions once as JSON and exit
  --interval    poll interval for the TUI in ms (default 2000)
Keys: tab/arrows select, enter/space toggle details, a toggle all, r refresh, q quit`;

async function main(argv: string[]) {
  const args = parseArgs(argv);
  if (args.help) return console.log(HELP);
  if (args.json) return console.log(JSON.stringify(await collectSessions(), null, 2));
  if (args.once || !process.stdout.isTTY) {
    const sessions = await collectSessions();
    if (!sessions.length) return console.log('no active sessions');
    for (const s of sessions) {
      console.log(`${s.agent}  model=${s.model ?? 'unknown'}  email=${s.email}  repo=${s.repo ?? '-'}`);
      console.log(`  cwd: ${s.cwd ?? 'unknown'}`);
      console.log(`  doing: ${s.doing ?? 'unknown'}`);
    }
    return;
  }
  await new Deck(args.interval).start();
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
