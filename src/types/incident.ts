// src/types/incident.ts
import { Asset } from './asset';
export type { Asset };

export * from '@/lib/validation/engineSchemas';

import {
  Incident as EngineIncident,
  DiagnosticSession as EngineSession,
  DiagnosticStep as EngineStep,
  Evidence as EngineEvidence,
  Hypothesis as EngineHypothesis,
  PlanRevision as EnginePlanRevision,
  ActionItem as EngineActionItem,
} from '@/lib/validation/engineSchemas';

export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced';

// Backward compatible aliases
export type EvidenceRecord = Evidence;
export type HypothesisRecord = Hypothesis;
export type PostMortemReport = ResolutionReport;
export type RemediationAction = ActionItem;
export type PlanRevision = EnginePlanRevision;

export interface FiveWhysItem {
  whyNumber: number;
  question: string;
  answer: string;
}

// DiagnosticStep with flexible properties
export interface DiagnosticStep extends Omit<Partial<EngineStep>, 'id' | 'stepId' | 'title' | 'purpose' | 'outcome' | 'command'> {
  id: string;
  stepId: string;
  title: string;
  purpose: string;
  outcome: EngineStep['outcome'];
  command: string;
  toolName?: string;
  expectedResult?: string;
  expectedOutput?: string;
  riskRating?: 'SAFE_READ_ONLY' | 'ELEVATED_AUDIT_WARNING';
  rollbackInstructions?: string;
}

// Evidence with flexible properties
export interface Evidence extends Omit<Partial<EngineEvidence>, 'id' | 'sessionId' | 'summary' | 'polarity' | 'recordedAt'> {
  id: string;
  sessionId: string;
  summary: string;
  polarity: EngineEvidence['polarity'];
  recordedAt: string;
}

// Hypothesis with flexible properties
export interface Hypothesis extends Omit<Partial<EngineHypothesis>, 'id' | 'sessionId' | 'title' | 'description' | 'confidenceScore' | 'status' | 'updatedAt'> {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  confidenceScore: number;
  status: EngineHypothesis['status'];
  updatedAt: string;
}

// ActionItem with flexible properties
export interface ActionItem extends Omit<Partial<EngineActionItem>, 'id' | 'action' | 'owner'> {
  id: string;
  action: string;
  owner: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  remediationType?: 'IMMEDIATE_FIX' | 'PREVENTIVE_MEASURE' | 'MONITORING_UPDATE';
  isVerified?: boolean;
  targetAssetTag?: string;
}

// ResolutionReport with defined non-nullable arrays
export interface ResolutionReport {
  id: string;
  incidentId: string;
  executiveSummary: string;
  confirmedRootCause: string;
  fiveWhys: FiveWhysItem[];
  verifiedFixes: ActionItem[];
  unverifiedRecommendations: ActionItem[];
  signOffOperator: string;
  evidenceSummary?: string;
  status?: any;
  generatedAt: string;
  updatedAt: string;
}

// DiagnosticSession with flexible sessionStatus
export interface DiagnosticSession extends Omit<EngineSession, 'steps' | 'hypotheses' | 'evidence' | 'status' | 'proposedPlan' | 'planRevisions' | 'planningCycleMax'> {
  steps: DiagnosticStep[];
  proposedPlan?: DiagnosticStep[];
  planRevisions?: PlanRevision[];
  evidence: Evidence[];
  hypotheses: Hypothesis[];
  status?: any;
  sessionStatus?: any;
  planningCycleMax?: number;
}

// Augmented Incident with optional populated targetAsset
export interface Incident extends Omit<EngineIncident, 'involvedAssets' | 'session' | 'report' | 'workspaceId' | 'isDemo'> {
  workspaceId?: string;
  isDemo?: boolean;
  targetAsset?: Asset;
  involvedAssets?: any[];
  session?: DiagnosticSession;
  report?: ResolutionReport;
  appliedArticleId?: string | null;
  articleOutcome?: string | null;
}
