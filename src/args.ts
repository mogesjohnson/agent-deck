export interface Args {
  help: boolean;
  json: boolean;
  once: boolean;
  interval: number;
}

/** Parses CLI flags. A missing or invalid --interval falls back to 2000 ms. */
export function parseArgs(argv: string[]): Args {
  const i = argv.indexOf('--interval');
  const n = i >= 0 ? Number(argv[i + 1]) : NaN;
  return {
    help: argv.includes('-h') || argv.includes('--help'),
    json: argv.includes('--json'),
    once: argv.includes('--once'),
    // Negative or infinite values would make setInterval fire every 1 ms.
    interval: Number.isFinite(n) && n > 0 ? n : 2000,
  };
}
