// agent/config.ts
import fs from 'fs';
import path from 'path';

export interface AgentConfig {
  serverUrl: string;
  agentId: string;
  agentKey: string;
  workspaceId: string;
  pollIntervalSeconds: number;
  maxConcurrency: number;
}

export function redactSecret(secret?: string): string {
  if (!secret) return '(none)';
  if (secret.length <= 8) return '****';
  return `${secret.substring(0, 8)}...${secret.substring(secret.length - 4)}`;
}

export function loadAgentConfig(): AgentConfig {
  // 1. Process CLI arguments
  const args = process.argv.slice(2);
  const argMap: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      argMap[key] = val;
    }
  }

  // 2. Check for agent.json if it exists
  let fileConfig: Record<string, any> = {};
  const configPath = path.resolve(process.cwd(), 'agent.json');
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e: any) {
      console.warn(`[Agent] Failed to read agent.json: ${e.message}`);
    }
  }

  const serverUrl =
    argMap['server'] ||
    process.env.FFA_SERVER_URL ||
    fileConfig.serverUrl ||
    'http://localhost:3000';

  const agentId =
    argMap['agent-id'] ||
    process.env.FFA_AGENT_ID ||
    fileConfig.agentId ||
    'agent-win11-ops';

  const agentKey =
    argMap['key'] ||
    process.env.FFA_AGENT_KEY ||
    fileConfig.agentKey ||
    'ffa_agent_demo_win11_ops01_lan_prober_key_v1';

  const workspaceId =
    argMap['workspace'] ||
    process.env.FFA_WORKSPACE_ID ||
    fileConfig.workspaceId ||
    'ws-default';

  const pollIntervalSeconds = parseInt(
    argMap['interval'] ||
      process.env.FFA_POLL_INTERVAL ||
      String(fileConfig.pollIntervalSeconds || 30),
    10
  );

  const maxConcurrency = parseInt(
    argMap['concurrency'] ||
      process.env.FFA_MAX_CONCURRENCY ||
      String(fileConfig.maxConcurrency || 5),
    10
  );

  return {
    serverUrl: serverUrl.replace(/\/$/, ''),
    agentId,
    agentKey,
    workspaceId,
    pollIntervalSeconds: Math.max(10, pollIntervalSeconds),
    maxConcurrency: Math.max(1, Math.min(20, maxConcurrency)),
  };
}
