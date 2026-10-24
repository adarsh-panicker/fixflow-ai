// src/types/monitoring.ts

export type AvailabilityStatus =
  | 'ONLINE'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'UNKNOWN'
  | 'MAINTENANCE'
  | 'ICMP_UNRESPONSIVE';

export type CheckResultType =
  | 'SUCCESS'
  | 'TIMEOUT'
  | 'UNREACHABLE'
  | 'ERROR'
  | 'UNSUPPORTED';

export type MonitoringProvider = 'REAL_AGENT' | 'SIMULATION';

export type AgentStatus = 'ACTIVE' | 'REVOKED' | 'DISCONNECTED' | 'PAUSED';

export type AvailabilityIncidentStatus =
  | 'TRIGGERED'
  | 'ACKNOWLEDGED'
  | 'RECOVERED'
  | 'CLOSED';

export type MonitoringAuditEventType =
  | 'AGENT_REGISTERED'
  | 'AGENT_HEARTBEAT'
  | 'AGENT_REVOKED'
  | 'AGENT_STALE_DETECTED'
  | 'CONFIG_UPDATED'
  | 'STATE_TRANSITION'
  | 'INCIDENT_TRIGGERED'
  | 'INCIDENT_ACKNOWLEDGED'
  | 'INCIDENT_RECOVERED'
  | 'SIMULATION_CYCLE';

export interface MonitoringAgentDTO {
  id: string;
  workspaceId: string;
  name: string;
  hostname?: string | null;
  ipAddress?: string | null;
  platform: string;
  version: string;
  status: AgentStatus;
  lastHeartbeat?: string | null;
  registeredAt: string;
  updatedAt: string;
  assignedAssetCount?: number;
}

export interface AssetMonitoringConfigDTO {
  id: string;
  workspaceId: string;
  assetId: string;
  agentId?: string | null;
  enabled: boolean;
  targetIp: string;
  targetHostname?: string | null;
  addressFamily: 'IPv4' | 'IPv6';
  pollingIntervalSeconds: number;
  timeoutSeconds: number;
  packetCount: number;
  failureThreshold: number;
  recoveryThreshold: number;
  latencyWarningMs?: number | null;
  packetLossWarningPercent?: number | null;
  maintenanceUntil?: string | null;
  suppressAlerts: boolean;
  createdAt: string;
  updatedAt: string;
  agentName?: string;
  assetTag?: string;
  assetName?: string;
}

export interface AssetAvailabilityStateDTO {
  id: string;
  workspaceId: string;
  assetId: string;
  currentStatus: AvailabilityStatus;
  lastObservedState?: CheckResultType | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckTime?: string | null;
  lastSuccessfulResponse?: string | null;
  lastStateTransition: string;
  transitionReason?: string | null;
  latestLatencyMs?: number | null;
  latestPacketLoss?: number | null;
  isSuppressed: boolean;
  updatedAt: string;
}

export interface MonitoringCheckResultDTO {
  id: string;
  workspaceId: string;
  assetId: string;
  agentId?: string | null;
  checkedAt: string;
  receivedAt: string;
  result: CheckResultType;
  averageLatencyMs?: number | null;
  minLatencyMs?: number | null;
  maxLatencyMs?: number | null;
  packetsSent: number;
  packetsReceived: number;
  packetLossPercent: number;
  errorCode?: string | null;
  provider: MonitoringProvider;
}

export interface AvailabilityIncidentDTO {
  id: string;
  workspaceId: string;
  assetId: string;
  assetTag?: string;
  assetName?: string;
  assetType?: string;
  title: string;
  status: AvailabilityIncidentStatus;
  severity: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';
  firstFailureAt: string;
  thresholdCrossedAt: string;
  latestFailureAt: string;
  recoveredAt?: string | null;
  outageDurationSeconds?: number | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  failureSummary: string;
  recoverySummary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringDashboardSummary {
  totalMonitoredAssets: number;
  onlineAssets: number;
  degradedAssets: number;
  offlineAssets: number;
  unknownAssets: number;
  maintenanceAssets: number;
  connectedAgents: number;
  disconnectedAgents: number;
  activeIncidentsCount: number;
  recentIncidents: AvailabilityIncidentDTO[];
  recentRecoveries: AvailabilityIncidentDTO[];
  averageLatencyMs: number | null;
  averagePacketLossPercent: number | null;
  providerBreakdown: {
    realAgentCount: number;
    simulationCount: number;
  };
}

export interface MonitoredAssetRowDTO {
  assetId: string;
  assetTag: string;
  assetName: string;
  assetType: string;
  criticality: string;
  targetIp: string;
  targetHostname?: string | null;
  status: AvailabilityStatus;
  lastObservedState?: CheckResultType | null;
  latestLatencyMs?: number | null;
  latestPacketLoss?: number | null;
  lastSuccessfulResponse?: string | null;
  lastCheckTime?: string | null;
  statusDurationSeconds: number;
  agentId?: string | null;
  agentName?: string | null;
  configEnabled: boolean;
  consecutiveFailures: number;
  activeIncidentId?: string | null;
}
