// src/lib/validation/knowledgeBaseSchemas.ts
import { z } from 'zod';

export const DiagnosticStepItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2).max(200),
  command: z.string().min(1).max(1000),
  purpose: z.string().min(2).max(500),
  expectedResult: z.string().min(2).max(500),
  riskRating: z.enum(['SAFE_READ_ONLY', 'ELEVATED_AUDIT_WARNING']).default('SAFE_READ_ONLY'),
  toolName: z.string().max(100).optional(),
});

export const KnowledgeArticleCreateSchema = z.object({
  workspaceId: z.string().min(1).default('ws-default'),
  title: z.string().min(3).max(200),
  originalErrorDescription: z.string().min(5).max(3000),
  errorCode: z.string().max(100).nullable().optional(),
  category: z.enum([
    'INFRASTRUCTURE',
    'NETWORK',
    'HARDWARE',
    'STORAGE',
    'APPLICATION',
    'SECURITY',
    'DATABASE',
    'OTHER',
  ]).default('INFRASTRUCTURE'),
  assetType: z.string().max(50).nullable().optional(),
  operatingSystem: z.string().max(100).nullable().optional(),
  productOrService: z.string().max(100).nullable().optional(),
  environmentNotes: z.string().max(1000).nullable().optional(),
  symptoms: z.array(z.string().min(1).max(500)).min(1),
  diagnosticSteps: z.array(DiagnosticStepItemSchema).default([]),
  verifiedSolution: z.string().min(10).max(5000),
  preventionNotes: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'VERIFIED', 'REJECTED', 'ARCHIVED']).default('DRAFT'),
  confidenceBasis: z.enum(['USER_CONFIRMED', 'ADMIN_VERIFIED', 'IMPORTED']).default('USER_CONFIRMED'),
  createdBy: z.string().min(1).max(100).default('Lead Incident Technician'),
  verifiedBy: z.string().max(100).nullable().optional(),
});

export const KnowledgeArticleUpdateSchema = KnowledgeArticleCreateSchema.partial();

export const KnowledgeSearchQuerySchema = z.object({
  query: z.string().min(1).max(500).optional(),
  errorInput: z.string().min(1).max(500).optional(),
  errorCode: z.string().max(100).optional(),
  category: z.string().optional(),
  assetType: z.string().optional(),
  operatingSystem: z.string().optional(),
  workspaceId: z.string().default('ws-default'),
  minThreshold: z.number().min(0).max(100).default(45),
  verifiedOnly: z.boolean().default(true),
});

export const KnowledgeArticleOutcomeReportSchema = z.object({
  articleId: z.string().min(1),
  incidentId: z.string().min(1),
  outcome: z.enum(['ACCEPTED', 'PARTIALLY_USEFUL', 'UNSUCCESSFUL']),
  workspaceId: z.string().default('ws-default'),
  technicianNotes: z.string().max(1000).optional(),
});

export const DuplicateCheckQuerySchema = z.object({
  title: z.string().min(3),
  errorCode: z.string().nullable().optional(),
  originalErrorDescription: z.string().min(5),
  symptoms: z.array(z.string()).optional(),
  workspaceId: z.string().default('ws-default'),
});

export const DuplicateDetectionQuerySchema = DuplicateCheckQuerySchema;
