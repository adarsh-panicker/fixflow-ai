// agent/index.ts
import os from 'os';
import { IcmpProber, ProbeOutcome } from './icmpProber';
import { loadAgentConfig, redactSecret } from './config';

const AGENT_VERSION = '1.0.0';

async function sendHeartbeat(config: ReturnType<typeof loadAgentConfig>) {
  const url = `${config.serverUrl}/api/monitoring/agent/heartbeat`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: config.agentId,
        agentKey: config.agentKey,
        version: AGENT_VERSION,
        platform: os.platform(),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return true;
  } catch (err: any) {
    console.error(`[Agent Heartbeat Error] ${err.message}`);
    return false;
  }
}

async function fetchAssignments(config: ReturnType<typeof loadAgentConfig>) {
  const url = `${config.serverUrl}/api/monitoring/agent/assignments?agentId=${encodeURIComponent(
    config.agentId
  )}&agentKey=${encodeURIComponent(config.agentKey)}&workspaceId=${encodeURIComponent(
    config.workspaceId
  )}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-agent-id': config.agentId,
      'x-agent-key': config.agentKey,
      'x-workspace-id': config.workspaceId,
    },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data.assignments as Array<{
    assetId: string;
    assetTag: string;
    assetName: string;
    targetIp: string;
    pollingIntervalSeconds: number;
    timeoutSeconds: number;
    packetCount: number;
    maintenanceUntil: string | null;
    suppressAlerts: boolean;
  }>;
}

async function ingestResults(
  config: ReturnType<typeof loadAgentConfig>,
  results: Array<{
    assetId: string;
    checkedAt: string;
    result: string;
    averageLatencyMs: number | null;
    minLatencyMs: number | null;
    maxLatencyMs: number | null;
    packetsSent: number;
    packetsReceived: number;
    packetLossPercent: number;
    errorCode?: string | null;
    provider: 'REAL_AGENT';
  }>
) {
  if (results.length === 0) return true;

  const url = `${config.serverUrl}/api/monitoring/agent/ingest`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: config.agentId,
      agentKey: config.agentKey,
      workspaceId: config.workspaceId,
      results,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return true;
}

async function runMonitoringPass(config: ReturnType<typeof loadAgentConfig>) {
  console.log(`[${new Date().toISOString()}] Starting scheduled ICMP monitoring pass...`);

  // 1. Send Heartbeat
  const hbOk = await sendHeartbeat(config);
  if (!hbOk) {
    console.warn('[Agent] Heartbeat failed. Will retry assignments fetch anyway.');
  }

  // 2. Fetch Assignments
  let assignments;
  try {
    assignments = await fetchAssignments(config);
    console.log(`[Agent] Retrieved ${assignments.length} authorized asset assignments.`);
  } catch (err: any) {
    console.error(`[Agent] Failed to fetch assignments: ${err.message}`);
    return;
  }

  if (assignments.length === 0) {
    console.log('[Agent] No assets assigned to this agent at present.');
    return;
  }

  // 3. Execute Probes with bounded batching
  const resultsToIngest: Array<any> = [];

  for (let i = 0; i < assignments.length; i += config.maxConcurrency) {
    const batch = assignments.slice(i, i + config.maxConcurrency);
    const probePromises = batch.map(async (target) => {
      const now = new Date().toISOString();
      const outcome: ProbeOutcome = await IcmpProber.ping({
        targetIp: target.targetIp,
        packetCount: target.packetCount,
        timeoutSeconds: target.timeoutSeconds,
      });

      console.log(
        `  -> [${target.assetTag}] ${target.targetIp}: ${outcome.result} (${outcome.averageLatencyMs ? outcome.averageLatencyMs + 'ms' : 'N/A'}, ${outcome.packetLossPercent}% loss)`
      );

      return {
        assetId: target.assetId,
        checkedAt: now,
        result: outcome.result,
        averageLatencyMs: outcome.averageLatencyMs,
        minLatencyMs: outcome.minLatencyMs,
        maxLatencyMs: outcome.maxLatencyMs,
        packetsSent: outcome.packetsSent,
        packetsReceived: outcome.packetsReceived,
        packetLossPercent: outcome.packetLossPercent,
        errorCode: outcome.errorCode || null,
        provider: 'REAL_AGENT' as const,
      };
    });

    const batchResults = await Promise.all(probePromises);
    resultsToIngest.push(...batchResults);
  }

  // 4. Ingest Results
  try {
    await ingestResults(config, resultsToIngest);
    console.log(`[Agent] Successfully ingested ${resultsToIngest.length} check results to backend.`);
  } catch (err: any) {
    console.error(`[Agent] Ingestion failure: ${err.message}`);
  }
}

async function main() {
  const config = loadAgentConfig();
  const isOnce = process.argv.includes('--once');

  console.log('================================================================');
  console.log(`FixFlow AI — Local ICMP Availability Monitoring Agent v${AGENT_VERSION}`);
  console.log('================================================================');
  console.log(`Platform     : ${os.platform()} (${os.arch()})`);
  console.log(`Hostname     : ${os.hostname()}`);
  console.log(`Server URL   : ${config.serverUrl}`);
  console.log(`Agent ID     : ${config.agentId}`);
  console.log(`Agent Key    : ${redactSecret(config.agentKey)} (Redacted)`);
  console.log(`Workspace ID : ${config.workspaceId}`);
  console.log(`Interval     : ${config.pollIntervalSeconds}s (Concurrency: ${config.maxConcurrency})`);
  console.log('================================================================\n');

  if (isOnce) {
    console.log('[Agent] Running in single-pass mode (--once)...');
    await runMonitoringPass(config);
    console.log('[Agent] Single-pass finished. Exiting.');
    process.exit(0);
  }

  // Continuous loop
  let isRunning = true;
  process.on('SIGINT', () => {
    console.log('\n[Agent] Received SIGINT. Shutting down gracefully...');
    isRunning = false;
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('\n[Agent] Received SIGTERM. Shutting down gracefully...');
    isRunning = false;
    process.exit(0);
  });

  while (isRunning) {
    await runMonitoringPass(config);
    console.log(`[Agent] Next check pass in ${config.pollIntervalSeconds} seconds...\n`);
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalSeconds * 1000));
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[Agent Fatal Error]', err);
    process.exit(1);
  });
}
