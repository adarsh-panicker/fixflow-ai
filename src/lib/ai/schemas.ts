// src/lib/ai/schemas.ts
import { z } from 'zod';
import {
  INCIDENT_SEVERITIES,
  STEP_OUTCOMES,
  SAFETY_CLASSIFICATIONS,
  HYPOTHESIS_STATUSES,
} from '@/lib/validation/engineSchemas';

// 1. AI Free-Text Intake Analysis Schema
export const AiIntakeAnalysisSchema = z.object({
  problemSummary: z.string().min(5).max(300),
  category: z.string().min(2).max(50),
  severity: z.enum(INCIDENT_SEVERITIES),
  needsClarification: z.boolean(),
  clarifyingQuestion: z.string().optional().nullable(),
  suggestedAssetTags: z.array(z.string()).default([]),
  suspectedFailureDomain: z.string().min(2),
  initialHypotheses: z
    .array(
      z.object({
        title: z.string().min(3).max(120),
        description: z.string().min(10).max(300),
        initialConfidence: z.number().min(0.05).max(0.95),
      })
    )
    .min(1)
    .max(5),
});

// 2. AI Next Step & Hypothesis Revision Schema
export const AiNextStepProposalSchema = z.object({
  observationInterpretation: z.string().min(5).max(500),
  interpretedOutcome: z.enum(STEP_OUTCOMES),
  hypothesisUpdates: z.array(
    z.object({
      hypothesisId: z.string(),
      delta: z.number().min(-1.0).max(1.0),
      rationale: z.string().min(5).max(300),
      newStatus: z.enum(HYPOTHESIS_STATUSES).optional(),
    })
  ),
  contradictionDetected: z.boolean().default(false),
  contradictionRationale: z.string().optional().nullable(),
  isDiagnosisReached: z.boolean(),
  proposedNextStep: z
    .object({
      title: z.string().min(3).max(120),
      toolName: z.string().min(2).max(50),
      command: z.string().min(2).max(500),
      purpose: z.string().min(5).max(300),
      expectedResult: z.string().min(5).max(300),
      safetyClassification: z.enum(SAFETY_CLASSIFICATIONS).default('SAFE_READ_ONLY'),
    })
    .optional()
    .nullable(),
  terminalConclusion: z
    .object({
      rootCause: z.string().min(5).max(300),
      recommendedFixes: z.array(
        z.object({
          action: z.string().min(5).max(250),
          owner: z.string().default('Systems Administration'),
          priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
          remediationType: z.enum(['IMMEDIATE_FIX', 'PREVENTIVE_MEASURE', 'MONITORING_UPDATE']).default('IMMEDIATE_FIX'),
        })
      ),
    })
    .optional()
    .nullable(),
});

// 3. AI Plain-English Step Explanation Schema
export const AiStepExplanationSchema = z.object({
  stepTitle: z.string().min(3),
  plainEnglishPurpose: z.string().min(10).max(400),
  whyThisTestMatters: z.string().min(10).max(400),
  whatToLookForInOutput: z.string().min(10).max(400),
  safetyAssurance: z.string().min(5).max(300),
});

// 4. AI Post-Mortem Report Summarization Schema
export const AiReportSummarySchema = z.object({
  executiveSummary: z.string().min(20).max(1000),
  confirmedRootCause: z.string().min(10).max(400),
  fiveWhys: z
    .array(
      z.object({
        whyNumber: z.number().int().min(1).max(5),
        question: z.string().min(5).max(200),
        answer: z.string().min(5).max(300),
      })
    )
    .min(3)
    .max(5),
  verifiedFixes: z.array(
    z.object({
      action: z.string().min(5).max(250),
      owner: z.string().min(2).max(100),
      priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
      remediationType: z.enum(['IMMEDIATE_FIX', 'PREVENTIVE_MEASURE', 'MONITORING_UPDATE']).default('IMMEDIATE_FIX'),
    })
  ),
  unverifiedRecommendations: z.array(
    z.object({
      action: z.string().min(5).max(250),
      owner: z.string().min(2).max(100),
      priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
      remediationType: z.enum(['IMMEDIATE_FIX', 'PREVENTIVE_MEASURE', 'MONITORING_UPDATE']).default('PREVENTIVE_MEASURE'),
    })
  ),
  technicalEvidenceSummary: z.string().min(10).max(1000),
});

export type AiIntakeAnalysis = z.infer<typeof AiIntakeAnalysisSchema>;
export type AiNextStepProposal = z.infer<typeof AiNextStepProposalSchema>;
export type AiStepExplanation = z.infer<typeof AiStepExplanationSchema>;
export type AiReportSummary = z.infer<typeof AiReportSummarySchema>;
