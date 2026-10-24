// src/lib/validation/engineSchemas.ts
import { z } from 'zod';

export const INCIDENT_SEVERITIES = [
  'P1_CRITICAL',
  'P2_HIGH',
  'P3_MEDIUM',
  'P4_LOW',
] as const;

export const INCIDENT_STATUSES = [
  'OPEN',
  'TRIAGED',
  'INVESTIGATING',
  'ROOT_CAUSE_IDENTIFIED',
  'RESOLVED',
  'CLOSED',
] as const;

export const DIAGNOSTIC_MODES = ['GUIDED', 'AGENT'] as const;

export const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;

export const STEP_OUTCOMES = [
  'PASSED',
  'FAILED',
  'INCONCLUSIVE',
  'NOT_TESTED',
  'SKIPPED',
] as const;

export const SAFETY_CLASSIFICATIONS = [
  'SAFE_READ_ONLY',
  'CLARIFYING_QUESTION',
  'ELEVATED_AUDIT_WARNING',
  'SIMULATED_DEMO',
] as const;

export const EVIDENCE_POLARITIES = ['SUPPORTING', 'REFUTING', 'NEUTRAL'] as const;

export const HYPOTHESIS_STATUSES = [
  'CANDIDATE',
  'INVESTIGATING',
  'CONFIRMED',
  'REFUTED',
  'CONTRADICTORY',
] as const;

export const SESSION_STATUSES = [
  'ACTIVE',
  'COMPLETED',
  'ESCALATED',
  'STOPPED',
  'INVESTIGATING',
  'ROOT_CAUSE_IDENTIFIED',
  'RESOLVED',
] as const;

export const AUDIT_EVENT_TYPES = [
  'SESSION_STARTED',
  'STEP_RECOMMENDED',
  'STEP_EXECUTED',
  'EVIDENCE_RECORDED',
  'HYPOTHESIS_UPDATED',
  'BRANCH_SWITCHED',
  'CONTRADICTION_DETECTED',
  'SESSION_STOPPED',
  'SESSION_ESCALATED',
  'REPORT_GENERATED',
] as const;

// 1. Incident Asset Role Schema
export const IncidentAssetSchema = z.object({
  id: z.string().optional(),
  incidentId: z.string(),
  assetId: z.string(),
  role: z.enum(['primary_affected', 'upstream_dependency', 'downstream_impacted']).default('primary_affected'),
});

// 2. Diagnostic Step Schema
export const DiagnosticStepSchema = z.object({
  id: z.string(),
  stepId: z.string(),
  title: z.string().min(1),
  question: z.string().optional(),
  toolName: z.string().default('manual_probe'),
  command: z.string().default(''),
  purpose: z.string().min(1),
  expectedResult: z.string().min(1),
  expectedOutput: z.string().optional(),
  possibleOutcomes: z.array(z.enum(STEP_OUTCOMES)).default(['PASSED', 'FAILED', 'INCONCLUSIVE', 'NOT_TESTED']),
  safetyClassification: z.enum(SAFETY_CLASSIFICATIONS).default('SAFE_READ_ONLY'),
  riskRating: z.enum(['SAFE_READ_ONLY', 'ELEVATED_AUDIT_WARNING']).default('SAFE_READ_ONLY'),
  requiresApproval: z.boolean().default(false),
  rollbackInstructions: z.string().optional().nullable(),
  outcome: z.enum(STEP_OUTCOMES).default('NOT_TESTED'),
  observedOutput: z.string().optional().nullable(),
  technicianNotes: z.string().optional().nullable(),
  executedAt: z.string().optional().nullable(),
  orderIndex: z.number().default(0),
  isClarifyingQuestion: z.boolean().default(false),
  isSimulatedDemo: z.boolean().default(false),
});

// 3. Evidence Schema
export const EvidenceSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  stepId: z.string().optional().nullable(),
  summary: z.string().min(1),
  rawOutput: z.string().optional().nullable(),
  polarity: z.enum(EVIDENCE_POLARITIES).default('NEUTRAL'),
  technicianNotes: z.string().optional().nullable(),
  hypothesisIds: z.array(z.string()).default([]),
  confidenceImpact: z.number().default(0),
  isContradictory: z.boolean().default(false),
  recordedAt: z.string(),
});

// 4. Hypothesis Schema
export const HypothesisSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  title: z.string().min(1),
  description: z.string(),
  confidenceScore: z.number().min(0).max(1).default(0.5),
  status: z.enum(HYPOTHESIS_STATUSES).default('CANDIDATE'),
  supportingEvidenceIds: z.array(z.string()).default([]),
  refutingEvidenceIds: z.array(z.string()).default([]),
  updatedAt: z.string(),
});

// 5. Plan Revision Schema for Agent Mode
export const PlanRevisionSchema = z.object({
  id: z.string(),
  cycleNumber: z.number().default(1),
  triggerStepId: z.string(),
  triggerOutcome: z.enum(STEP_OUTCOMES),
  reasoning: z.string().min(1),
  stepsAdded: z.array(z.string()).default([]),
  stepsPruned: z.array(z.string()).default([]),
  timestamp: z.string(),
});

// 6. Diagnostic Session Schema
export const DiagnosticSessionSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  scenarioId: z.string().optional().nullable(),
  currentStepId: z.string().optional().nullable(),
  currentStepIndex: z.number().default(0),
  status: z.enum(SESSION_STATUSES).default('ACTIVE'),
  mode: z.enum(DIAGNOSTIC_MODES).default('GUIDED'),
  totalStepsExecuted: z.number().default(0),
  sessionBudgetMax: z.number().default(12),
  planningCycleMax: z.number().default(6),
  stopReason: z.string().optional().nullable(),
  steps: z.array(DiagnosticStepSchema).default([]),
  proposedPlan: z.array(DiagnosticStepSchema).default([]),
  planRevisions: z.array(PlanRevisionSchema).default([]),
  evidence: z.array(EvidenceSchema).default([]),
  hypotheses: z.array(HypothesisSchema).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// 6. Action Item Schema
export const ActionItemSchema = z.object({
  id: z.string(),
  incidentId: z.string().optional(),
  action: z.string().min(1),
  owner: z.string().default('Incident Response Team'),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  isVerified: z.boolean().default(false),
  targetAssetTag: z.string().optional().nullable(),
  remediationType: z.enum(['IMMEDIATE_FIX', 'PREVENTIVE_MEASURE', 'MONITORING_UPDATE']).default('IMMEDIATE_FIX'),
});

// 7. Audit Event Schema
export const AuditEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  incidentId: z.string().optional().nullable(),
  timestamp: z.string(),
  eventType: z.enum(AUDIT_EVENT_TYPES),
  actor: z.enum(['USER', 'DIAGNOSTIC_ENGINE', 'ADMIN']).default('USER'),
  details: z.string(),
  metadata: z.record(z.any()).optional().nullable(),
});

// 8. Resolution Report Schema
export const ResolutionReportSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  executiveSummary: z.string().min(1),
  confirmedRootCause: z.string().min(1),
  fiveWhys: z.array(
    z.object({
      whyNumber: z.number(),
      question: z.string(),
      answer: z.string(),
    })
  ).default([]),
  verifiedFixes: z.array(ActionItemSchema).default([]),
  unverifiedRecommendations: z.array(ActionItemSchema).default([]),
  signOffOperator: z.string().default('Lead Incident Technician'),
  evidenceSummary: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'ARCHIVED']).default('CONFIRMED'),
  generatedAt: z.string(),
  updatedAt: z.string(),
});

// 9. Full Incident Schema
export const IncidentSchema = z.object({
  id: z.string(),
  workspaceId: z.string().default('ws-default'),
  ticketNumber: z.string(),
  title: z.string().min(2),
  rawDescription: z.string().min(5),
  category: z.string(),
  severity: z.enum(INCIDENT_SEVERITIES).default('P3_MEDIUM'),
  status: z.enum(INCIDENT_STATUSES).default('OPEN'),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).default('Intermediate'),
  diagnosticMode: z.enum(DIAGNOSTIC_MODES).default('GUIDED'),
  targetAssetId: z.string().optional().nullable(),
  resolutionNotes: z.string().optional().nullable(),
  isDemo: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
  involvedAssets: z.array(IncidentAssetSchema).default([]),
  session: DiagnosticSessionSchema.optional().nullable(),
  report: ResolutionReportSchema.optional().nullable(),
});

// Types inferred from Zod schemas
export type Incident = z.infer<typeof IncidentSchema>;
export type IncidentAsset = z.infer<typeof IncidentAssetSchema>;
export type DiagnosticStep = z.infer<typeof DiagnosticStepSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type PlanRevision = z.infer<typeof PlanRevisionSchema>;
export type DiagnosticSession = z.infer<typeof DiagnosticSessionSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type ResolutionReport = z.infer<typeof ResolutionReportSchema>;

export type IncidentSeverity = z.infer<typeof IncidentSchema>['severity'];
export type IncidentStatus = z.infer<typeof IncidentSchema>['status'];
export type DiagnosticMode = z.infer<typeof IncidentSchema>['diagnosticMode'];
export type StepOutcome = z.infer<typeof DiagnosticStepSchema>['outcome'];
export type SafetyClassification = z.infer<typeof DiagnosticStepSchema>['safetyClassification'];
export type EvidencePolarity = z.infer<typeof EvidenceSchema>['polarity'];
export type HypothesisStatus = z.infer<typeof HypothesisSchema>['status'];
export type SessionStatus = z.infer<typeof DiagnosticSessionSchema>['status'];
export type AuditEventType = z.infer<typeof AuditEventSchema>['eventType'];
