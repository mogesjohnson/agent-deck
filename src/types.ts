export interface Session {
  id: string;
  agent: string;
  model?: string;
  email?: string;
  accountId?: string;
  cwd?: string;
  repo?: string;
  doing?: string;
  updatedAt: number;
  pid?: number;
}

export interface AccountMatch {
  codexHome?: string;
  claudeConfigDir?: string;
  paths?: string[];
}

export interface Account {
  email: string;
  label?: string;
  match?: AccountMatch;
}

export interface PluginContext {
  home: string;
  platform: NodeJS.Platform;
  accounts: Account[];
  /** Sessions whose files changed within this many ms count as active. */
  activeWindowMs: number;
  now: number;
}

export interface AgentPlugin {
  name: string;
  listSessions(ctx: PluginContext): Promise<Session[]>;
}
