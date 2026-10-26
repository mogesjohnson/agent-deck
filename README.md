# agent-deck

A terminal UI that shows every active AI coding agent session across all of your accounts
at once. One pane per session, auto-tiled like tmux, refreshed every 2 seconds.

Read-only: agent-deck never writes to agent files, never sends input to agents, and never
reads, stores or prints tokens or credentials.

## Install and run

Requires Node 18+. No runtime dependencies.

```sh
git clone https://github.com/mogesjohnson/agent-deck
cd agent-deck
npm ci
npm run build
node dist/cli.js            # TUI
node dist/cli.js --once     # print sessions as text and exit
node dist/cli.js --json     # print sessions as JSON and exit
node dist/cli.js --interval 5000
```

Keys: `tab` / arrow keys select a pane, `enter` / `space` toggle its details,
`a` toggles all, `r` refreshes now, `q` quits.

## What it shows

```
┌ ▼ claude-code ──────────────────────────┐┌ ▶ codex ────────────────────────────────┐
│model: claude-opus-4                     ││model: gpt-5-codex                       │
│email: me@work.com (work)                ││email: me@personal.com (personal)        │
│repo:  agent-deck                        ││                                         │
│cwd:   /home/me/src/agent-deck           ││                                         │
│doing: tool Bash npm test                ││                                         │
└─────────────────────────────────────────┘└─────────────────────────────────────────┘
┌ ▶ gemini ─────────────────────────────────────────────────────────────────────────┐
│model: unknown                                                                     │
│email: unknown                                                                     │
└───────────────────────────────────────────────────────────────────────────────────┘
 agent-deck  3 sessions  3 accounts  tab/arrows select  enter/space toggle  a all  q quit
```

The grid is computed from the terminal's columns and rows and the session count, and it
re-tiles on resize and whenever sessions appear or disappear. There is no manual splitting.

## Sources

| Plugin | Reads | Active means |
| --- | --- | --- |
| `claude-code` | `~/.claude/projects/**/*.jsonl`, `$CLAUDE_CONFIG_DIR`, `claudeConfigDir` from accounts | file changed in the last 10 min |
| `codex` | `~/.codex/sessions/**/rollout-*.jsonl`, `$CODEX_HOME`, `codexHome` from accounts | file changed in the last 10 min |
| `process` | Linux `/proc/*/cmdline` + `cwd`; macOS `ps` + `lsof -a -d cwd -p`; Windows `Get-CimInstance Win32_Process` | a `claude`, `codex`, `grok`, `gemini` or `antigravity` process is running |

Process entries that duplicate a file-based session (same agent and cwd) are hidden.
On Windows the process cwd is not available, so it shows as `unknown`.

Email tagging, in order:

1. Non-secret config fields: `oauthAccount.emailAddress` in `.claude.json`. Codex keeps the
   email only inside auth tokens, so agent-deck does not read it.
2. A match from `~/.agent-deck/accounts.json` (config dir, then working-directory prefix).
3. `unknown`.

## accounts.json

`~/.agent-deck/accounts.json` (on Windows `%USERPROFILE%\.agent-deck\accounts.json`):

```json
{
  "accounts": [
    {
      "email": "me@work.com",
      "label": "work",
      "match": { "claudeConfigDir": "C:/Users/Me/.claude-work", "paths": ["C:/Users/Me/work"] }
    },
    {
      "email": "me@personal.com",
      "label": "personal",
      "match": { "codexHome": "/home/me/.codex-personal", "paths": ["/home/me/src"] }
    }
  ]
}
```

All accounts are shown together. Paths may contain spaces and use either slash style.

## Plugin interface

```ts
interface Session {
  id: string;
  agent: string;
  model?: string;
  email?: string;
  accountId?: string;
  cwd?: string;
  repo?: string;      // git remote origin name, else folder name
  doing?: string;     // last action or message, truncated
  updatedAt: number;
  pid?: number;
}

interface AgentPlugin {
  name: string;
  listSessions(ctx: PluginContext): Promise<Session[]>;
}
```

`PluginContext` carries `home`, `platform`, the loaded `accounts`, `activeWindowMs` and `now`.
Add a plugin in `src/plugins/` and register it in `src/plugins/index.ts`.

## Development

See [AGENTS.md](AGENTS.md) for the rules agents and humans follow in this repo.
