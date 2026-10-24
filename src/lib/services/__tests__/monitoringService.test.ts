// src/lib/services/__tests__/monitoringService.test.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../db/prisma';
import { MonitoringService } from '../monitoringService';
import { SimulatedMonitoringProvider } from '../simulatedMonitoringProvider';

describe('FixFlow AI - Infrastructure Availability Monitoring', () => {
  const TEST_WORKSPACE = 'ws-test-monitoring';
  let testAgentId = '';
  let testAgentKey = '';
  let testAssetId = '';

  before(async () => {
    // Setup clean test workspace and asset
    await prisma.workspace.upsert({
      where: { id: TEST_WORKSPACE },
      update: {},
      create: { id: TEST_WORKSPACE, name: 'Monitoring Test Workspace' },
    });

    const asset = await prisma.asset.create({
      data: {
        workspaceId: TEST_WORKSPACE,
        assetTag: 'TEST-SRV-01',
        name: 'Test Application Server',
        assetType: 'SERVER',
        ipAddress: '192.168.10.50',
        criticality: 'TIER_1_CRITICAL',
        status: 'OPERATIONAL',
      },
    });
    testAssetId = asset.id;

    // Register a test agent
    const reg = await MonitoringService.registerAgent({
      name: 'Test Prober Agent (Linux)',
      platform: 'linux',
      version: '1.0.0',
      workspaceId: TEST_WORKSPACE,
    });
    testAgentId = reg.agent.id;
    testAgentKey = reg.agentKey;
  });

  after(async () => {
    // Cleanup test data
    await prisma.monitoringAuditEvent.deleteMany({ where: { workspaceId: TEST_WORKSPACE } });
    await prisma.monitoringCheckResult.deleteMany({ where: { workspaceId: TEST_WORKSPACE } });
    await prisma.availabilityIncident.deleteMany({ where: { workspaceId: TEST_WORKSPACE } });
    await prisma.assetAvailabilityState.deleteMany({ where: { workspaceId: TEST_WORKSPACE } });
    await prisma.assetMonitoringConfiguration.deleteMany({ where: { workspaceId: TEST_WORKSPACE } });
    await prisma.monitoringAgent.deleteMany({ where: { workspaceId: TEST_WORKSPACE } });
    await prisma.asset.deleteMany({ where: { workspaceId: TEST_WORKSPACE } });
    await prisma.workspace.delete({ where: { id: TEST_WORKSPACE } }).catch(() => {});
  });

  it('1. registers an agent securely and verifies cryptographic agent key', async () => {
    assert.ok(testAgentKey.startsWith('ffa_agent_'), 'Agent key must have ffa_agent_ prefix');
    const agent = await MonitoringService.verifyAgent(testAgentId, testAgentKey, TEST_WORKSPACE);
    assert.equal(agent.name, 'Test Prober Agent (Linux)');
    assert.equal(agent.status, 'ACTIVE');

    // Invalid key must reject
    await assert.rejects(
      MonitoringService.verifyAgent(testAgentId, 'invalid-key-xyz', TEST_WORKSPACE),
      /Authentication failed/
    );
  });

  it('2. upserts monitoring configuration with valid thresholds and target IP', async () => {
    const config = await MonitoringService.upsertConfig({
      assetId: testAssetId,
      agentId: testAgentId,
      enabled: true,
      targetIp: '192.168.10.50',
      pollingIntervalSeconds: 30,
      timeoutSeconds: 2,
      packetCount: 3,
      failureThreshold: 3,
      recoveryThreshold: 2,
      latencyWarningMs: 50,
      packetLossWarningPercent: 15,
    }, TEST_WORKSPACE);

    assert.equal(config.targetIp, '192.168.10.50');
    assert.equal(config.failureThreshold, 3);
    assert.equal(config.recoveryThreshold, 2);

    // Initial state must be UNKNOWN before any probe runs
    const state = await prisma.assetAvailabilityState.findUnique({ where: { assetId: testAssetId } });
    assert.equal(state?.currentStatus, 'UNKNOWN');
  });

  it('3. successful probe transitions status to ONLINE', async () => {
    const now = new Date();
    await MonitoringService.ingestCheckResults({
      agentId: testAgentId,
      agentKey: testAgentKey,
      workspaceId: TEST_WORKSPACE,
      results: [
        {
          assetId: testAssetId,
          checkedAt: now.toISOString(),
          result: 'SUCCESS',
          averageLatencyMs: 4.2,
          minLatencyMs: 3.8,
          maxLatencyMs: 4.9,
          packetsSent: 3,
          packetsReceived: 3,
          packetLossPercent: 0,
          provider: 'REAL_AGENT',
        },
      ],
    });

    const state = await prisma.assetAvailabilityState.findUnique({ where: { assetId: testAssetId } });
    assert.equal(state?.currentStatus, 'ONLINE');
    assert.equal(state?.consecutiveSuccesses, 1);
    assert.equal(state?.consecutiveFailures, 0);
  });

  it('4. elevated latency transitions status to DEGRADED', async () => {
    const now = new Date();
    await MonitoringService.ingestCheckResults({
      agentId: testAgentId,
      agentKey: testAgentKey,
      workspaceId: TEST_WORKSPACE,
      results: [
        {
          assetId: testAssetId,
          checkedAt: now.toISOString(),
          result: 'SUCCESS',
          averageLatencyMs: 85.5, // Exceeds 50ms warning threshold
          packetsSent: 3,
          packetsReceived: 3,
          packetLossPercent: 0,
          provider: 'REAL_AGENT',
        },
      ],
    });

    const state = await prisma.assetAvailabilityState.findUnique({ where: { assetId: testAssetId } });
    assert.equal(state?.currentStatus, 'DEGRADED');
    assert.ok(state?.transitionReason?.includes('High latency observed'));
  });

  it('5. single missed check does NOT immediately declare target OFFLINE', async () => {
    const now = new Date();
    await MonitoringService.ingestCheckResults({
      agentId: testAgentId,
      agentKey: testAgentKey,
      workspaceId: TEST_WORKSPACE,
      results: [
        {
          assetId: testAssetId,
          checkedAt: now.toISOString(),
          result: 'TIMEOUT',
          packetsSent: 3,
          packetsReceived: 0,
          packetLossPercent: 100,
          provider: 'REAL_AGENT',
        },
      ],
    });

    const state = await prisma.assetAvailabilityState.findUnique({ where: { assetId: testAssetId } });
    // Consecutive failure count is 1, threshold is 3 -> remains previous status (DEGRADED)
    assert.equal(state?.consecutiveFailures, 1);
    assert.notEqual(state?.currentStatus, 'OFFLINE', 'A single missed ping must not declare OFFLINE');

    const incidents = await prisma.availabilityIncident.findMany({ where: { assetId: testAssetId } });
    assert.equal(incidents.length, 0, 'No incident should trigger on 1 failure');
  });

  it('6. consecutive failures reaching threshold triggers OFFLINE and creates Availability Incident', async () => {
    const now = new Date();
    // Ingest failure 2 and failure 3
    for (let i = 2; i <= 3; i++) {
      await MonitoringService.ingestCheckResults({
        agentId: testAgentId,
        agentKey: testAgentKey,
        workspaceId: TEST_WORKSPACE,
        results: [
          {
            assetId: testAssetId,
            checkedAt: new Date(now.getTime() + i * 1000).toISOString(),
            result: 'TIMEOUT',
            packetsSent: 3,
            packetsReceived: 0,
            packetLossPercent: 100,
            provider: 'REAL_AGENT',
          },
        ],
      });
    }

    const state = await prisma.assetAvailabilityState.findUnique({ where: { assetId: testAssetId } });
    assert.equal(state?.consecutiveFailures, 3);
    assert.equal(state?.currentStatus, 'OFFLINE');

    const incidents = await prisma.availabilityIncident.findMany({
      where: { assetId: testAssetId, status: 'TRIGGERED' },
    });
    assert.equal(incidents.length, 1, 'Exactly one availability incident must be triggered');
    assert.equal(incidents[0].severity, 'P1_CRITICAL'); // Derived from TIER_1_CRITICAL asset
  });

  it('7. repeated failures during uninterrupted outage update existing incident without creating duplicates', async () => {
    const now = new Date();
    await MonitoringService.ingestCheckResults({
      agentId: testAgentId,
      agentKey: testAgentKey,
      workspaceId: TEST_WORKSPACE,
      results: [
        {
          assetId: testAssetId,
          checkedAt: new Date(now.getTime() + 10_000).toISOString(),
          result: 'TIMEOUT',
          packetsSent: 3,
          packetsReceived: 0,
          packetLossPercent: 100,
          provider: 'REAL_AGENT',
        },
      ],
    });

    const incidents = await prisma.availabilityIncident.findMany({
      where: { assetId: testAssetId, status: 'TRIGGERED' },
    });
    assert.equal(incidents.length, 1, 'Must not create duplicate incident for same outage');
  });

  it('8. consecutive successes reaching recovery threshold recovers the incident', async () => {
    const now = new Date();
    // Ingest 2 consecutive successes (recoveryThreshold = 2)
    for (let i = 1; i <= 2; i++) {
      await MonitoringService.ingestCheckResults({
        agentId: testAgentId,
        agentKey: testAgentKey,
        workspaceId: TEST_WORKSPACE,
        results: [
          {
            assetId: testAssetId,
            checkedAt: new Date(now.getTime() + i * 1000).toISOString(),
            result: 'SUCCESS',
            averageLatencyMs: 3.5,
            packetsSent: 3,
            packetsReceived: 3,
            packetLossPercent: 0,
            provider: 'REAL_AGENT',
          },
        ],
      });
    }

    const state = await prisma.assetAvailabilityState.findUnique({ where: { assetId: testAssetId } });
    assert.equal(state?.currentStatus, 'ONLINE');
    assert.equal(state?.consecutiveSuccesses, 2);

    const activeIncidents = await prisma.availabilityIncident.findMany({
      where: { assetId: testAssetId, status: 'TRIGGERED' },
    });
    assert.equal(activeIncidents.length, 0, 'No active triggered incidents remain');

    const recovered = await prisma.availabilityIncident.findFirst({
      where: { assetId: testAssetId, status: 'RECOVERED' },
    });
    assert.ok(recovered, 'Incident must be marked RECOVERED');
    assert.ok(recovered?.outageDurationSeconds != null);
  });

  it('9. maintenance window suppresses availability state and alerts', async () => {
    const futureDate = new Date(Date.now() + 3600_000).toISOString();
    await MonitoringService.upsertConfig({
      assetId: testAssetId,
      agentId: testAgentId,
      enabled: true,
      targetIp: '192.168.10.50',
      maintenanceUntil: futureDate,
    }, TEST_WORKSPACE);

    // Ingest timeout during maintenance
    await MonitoringService.ingestCheckResults({
      agentId: testAgentId,
      agentKey: testAgentKey,
      workspaceId: TEST_WORKSPACE,
      results: [
        {
          assetId: testAssetId,
          checkedAt: new Date().toISOString(),
          result: 'TIMEOUT',
          packetsSent: 3,
          packetsReceived: 0,
          packetLossPercent: 100,
          provider: 'REAL_AGENT',
        },
      ],
    });

    const state = await prisma.assetAvailabilityState.findUnique({ where: { assetId: testAssetId } });
    assert.equal(state?.currentStatus, 'MAINTENANCE');
    assert.equal(state?.isSuppressed, true);
  });

  it('10. simulated monitoring provider runs cycles with clear simulation tag', async () => {
    // Clear maintenance first
    await MonitoringService.upsertConfig({
      assetId: testAssetId,
      agentId: testAgentId,
      enabled: true,
      targetIp: '192.168.10.50',
      maintenanceUntil: null,
      suppressAlerts: false,
    }, TEST_WORKSPACE);

    const simResult = await SimulatedMonitoringProvider.runSimulationCycle({
      workspaceId: TEST_WORKSPACE,
      assetIds: [testAssetId],
      mode: 'HEALTHY',
    });

    assert.equal(simResult.success, true);
    assert.equal(simResult.ingestedCount, 1);

    const latestCheck = await prisma.monitoringCheckResult.findFirst({
      where: { assetId: testAssetId },
      orderBy: { receivedAt: 'desc' },
    });

    assert.equal(latestCheck?.provider, 'SIMULATION');
  });

  it('11. stale agent heartbeat transitions asset state to UNKNOWN', async () => {
    // Force agent lastHeartbeat to 4 minutes ago
    await prisma.monitoringAgent.update({
      where: { id: testAgentId },
      data: { lastHeartbeat: new Date(Date.now() - 240_000), status: 'ACTIVE' },
    });

    const affected = await MonitoringService.detectStaleAgents(TEST_WORKSPACE);
    assert.ok(affected >= 1, 'Should affect at least 1 asset');

    const state = await prisma.assetAvailabilityState.findUnique({ where: { assetId: testAssetId } });
    assert.equal(state?.currentStatus, 'UNKNOWN');
    assert.ok(state?.transitionReason?.includes('heartbeat timeout'));
  });

  it('12. unauthorized agent cannot submit results for foreign workspace', async () => {
    const FOREIGN_WS = 'ws-foreign-123';
    await assert.rejects(
      MonitoringService.ingestCheckResults({
        agentId: testAgentId,
        agentKey: testAgentKey,
        workspaceId: FOREIGN_WS,
        results: [
          {
            assetId: testAssetId,
            checkedAt: new Date().toISOString(),
            result: 'SUCCESS',
            packetsSent: 3,
            packetsReceived: 3,
            packetLossPercent: 0,
            provider: 'REAL_AGENT',
          },
        ],
      }),
      /does not belong to the specified workspace/
    );
  });
});
