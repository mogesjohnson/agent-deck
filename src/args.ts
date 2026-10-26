export interface Args {
  help: boolean;
  json: boolean;
  once: boolean;
  interval: number;
}

/** Parses CLI flags. A missing or invalid --interval falls back to 2000 ms. */
export function parseArgs(argv: string[]): Args {
  const i = argv.indexOf('--interval');
  return {
    help: argv.includes('-h') || argv.includes('--help'),
    json: argv.includes('--json'),
    once: argv.includes('--once'),
    interval: i >= 0 ? Number(argv[i + 1]) || 2000 : 2000,
  };
}
