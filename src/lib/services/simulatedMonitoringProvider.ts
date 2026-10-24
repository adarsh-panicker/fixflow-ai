// src/lib/services/simulatedMonitoringProvider.ts
import { prisma } from '../db/prisma';
import { MonitoringService } from './monitoringService';

export type SimulationMode =
  | 'HEALTHY'
  | 'DEGRADED_LATENCY'
  | 'PACKET_LOSS'
  | 'OFFLINE_OUTAGE'
  | 'RANDOM_CHAOS';

export class SimulatedMonitoringProvider {
  private static readonly SIMULATION_AGENT_KEY = 'ffa_agent_simulated_synthetic_prober_key_v1';

  /**
   * Ensures a dedicated simulation agent exists in the database
   */
  public static async getOrCreateSimulationAgent(workspaceId = 'ws-default') {
    let agent = await prisma.monitoringAgent.findFirst({
      where: {
        workspaceId,
        agentKey: this.SIMULATION_AGENT_KEY,
      },
    });

    if (!agent) {
      agent = await prisma.monitoringAgent.create({
        data: {
          workspaceId,
          agentKey: this.SIMULATION_AGENT_KEY,
          name: 'Synthetic Simulation Engine (In-Memory Mock)',
          hostname: 'simulation.internal',
          ipAddress: '127.0.0.1',
          platform: 'win32',
          version: '1.0.0-mock',
          status: 'ACTIVE',
          lastHeartbeat: new Date(),
        },
      });
    } else {
      // Touch heartbeat
      agent = await prisma.monitoringAgent.update({
        where: { id: agent.id },
        data: { lastHeartbeat: new Date(), status: 'ACTIVE' },
      });
    }

    return agent;
  }

  /**
   * Generates and ingests a cycle of simulated check results
   */
  public static async runSimulationCycle(params: {
    workspaceId?: string;
    assetIds?: string[];
    mode?: SimulationMode;
  }) {
    const workspaceId = params.workspaceId || 'ws-default';
    const mode = params.mode || 'HEALTHY';
    const agent = await this.getOrCreateSimulationAgent(workspaceId);

    // Fetch target configurations
    const where: any = { workspaceId, enabled: true };
    if (params.assetIds && params.assetIds.length > 0) {
      where.assetId = { in: params.assetIds };
    }

    const configs = await prisma.assetMonitoringConfiguration.findMany({
      where,
      include: { asset: true },
    });

    if (configs.length === 0) {
      return { success: true, count: 0, message: 'No enabled monitored assets found to simulate.' };
    }

    const now = new Date();
    const batchResults = [];

    for (const config of configs) {
      let result: 'SUCCESS' | 'TIMEOUT' | 'UNREACHABLE' | 'ERROR' = 'SUCCESS';
      let avgLatency: number | null = null;
      let minLatency: number | null = null;
      let maxLatency: number | null = null;
      const packetsSent = config.packetCount || 3;
      let packetsReceived = packetsSent;
      let packetLossPercent = 0;
      let errorCode: string | null = null;

      const targetMode =
        mode === 'RANDOM_CHAOS'
          ? Math.random() < 0.7
            ? 'HEALTHY'
            : Math.random() < 0.5
            ? 'DEGRADED_LATENCY'
            : 'OFFLINE_OUTAGE'
          : mode;

      if (targetMode === 'HEALTHY') {
        result = 'SUCCESS';
        avgLatency = Number((1.2 + Math.random() * 8.5).toFixed(1));
        minLatency = Number((avgLatency * 0.8).toFixed(1));
        maxLatency = Number((avgLatency * 1.3).toFixed(1));
        packetsReceived = packetsSent;
        packetLossPercent = 0;
      } else if (targetMode === 'DEGRADED_LATENCY') {
        result = 'SUCCESS';
        const warnThreshold = config.latencyWarningMs || 100;
        avgLatency = Number((warnThreshold + 25 + Math.random() * 150).toFixed(1));
        minLatency = Number((avgLatency * 0.85).toFixed(1));
        maxLatency = Number((avgLatency * 1.4).toFixed(1));
        packetsReceived = packetsSent;
        packetLossPercent = 0;
      } else if (targetMode === 'PACKET_LOSS') {
        result = 'SUCCESS';
        packetsReceived = Math.max(1, packetsSent - 1);
        packetLossPercent = Number((((packetsSent - packetsReceived) / packetsSent) * 100).toFixed(1));
        avgLatency = Number((12.5 + Math.random() * 20).toFixed(1));
        minLatency = Number((avgLatency * 0.9).toFixed(1));
        maxLatency = Number((avgLatency * 1.2).toFixed(1));
      } else if (targetMode === 'OFFLINE_OUTAGE') {
        result = 'TIMEOUT';
        packetsReceived = 0;
        packetLossPercent = 100;
        avgLatency = null;
        minLatency = null;
        maxLatency = null;
        errorCode = 'ERR_ICMP_REQUEST_TIMED_OUT';
      }

      batchResults.push({
        assetId: config.assetId,
        checkedAt: now.toISOString(),
        result,
        averageLatencyMs: avgLatency,
        minLatencyMs: minLatency,
        maxLatencyMs: maxLatency,
        packetsSent,
        packetsReceived,
        packetLossPercent,
        errorCode,
        provider: 'SIMULATION' as const,
      });
    }

    // Ingest through standard pipeline
    const ingestion = await MonitoringService.ingestCheckResults({
      agentId: agent.id,
      agentKey: agent.agentKey,
      workspaceId,
      results: batchResults,
    });

    await prisma.monitoringAuditEvent.create({
      data: {
        workspaceId,
        eventType: 'SIMULATION_CYCLE',
        actor: 'SYSTEM',
        agentId: agent.id,
        details: JSON.stringify({ mode, count: batchResults.length }),
      },
    });

    return {
      success: true,
      mode,
      ingestedCount: ingestion.ingestedCount,
      timestamp: now.toISOString(),
    };
  }
}
