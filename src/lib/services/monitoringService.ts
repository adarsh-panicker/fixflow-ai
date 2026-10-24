// src/lib/services/monitoringService.ts
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import {
  AvailabilityStatus,
  MonitoringDashboardSummary,
  MonitoredAssetRowDTO,
  AvailabilityIncidentDTO,
  MonitoringAgentDTO,
} from '@/types/monitoring';
import {
  MonitoringAgentRegisterSchema,
  MonitoringConfigUpsertSchema,
  MonitoringIngestBatchSchema,
} from '../validation/monitoringSchemas';

export class MonitoringService {
  // =========================================================================
  // 1. AGENT MANAGEMENT & AUTHENTICATION
  // =========================================================================

  public static async registerAgent(rawPayload: unknown): Promise<{ agent: MonitoringAgentDTO; agentKey: string }> {
    const data = MonitoringAgentRegisterSchema.parse(rawPayload);
    const agentKey = `ffa_agent_${crypto.randomBytes(24).toString('hex')}`;

    const agent = await prisma.monitoringAgent.create({
      data: {
        workspaceId: data.workspaceId,
        agentKey,
        name: data.name,
        hostname: data.hostname || null,
        ipAddress: data.ipAddress || null,
        platform: data.platform,
        version: data.version,
        status: 'ACTIVE',
        lastHeartbeat: new Date(),
      },
    });

    await prisma.monitoringAuditEvent.create({
      data: {
        workspaceId: data.workspaceId,
        eventType: 'AGENT_REGISTERED',
        actor: 'USER',
        agentId: agent.id,
        details: JSON.stringify({ name: agent.name, platform: agent.platform, version: agent.version }),
      },
    });

    return {
      agent: {
        id: agent.id,
        workspaceId: agent.workspaceId,
        name: agent.name,
        hostname: agent.hostname,
        ipAddress: agent.ipAddress,
        platform: agent.platform,
        version: agent.version,
        status: agent.status as any,
        lastHeartbeat: agent.lastHeartbeat?.toISOString() || null,
        registeredAt: agent.registeredAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      },
      agentKey,
    };
  }

  public static async verifyAgent(agentId: string, agentKey: string, workspaceId = 'ws-default') {
    const agent = await prisma.monitoringAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.agentKey !== agentKey) {
      throw new Error('Authentication failed: Invalid agent credentials.');
    }

    if (agent.workspaceId !== workspaceId) {
      throw new Error('Authorization failed: Agent does not belong to the specified workspace.');
    }

    if (agent.status === 'REVOKED') {
      throw new Error('Authorization failed: Monitoring agent credential has been revoked.');
    }

    return agent;
  }

  public static async recordHeartbeat(agentId: string, agentKey: string, workspaceId = 'ws-default') {
    await this.verifyAgent(agentId, agentKey, workspaceId);

    const updated = await prisma.monitoringAgent.update({
      where: { id: agentId },
      data: {
        lastHeartbeat: new Date(),
        status: 'ACTIVE',
      },
    });

    return { success: true, timestamp: updated.lastHeartbeat?.toISOString() };
  }

  public static async getAgents(workspaceId = 'ws-default'): Promise<MonitoringAgentDTO[]> {
    const agents = await prisma.monitoringAgent.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });

    const now = Date.now();
    return agents.map(a => {
      const isStale = !a.lastHeartbeat || (now - new Date(a.lastHeartbeat).getTime()) > 180_000;
      const computedStatus = a.status === 'REVOKED' ? 'REVOKED' : isStale ? 'DISCONNECTED' : 'ACTIVE';

      return {
        id: a.id,
        workspaceId: a.workspaceId,
        name: a.name,
        hostname: a.hostname,
        ipAddress: a.ipAddress,
        platform: a.platform,
        version: a.version,
        status: computedStatus as any,
        lastHeartbeat: a.lastHeartbeat?.toISOString() || null,
        registeredAt: a.registeredAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        assignedAssetCount: a._count.assignments,
      };
    });
  }

  public static async revokeAgent(agentId: string, workspaceId = 'ws-default') {
    const updated = await prisma.monitoringAgent.update({
      where: { id: agentId, workspaceId },
      data: { status: 'REVOKED' },
    });

    await prisma.monitoringAuditEvent.create({
      data: {
        workspaceId,
        eventType: 'AGENT_REVOKED',
        actor: 'USER',
        agentId,
        details: JSON.stringify({ reason: 'Manual administrative revocation' }),
      },
    });

    return updated;
  }

  /**
   * Identifies agents that have stopped sending heartbeats (> 180 seconds)
   * and transitions their assigned assets' availability state to UNKNOWN.
   */
  public static async detectStaleAgents(workspaceId = 'ws-default'): Promise<number> {
    const staleThreshold = new Date(Date.now() - 180_000);
    const staleAgents = await prisma.monitoringAgent.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        OR: [
          { lastHeartbeat: { lt: staleThreshold } },
          { lastHeartbeat: null },
        ],
      },
      include: {
        assignments: {
          select: { assetId: true },
        },
      },
    });

    let affectedAssetCount = 0;

    for (const agent of staleAgents) {
      // Mark agent disconnected
      await prisma.monitoringAgent.update({
        where: { id: agent.id },
        data: { status: 'DISCONNECTED' },
      });

      const assetIds = agent.assignments.map(a => a.assetId);
      if (assetIds.length > 0) {
        // Transition associated assets to UNKNOWN
        const states = await prisma.assetAvailabilityState.findMany({
          where: { assetId: { in: assetIds }, workspaceId },
        });

        for (const st of states) {
          if (st.currentStatus !== 'UNKNOWN') {
            await prisma.assetAvailabilityState.update({
              where: { id: st.id },
              data: {
                currentStatus: 'UNKNOWN',
                lastStateTransition: new Date(),
                transitionReason: `Monitoring Agent '${agent.name}' stopped reporting (heartbeat timeout).`,
              },
            });

            await prisma.monitoringAuditEvent.create({
              data: {
                workspaceId,
                eventType: 'AGENT_STALE_DETECTED',
                actor: 'SYSTEM',
                assetId: st.assetId,
                agentId: agent.id,
                details: JSON.stringify({
                  previousStatus: st.currentStatus,
                  newStatus: 'UNKNOWN',
                  reason: 'Agent disconnected',
                }),
              },
            });
            affectedAssetCount++;
          }
        }
      }
    }

    return affectedAssetCount;
  }

  // =========================================================================
  // 2. CONFIGURATION MANAGEMENT
  // =========================================================================

  public static async upsertConfig(rawPayload: unknown, workspaceId = 'ws-default') {
    const data = MonitoringConfigUpsertSchema.parse({
      ...(rawPayload as any),
      workspaceId,
    });

    // Verify asset exists in workspace
    const asset = await prisma.asset.findFirst({
      where: { id: data.assetId, workspaceId },
    });

    if (!asset) {
      throw new Error(`Asset '${data.assetId}' not found in workspace '${workspaceId}'.`);
    }

    if (data.agentId) {
      const agent = await prisma.monitoringAgent.findFirst({
        where: { id: data.agentId, workspaceId },
      });
      if (!agent) {
        throw new Error(`Monitoring agent '${data.agentId}' not found in workspace.`);
      }
    }

    const config = await prisma.assetMonitoringConfiguration.upsert({
      where: { assetId: data.assetId },
      update: {
        agentId: data.agentId || null,
        enabled: data.enabled,
        targetIp: data.targetIp,
        targetHostname: data.targetHostname || asset.hostname || null,
        addressFamily: data.addressFamily,
        pollingIntervalSeconds: data.pollingIntervalSeconds,
        timeoutSeconds: data.timeoutSeconds,
        packetCount: data.packetCount,
        failureThreshold: data.failureThreshold,
        recoveryThreshold: data.recoveryThreshold,
        latencyWarningMs: data.latencyWarningMs || null,
        packetLossWarningPercent: data.packetLossWarningPercent || null,
        maintenanceUntil: data.maintenanceUntil ? new Date(data.maintenanceUntil) : null,
        suppressAlerts: data.suppressAlerts,
      },
      create: {
        workspaceId,
        assetId: data.assetId,
        agentId: data.agentId || null,
        enabled: data.enabled,
        targetIp: data.targetIp,
        targetHostname: data.targetHostname || asset.hostname || null,
        addressFamily: data.addressFamily,
        pollingIntervalSeconds: data.pollingIntervalSeconds,
        timeoutSeconds: data.timeoutSeconds,
        packetCount: data.packetCount,
        failureThreshold: data.failureThreshold,
        recoveryThreshold: data.recoveryThreshold,
        latencyWarningMs: data.latencyWarningMs || null,
        packetLossWarningPercent: data.packetLossWarningPercent || null,
        maintenanceUntil: data.maintenanceUntil ? new Date(data.maintenanceUntil) : null,
        suppressAlerts: data.suppressAlerts,
      },
    });

    // Ensure AvailabilityState record exists
    await prisma.assetAvailabilityState.upsert({
      where: { assetId: data.assetId },
      update: {
        isSuppressed: data.suppressAlerts || (data.maintenanceUntil ? new Date(data.maintenanceUntil) > new Date() : false),
      },
      create: {
        workspaceId,
        assetId: data.assetId,
        currentStatus: data.enabled ? 'UNKNOWN' : 'MAINTENANCE',
        lastStateTransition: new Date(),
        transitionReason: 'Initial monitoring configuration provisioned',
        isSuppressed: data.suppressAlerts,
      },
    });

    await prisma.monitoringAuditEvent.create({
      data: {
        workspaceId,
        eventType: 'CONFIG_UPDATED',
        actor: 'USER',
        assetId: data.assetId,
        details: JSON.stringify({
          targetIp: config.targetIp,
          enabled: config.enabled,
          interval: config.pollingIntervalSeconds,
        }),
      },
    });

    return config;
  }

  public static async getConfigByAssetId(assetId: string, workspaceId = 'ws-default') {
    return await prisma.assetMonitoringConfiguration.findFirst({
      where: { assetId, workspaceId },
      include: {
        agent: { select: { id: true, name: true, status: true } },
      },
    });
  }

  /**
   * Retrieves monitoring assignments authorized for an agent
   */
  public static async getAgentAssignments(agentId: string, agentKey: string, workspaceId = 'ws-default') {
    await this.verifyAgent(agentId, agentKey, workspaceId);

    // Fetch enabled configs specifically assigned to this agent, or unassigned if this is the active agent
    const configs = await prisma.assetMonitoringConfiguration.findMany({
      where: {
        workspaceId,
        enabled: true,
        OR: [
          { agentId: agentId },
          { agentId: null },
        ],
      },
      include: {
        asset: {
          select: { id: true, assetTag: true, name: true, assetType: true, hostname: true, ipAddress: true },
        },
      },
    });

    return configs.map(c => ({
      assetId: c.assetId,
      assetTag: c.asset.assetTag,
      assetName: c.asset.name,
      targetIp: c.targetIp,
      targetHostname: c.targetHostname || c.asset.hostname,
      addressFamily: c.addressFamily,
      pollingIntervalSeconds: c.pollingIntervalSeconds,
      timeoutSeconds: c.timeoutSeconds,
      packetCount: c.packetCount,
      maintenanceUntil: c.maintenanceUntil?.toISOString() || null,
      suppressAlerts: c.suppressAlerts,
    }));
  }

  // =========================================================================
  // 3. RESULT INGESTION & AVAILABILITY ENGINE
  // =========================================================================

  public static async ingestCheckResults(rawPayload: unknown) {
    const data = MonitoringIngestBatchSchema.parse(rawPayload);
    const agent = await this.verifyAgent(data.agentId, data.agentKey, data.workspaceId);

    // Update agent heartbeat on every valid submission
    await prisma.monitoringAgent.update({
      where: { id: agent.id },
      data: { lastHeartbeat: new Date(), status: 'ACTIVE' },
    });

    const ingestedResults = [];

    for (const item of data.results) {
      // Validate asset authorization
      const config = await prisma.assetMonitoringConfiguration.findFirst({
        where: { assetId: item.assetId, workspaceId: data.workspaceId },
        include: { asset: true },
      });

      if (!config) {
        console.warn(`[Monitoring Ingest] Skipping unauthorized asset ${item.assetId}`);
        continue;
      }

      // If configuration is assigned to a different specific agent, reject ingestion from this agent
      if (item.provider !== 'SIMULATION' && config.agentId && config.agentId !== agent.id) {
        console.warn(`[Monitoring Ingest] Agent ${agent.id} unauthorized for asset ${item.assetId} (assigned to ${config.agentId})`);
        continue;
      }

      // Persist check result
      const checkResult = await prisma.monitoringCheckResult.create({
        data: {
          workspaceId: data.workspaceId,
          assetId: item.assetId,
          agentId: agent.id,
          checkedAt: new Date(item.checkedAt),
          receivedAt: new Date(),
          result: item.result,
          averageLatencyMs: item.averageLatencyMs ?? null,
          minLatencyMs: item.minLatencyMs ?? null,
          maxLatencyMs: item.maxLatencyMs ?? null,
          packetsSent: item.packetsSent,
          packetsReceived: item.packetsReceived,
          packetLossPercent: item.packetLossPercent,
          errorCode: item.errorCode || null,
          provider: item.provider,
        },
      });

      // Update availability state inside transaction
      await this.processResultStateTransition(config, checkResult, data.workspaceId);
      ingestedResults.push(checkResult.id);
    }

    return {
      success: true,
      ingestedCount: ingestedResults.length,
      agentId: agent.id,
    };
  }

  /**
   * Deterministically transitions availability state and creates/resolves incidents
   */
  private static async processResultStateTransition(
    config: any,
    checkResult: any,
    workspaceId: string
  ) {
    const now = new Date();
    const isMaintenance = Boolean(
      config.suppressAlerts ||
      (config.maintenanceUntil && new Date(config.maintenanceUntil) > now)
    );

    let state = await prisma.assetAvailabilityState.findUnique({
      where: { assetId: config.assetId },
    });

    if (!state) {
      state = await prisma.assetAvailabilityState.create({
        data: {
          workspaceId,
          assetId: config.assetId,
          currentStatus: 'UNKNOWN',
          lastStateTransition: now,
        },
      });
    }

    const previousStatus = state.currentStatus as AvailabilityStatus;
    let nextStatus: AvailabilityStatus = previousStatus;
    let consecutiveFailures = state.consecutiveFailures;
    let consecutiveSuccesses = state.consecutiveSuccesses;
    let transitionReason = state.transitionReason;
    let lastSuccessfulResponse = state.lastSuccessfulResponse;

    if (isMaintenance) {
      nextStatus = 'MAINTENANCE';
      transitionReason = 'Monitoring suppressed: Asset is within an active maintenance window.';
    } else if (checkResult.result === 'SUCCESS') {
      consecutiveSuccesses += 1;
      consecutiveFailures = 0;
      lastSuccessfulResponse = checkResult.checkedAt;

      const isLatencyDegraded =
        config.latencyWarningMs != null &&
        checkResult.averageLatencyMs != null &&
        checkResult.averageLatencyMs > config.latencyWarningMs;

      const isLossDegraded =
        config.packetLossWarningPercent != null &&
        checkResult.packetLossPercent > config.packetLossWarningPercent;

      if (isLatencyDegraded || isLossDegraded) {
        nextStatus = 'DEGRADED';
        transitionReason = isLatencyDegraded
          ? `High latency observed: ${checkResult.averageLatencyMs?.toFixed(1)}ms (Threshold: ${config.latencyWarningMs}ms)`
          : `High packet loss observed: ${checkResult.packetLossPercent}% (Threshold: ${config.packetLossWarningPercent}%)`;
      } else {
        nextStatus = 'ONLINE';
        transitionReason = `Normal ICMP Echo Reply received (${checkResult.averageLatencyMs?.toFixed(1)}ms, 0% loss).`;
      }

      // Check recovery of active availability incident
      if (consecutiveSuccesses >= config.recoveryThreshold) {
        await this.handleAssetRecovery(config, state, checkResult, workspaceId);
      }
    } else {
      // Check failed (TIMEOUT, UNREACHABLE, ERROR)
      consecutiveFailures += 1;
      consecutiveSuccesses = 0;

      if (consecutiveFailures >= config.failureThreshold) {
        nextStatus = 'OFFLINE';
        transitionReason = `Target failed ${consecutiveFailures} consecutive ICMP checks (${checkResult.result}). Failure threshold reached.`;
        await this.handleAssetOutage(config, state, checkResult, consecutiveFailures, workspaceId);
      } else {
        // Do not immediately mark offline on 1 failed check!
        transitionReason = `Single probe failed (${checkResult.result}). ${consecutiveFailures}/${config.failureThreshold} failures before declaring offline.`;
      }
    }

    const hasChanged = previousStatus !== nextStatus;

    await prisma.assetAvailabilityState.update({
      where: { assetId: config.assetId },
      data: {
        currentStatus: nextStatus,
        lastObservedState: checkResult.result,
        consecutiveFailures,
        consecutiveSuccesses,
        lastCheckTime: checkResult.checkedAt,
        lastSuccessfulResponse,
        lastStateTransition: hasChanged ? now : state.lastStateTransition,
        transitionReason,
        latestLatencyMs: checkResult.averageLatencyMs,
        latestPacketLoss: checkResult.packetLossPercent,
        isSuppressed: isMaintenance,
      },
    });

    if (hasChanged) {
      await prisma.monitoringAuditEvent.create({
        data: {
          workspaceId,
          eventType: 'STATE_TRANSITION',
          actor: 'SYSTEM',
          assetId: config.assetId,
          details: JSON.stringify({
            previousStatus,
            newStatus: nextStatus,
            consecutiveFailures,
            consecutiveSuccesses,
            reason: transitionReason,
          }),
        },
      });
    }
  }

  private static async handleAssetOutage(
    config: any,
    state: any,
    checkResult: any,
    consecutiveFailures: number,
    workspaceId: string
  ) {
    // Check if there is already an active (unresolved) incident for this asset
    const activeIncident = await prisma.availabilityIncident.findFirst({
      where: {
        assetId: config.assetId,
        workspaceId,
        status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] },
      },
    });

    const now = new Date();

    if (activeIncident) {
      // Update latest failure time on the existing uninterrupted outage incident
      await prisma.availabilityIncident.update({
        where: { id: activeIncident.id },
        data: {
          latestFailureAt: checkResult.checkedAt,
          failureSummary: `Ongoing outage: ${consecutiveFailures} consecutive probe timeouts on IP ${config.targetIp}.`,
        },
      });
    } else {
      // Derive severity based on asset criticality
      let severity: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW' = 'P3_MEDIUM';
      if (config.asset.criticality === 'TIER_1_CRITICAL') severity = 'P1_CRITICAL';
      else if (config.asset.criticality === 'TIER_2_HIGH') severity = 'P2_HIGH';
      else if (config.asset.criticality === 'TIER_4_LOW') severity = 'P4_LOW';

      const firstFailureAt = state.lastCheckTime || checkResult.checkedAt;

      const incident = await prisma.availabilityIncident.create({
        data: {
          workspaceId,
          assetId: config.assetId,
          title: `Availability Outage: ${config.asset.assetTag} (${config.targetIp}) Unreachable`,
          status: 'TRIGGERED',
          severity,
          firstFailureAt,
          thresholdCrossedAt: now,
          latestFailureAt: checkResult.checkedAt,
          failureSummary: `Asset reached configured failure threshold (${config.failureThreshold} consecutive missed ICMP Echo Replies). Target IP ${config.targetIp} is unresponsive.`,
        },
      });

      await prisma.monitoringAuditEvent.create({
        data: {
          workspaceId,
          eventType: 'INCIDENT_TRIGGERED',
          actor: 'SYSTEM',
          assetId: config.assetId,
          details: JSON.stringify({
            incidentId: incident.id,
            title: incident.title,
            severity,
            consecutiveFailures,
          }),
        },
      });
    }
  }

  private static async handleAssetRecovery(
    config: any,
    state: any,
    checkResult: any,
    workspaceId: string
  ) {
    const activeIncident = await prisma.availabilityIncident.findFirst({
      where: {
        assetId: config.assetId,
        workspaceId,
        status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] },
      },
    });

    if (!activeIncident) return;

    const now = new Date();
    const outageSeconds = Math.max(
      1,
      Math.floor((now.getTime() - new Date(activeIncident.thresholdCrossedAt).getTime()) / 1000)
    );

    await prisma.availabilityIncident.update({
      where: { id: activeIncident.id },
      data: {
        status: 'RECOVERED',
        recoveredAt: now,
        outageDurationSeconds: outageSeconds,
        recoverySummary: `Target successfully responded to ${config.recoveryThreshold} consecutive ICMP Echo Requests. Average latency: ${checkResult.averageLatencyMs?.toFixed(1) || 'N/A'}ms.`,
      },
    });

    await prisma.monitoringAuditEvent.create({
      data: {
        workspaceId,
        eventType: 'INCIDENT_RECOVERED',
        actor: 'SYSTEM',
        assetId: config.assetId,
        details: JSON.stringify({
          incidentId: activeIncident.id,
          outageDurationSeconds: outageSeconds,
          recoveredAt: now.toISOString(),
        }),
      },
    });
  }

  // =========================================================================
  // 4. DASHBOARD & DATA QUERY APIS
  // =========================================================================

  public static async getDashboardSummary(workspaceId = 'ws-default'): Promise<MonitoringDashboardSummary> {
    // Run stale agent detector as part of dashboard refresh
    await this.detectStaleAgents(workspaceId);

    const [
      totalMonitored,
      states,
      agents,
      activeIncidents,
      recentIncidents,
      recentRecoveries,
      recentChecks,
    ] = await Promise.all([
      prisma.assetMonitoringConfiguration.count({ where: { workspaceId, enabled: true } }),
      prisma.assetAvailabilityState.findMany({ where: { workspaceId } }),
      prisma.monitoringAgent.findMany({ where: { workspaceId } }),
      prisma.availabilityIncident.count({
        where: { workspaceId, status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] } },
      }),
      prisma.availabilityIncident.findMany({
        where: { workspaceId, status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] } },
        orderBy: { thresholdCrossedAt: 'desc' },
        take: 5,
        include: { asset: { select: { assetTag: true, name: true, assetType: true } } },
      }),
      prisma.availabilityIncident.findMany({
        where: { workspaceId, status: 'RECOVERED' },
        orderBy: { recoveredAt: 'desc' },
        take: 5,
        include: { asset: { select: { assetTag: true, name: true, assetType: true } } },
      }),
      prisma.monitoringCheckResult.findMany({
        where: {
          workspaceId,
          checkedAt: { gte: new Date(Date.now() - 3600_000) },
        },
        select: { averageLatencyMs: true, packetLossPercent: true, provider: true },
      }),
    ]);

    let online = 0;
    let degraded = 0;
    let offline = 0;
    let unknown = 0;
    let maintenance = 0;

    for (const s of states) {
      if (s.currentStatus === 'ONLINE') online++;
      else if (s.currentStatus === 'DEGRADED') degraded++;
      else if (s.currentStatus === 'OFFLINE') offline++;
      else if (s.currentStatus === 'MAINTENANCE') maintenance++;
      else unknown++;
    }

    const now = Date.now();
    let connectedAgents = 0;
    let disconnectedAgents = 0;

    for (const a of agents) {
      const isStale = !a.lastHeartbeat || (now - new Date(a.lastHeartbeat).getTime()) > 180_000;
      if (a.status === 'ACTIVE' && !isStale) connectedAgents++;
      else disconnectedAgents++;
    }

    let latencySum = 0;
    let latencyCount = 0;
    let lossSum = 0;
    let realAgentCount = 0;
    let simulationCount = 0;

    for (const c of recentChecks) {
      if (c.provider === 'SIMULATION') simulationCount++;
      else realAgentCount++;

      if (c.averageLatencyMs != null) {
        latencySum += c.averageLatencyMs;
        latencyCount++;
      }
      lossSum += c.packetLossPercent;
    }

    const avgLatency = latencyCount > 0 ? Number((latencySum / latencyCount).toFixed(1)) : null;
    const avgLoss = recentChecks.length > 0 ? Number((lossSum / recentChecks.length).toFixed(1)) : null;

    const mapIncident = (inc: any): AvailabilityIncidentDTO => ({
      id: inc.id,
      workspaceId: inc.workspaceId,
      assetId: inc.assetId,
      assetTag: inc.asset?.assetTag,
      assetName: inc.asset?.name,
      assetType: inc.asset?.assetType,
      title: inc.title,
      status: inc.status,
      severity: inc.severity,
      firstFailureAt: inc.firstFailureAt.toISOString(),
      thresholdCrossedAt: inc.thresholdCrossedAt.toISOString(),
      latestFailureAt: inc.latestFailureAt.toISOString(),
      recoveredAt: inc.recoveredAt?.toISOString() || null,
      outageDurationSeconds: inc.outageDurationSeconds,
      acknowledgedAt: inc.acknowledgedAt?.toISOString() || null,
      acknowledgedBy: inc.acknowledgedBy,
      failureSummary: inc.failureSummary,
      recoverySummary: inc.recoverySummary,
      createdAt: inc.createdAt.toISOString(),
      updatedAt: inc.updatedAt.toISOString(),
    });

    return {
      totalMonitoredAssets: totalMonitored,
      onlineAssets: online,
      degradedAssets: degraded,
      offlineAssets: offline,
      unknownAssets: unknown,
      maintenanceAssets: maintenance,
      connectedAgents,
      disconnectedAgents,
      activeIncidentsCount: activeIncidents,
      recentIncidents: recentIncidents.map(mapIncident),
      recentRecoveries: recentRecoveries.map(mapIncident),
      averageLatencyMs: avgLatency,
      averagePacketLossPercent: avgLoss,
      providerBreakdown: {
        realAgentCount,
        simulationCount,
      },
    };
  }

  public static async getMonitoredAssetRows(
    workspaceId = 'ws-default',
    filters?: { search?: string; status?: string; agentId?: string }
  ): Promise<MonitoredAssetRowDTO[]> {
    const configs = await prisma.assetMonitoringConfiguration.findMany({
      where: { workspaceId },
      include: {
        asset: true,
        agent: { select: { id: true, name: true } },
      },
      orderBy: { asset: { criticality: 'asc' } },
    });

    const assetIds = configs.map(c => c.assetId);

    const [states, activeIncidents] = await Promise.all([
      prisma.assetAvailabilityState.findMany({
        where: { assetId: { in: assetIds }, workspaceId },
      }),
      prisma.availabilityIncident.findMany({
        where: {
          assetId: { in: assetIds },
          workspaceId,
          status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] },
        },
        select: { id: true, assetId: true },
      }),
    ]);

    const stateMap = new Map(states.map(s => [s.assetId, s]));
    const incidentMap = new Map(activeIncidents.map(i => [i.assetId, i.id]));
    const now = Date.now();

    const rows: MonitoredAssetRowDTO[] = [];

    for (const c of configs) {
      const state = stateMap.get(c.assetId);
      const status: AvailabilityStatus = state?.currentStatus as any || 'UNKNOWN';

      if (filters?.status && filters.status !== 'ALL' && status !== filters.status) {
        continue;
      }

      if (filters?.agentId && filters.agentId !== 'ALL' && c.agentId !== filters.agentId) {
        continue;
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matches =
          c.asset.name.toLowerCase().includes(q) ||
          c.asset.assetTag.toLowerCase().includes(q) ||
          c.targetIp.toLowerCase().includes(q) ||
          (c.targetHostname && c.targetHostname.toLowerCase().includes(q));
        if (!matches) continue;
      }

      const lastTransitionTime = state?.lastStateTransition
        ? new Date(state.lastStateTransition).getTime()
        : now;
      const statusDurationSeconds = Math.max(0, Math.floor((now - lastTransitionTime) / 1000));

      rows.push({
        assetId: c.assetId,
        assetTag: c.asset.assetTag,
        assetName: c.asset.name,
        assetType: c.asset.assetType,
        criticality: c.asset.criticality,
        targetIp: c.targetIp,
        targetHostname: c.targetHostname || c.asset.hostname,
        status,
        lastObservedState: state?.lastObservedState as any || null,
        latestLatencyMs: state?.latestLatencyMs ?? null,
        latestPacketLoss: state?.latestPacketLoss ?? null,
        lastSuccessfulResponse: state?.lastSuccessfulResponse?.toISOString() || null,
        lastCheckTime: state?.lastCheckTime?.toISOString() || null,
        statusDurationSeconds,
        agentId: c.agentId,
        agentName: c.agent?.name || 'Unassigned',
        configEnabled: c.enabled,
        consecutiveFailures: state?.consecutiveFailures || 0,
        activeIncidentId: incidentMap.get(c.assetId) || null,
      });
    }

    return rows;
  }

  public static async getAssetMonitoringHistory(assetId: string, workspaceId = 'ws-default') {
    const [config, state, checks, incidents] = await Promise.all([
      prisma.assetMonitoringConfiguration.findFirst({
        where: { assetId, workspaceId },
        include: { agent: { select: { id: true, name: true, platform: true } } },
      }),
      prisma.assetAvailabilityState.findUnique({
        where: { assetId },
      }),
      prisma.monitoringCheckResult.findMany({
        where: { assetId, workspaceId },
        orderBy: { checkedAt: 'desc' },
        take: 30,
      }),
      prisma.availabilityIncident.findMany({
        where: { assetId, workspaceId },
        orderBy: { thresholdCrossedAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      config,
      state,
      checks: checks.map(c => ({
        id: c.id,
        checkedAt: c.checkedAt.toISOString(),
        result: c.result,
        averageLatencyMs: c.averageLatencyMs,
        packetLossPercent: c.packetLossPercent,
        provider: c.provider,
        packetsSent: c.packetsSent,
        packetsReceived: c.packetsReceived,
      })),
      incidents: incidents.map(i => ({
        id: i.id,
        title: i.title,
        status: i.status,
        severity: i.severity,
        firstFailureAt: i.firstFailureAt.toISOString(),
        thresholdCrossedAt: i.thresholdCrossedAt.toISOString(),
        latestFailureAt: i.latestFailureAt.toISOString(),
        recoveredAt: i.recoveredAt?.toISOString() || null,
        outageDurationSeconds: i.outageDurationSeconds,
        failureSummary: i.failureSummary,
        recoverySummary: i.recoverySummary,
        acknowledgedAt: i.acknowledgedAt?.toISOString() || null,
        acknowledgedBy: i.acknowledgedBy,
      })),
    };
  }

  public static async acknowledgeIncident(
    incidentId: string,
    acknowledgedBy = 'Lead Incident Technician',
    notes?: string,
    workspaceId = 'ws-default'
  ) {
    const updated = await prisma.availabilityIncident.update({
      where: { id: incidentId, workspaceId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy,
      },
    });

    await prisma.monitoringAuditEvent.create({
      data: {
        workspaceId,
        eventType: 'INCIDENT_ACKNOWLEDGED',
        actor: 'USER',
        assetId: updated.assetId,
        details: JSON.stringify({ incidentId, acknowledgedBy, notes }),
      },
    });

    return updated;
  }

  // =========================================================================
  // 5. TROUBLESHOOTING & AI CONTEXT INTEGRATION
  // =========================================================================

  public static async getMonitoringEvidenceContext(assetId: string, workspaceId = 'ws-default') {
    const [asset, config, state, latestCheck, activeIncident, outgoingRels, incomingRels] = await Promise.all([
      prisma.asset.findFirst({ where: { id: assetId, workspaceId } }),
      prisma.assetMonitoringConfiguration.findFirst({
        where: { assetId, workspaceId },
        include: { agent: { select: { name: true } } },
      }),
      prisma.assetAvailabilityState.findUnique({ where: { assetId } }),
      prisma.monitoringCheckResult.findFirst({
        where: { assetId, workspaceId },
        orderBy: { checkedAt: 'desc' },
      }),
      prisma.availabilityIncident.findFirst({
        where: { assetId, workspaceId, status: { in: ['TRIGGERED', 'ACKNOWLEDGED'] } },
      }),
      prisma.assetRelationship.findMany({
        where: { sourceAssetId: assetId, workspaceId },
        include: {
          targetAsset: {
            include: {
              availabilityState: true,
              monitoringConfig: true,
            },
          },
        },
      }),
      prisma.assetRelationship.findMany({
        where: { targetAssetId: assetId, workspaceId },
        include: {
          sourceAsset: {
            include: {
              availabilityState: true,
              monitoringConfig: true,
            },
          },
        },
      }),
    ]);

    if (!asset) return null;

    const now = Date.now();
    let freshness: 'FRESH_LIVE_MEASUREMENT' | 'RECENT_MEASUREMENT' | 'STALE_NO_RECENT_MEASUREMENT' =
      'STALE_NO_RECENT_MEASUREMENT';

    if (latestCheck) {
      const ageMs = now - new Date(latestCheck.checkedAt).getTime();
      if (ageMs <= 300_000) freshness = 'FRESH_LIVE_MEASUREMENT'; // <= 5 min
      else if (ageMs <= 3600_000) freshness = 'RECENT_MEASUREMENT'; // <= 1 hour
    }

    const dependencies = [];
    let failingDepsCount = 0;

    for (const rel of outgoingRels) {
      const dep = rel.targetAsset;
      const st = dep.availabilityState?.currentStatus || 'UNKNOWN';
      if (st === 'OFFLINE' || st === 'DEGRADED') failingDepsCount++;
      dependencies.push({
        assetTag: dep.assetTag,
        name: dep.name,
        relationshipType: rel.relationshipType,
        targetIp: dep.monitoringConfig?.targetIp || dep.ipAddress || 'N/A',
        currentStatus: st,
        latestLatencyMs: dep.availabilityState?.latestLatencyMs ?? null,
        latestPacketLoss: dep.availabilityState?.latestPacketLoss ?? null,
        checkedAt: dep.availabilityState?.lastCheckTime?.toISOString() || null,
      });
    }

    for (const rel of incomingRels) {
      const dep = rel.sourceAsset;
      const st = dep.availabilityState?.currentStatus || 'UNKNOWN';
      if (st === 'OFFLINE' || st === 'DEGRADED') failingDepsCount++;
      dependencies.push({
        assetTag: dep.assetTag,
        name: dep.name,
        relationshipType: `INCOMING_${rel.relationshipType}`,
        targetIp: dep.monitoringConfig?.targetIp || dep.ipAddress || 'N/A',
        currentStatus: st,
        latestLatencyMs: dep.availabilityState?.latestLatencyMs ?? null,
        latestPacketLoss: dep.availabilityState?.latestPacketLoss ?? null,
        checkedAt: dep.availabilityState?.lastCheckTime?.toISOString() || null,
      });
    }

    const isTargetOffline = state?.currentStatus === 'OFFLINE';
    let reachabilitySummary =
      'Target appears reachable via ICMP. Verify application-layer services and access controls (ICMP reachability != application health).';
    if (isTargetOffline && failingDepsCount > 0) {
      reachabilitySummary = `Correlated reachability failure: Target and ${failingDepsCount} related dependency node(s) are failing availability checks. Prioritize upstream network routing/switch path failure.`;
    } else if (isTargetOffline) {
      reachabilitySummary =
        'Isolated reachability failure: Target fails ICMP checks, but adjacent infrastructure dependencies are responding. Check host power, physical link, or local host firewall.';
    }

    return {
      targetAsset: {
        assetId: asset.id,
        assetTag: asset.assetTag,
        name: asset.name,
        targetIp: config?.targetIp || asset.ipAddress || 'N/A',
        currentStatus: (state?.currentStatus || 'UNKNOWN') as AvailabilityStatus,
        latestLatencyMs: state?.latestLatencyMs ?? null,
        latestPacketLoss: state?.latestPacketLoss ?? null,
        checkedAt: latestCheck?.checkedAt.toISOString() || null,
        freshness,
        provider: (latestCheck?.provider || 'NONE') as any,
        agentName: config?.agent?.name || null,
        transitionReason: state?.transitionReason || null,
        hasActiveIncident: Boolean(activeIncident),
      },
      dependencyMonitoring: dependencies,
      reachabilityCorrelation: {
        multipleFailuresDetected: isTargetOffline && failingDepsCount > 0,
        failingDependenciesCount: failingDepsCount,
        summary: reachabilitySummary,
      },
    };
  }
}
