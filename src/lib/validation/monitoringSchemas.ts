// src/lib/validation/monitoringSchemas.ts
import { z } from 'zod';

const IPV4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

export const SafeIpSchema = z.string().trim().refine(
  val => IPV4_REGEX.test(val) || IPV6_REGEX.test(val),
  { message: 'Target IP must be a valid IPv4 or IPv6 address without shell metacharacters.' }
);

export const MonitoringAgentRegisterSchema = z.object({
  name: z.string().min(2).max(100),
  hostname: z.string().max(255).optional(),
  ipAddress: SafeIpSchema.optional(),
  platform: z.enum(['win32', 'linux', 'darwin']).default('win32'),
  version: z.string().min(1).max(20).default('1.0.0'),
  workspaceId: z.string().min(1).default('ws-default'),
});

export const MonitoringAgentHeartbeatSchema = z.object({
  agentId: z.string().min(1),
  agentKey: z.string().min(16),
  version: z.string().max(20).optional(),
  platform: z.string().max(50).optional(),
  activeAssignmentsCount: z.number().int().min(0).optional(),
});

export const MonitoringConfigUpsertSchema = z.object({
  assetId: z.string().min(1),
  workspaceId: z.string().min(1).default('ws-default'),
  agentId: z.string().nullable().optional(),
  enabled: z.boolean().default(true),
  targetIp: SafeIpSchema,
  targetHostname: z.string().max(255).nullable().optional(),
  addressFamily: z.enum(['IPv4', 'IPv6']).default('IPv4'),
  pollingIntervalSeconds: z.number().int().min(10).max(3600).default(60),
  timeoutSeconds: z.number().int().min(1).max(10).default(2),
  packetCount: z.number().int().min(1).max(10).default(3),
  failureThreshold: z.number().int().min(1).max(10).default(3),
  recoveryThreshold: z.number().int().min(1).max(10).default(2),
  latencyWarningMs: z.number().min(1).max(10000).nullable().optional(),
  packetLossWarningPercent: z.number().min(1).max(100).nullable().optional(),
  maintenanceUntil: z.string().datetime().nullable().optional(),
  suppressAlerts: z.boolean().default(false),
});

export const SingleCheckResultPayloadSchema = z.object({
  assetId: z.string().min(1),
  checkedAt: z.string().datetime().refine(val => {
    const checkTime = new Date(val).getTime();
    const now = Date.now();
    // Allow up to 60 seconds in the future (clock skew) and up to 24 hours in the past
    return checkTime <= now + 60_000 && checkTime >= now - 86_400_000;
  }, { message: 'checkedAt timestamp must not be in the future or older than 24 hours.' }),
  result: z.enum(['SUCCESS', 'TIMEOUT', 'UNREACHABLE', 'ERROR', 'UNSUPPORTED']),
  averageLatencyMs: z.number().min(0).max(60000).nullable().optional(),
  minLatencyMs: z.number().min(0).max(60000).nullable().optional(),
  maxLatencyMs: z.number().min(0).max(60000).nullable().optional(),
  packetsSent: z.number().int().min(1).max(50),
  packetsReceived: z.number().int().min(0).max(50),
  packetLossPercent: z.number().min(0).max(100),
  errorCode: z.string().max(100).nullable().optional(),
  provider: z.enum(['REAL_AGENT', 'SIMULATION']).default('REAL_AGENT'),
});

export const MonitoringIngestBatchSchema = z.object({
  agentId: z.string().min(1),
  agentKey: z.string().min(16),
  workspaceId: z.string().min(1).default('ws-default'),
  results: z.array(SingleCheckResultPayloadSchema).min(1).max(100),
});

export const AcknowledgeIncidentSchema = z.object({
  incidentId: z.string().min(1),
  acknowledgedBy: z.string().min(1).max(100).default('Lead Incident Technician'),
  notes: z.string().max(500).optional(),
});

export const SimulationTriggerSchema = z.object({
  workspaceId: z.string().default('ws-default'),
  assetIds: z.array(z.string()).optional(),
  mode: z.enum(['HEALTHY', 'DEGRADED_LATENCY', 'PACKET_LOSS', 'OFFLINE_OUTAGE', 'RANDOM_CHAOS']).default('HEALTHY'),
  iterations: z.number().int().min(1).max(5).default(1),
});
