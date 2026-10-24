// src/types/knowledgeBase.ts

export type ArticleStatus = 'DRAFT' | 'VERIFIED' | 'REJECTED' | 'ARCHIVED';

export type ConfidenceBasis = 'USER_CONFIRMED' | 'ADMIN_VERIFIED' | 'IMPORTED';

export type ArticleOutcome = 'ACCEPTED' | 'PARTIALLY_USEFUL' | 'UNSUCCESSFUL';

export interface DiagnosticStepItem {
  id?: string;
  title: string;
  command: string;
  purpose: string;
  expectedResult: string;
  riskRating?: 'SAFE_READ_ONLY' | 'ELEVATED_AUDIT_WARNING';
  toolName?: string;
}

export interface KnowledgeArticleDTO {
  id: string;
  workspaceId: string;
  title: string;
  normalizedError: string;
  originalErrorDescription: string;
  errorCode?: string | null;
  category: string;
  assetType?: string | null;
  operatingSystem?: string | null;
  productOrService?: string | null;
  environmentNotes?: string | null;
  symptoms: string[];
  diagnosticSteps: DiagnosticStepItem[];
  verifiedSolution: string;
  preventionNotes?: string | null;
  status: ArticleStatus;
  confidenceBasis: ConfidenceBasis;
  successCount: number;
  failureCount: number;
  successRate?: number | null;
  createdBy: string;
  verifiedBy?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  linkedIncidentCount?: number;
}

export interface SearchMatchResult {
  article: KnowledgeArticleDTO;
  score: number;
  confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW';
  matchReasons: string[];
  isCompatible: boolean;
  compatibilityDetails: {
    assetTypeMatch: boolean;
    osMatch: boolean;
    errorCodeMatch: boolean;
  };
}

export interface LocalSearchResponse {
  hasMatch: boolean;
  confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW';
  topMatch: SearchMatchResult | null;
  candidateMatches: SearchMatchResult[];
  explanation: string;
  suggestedAction: 'PRESENT_LOCAL_SOLUTION' | 'CONFIRM_CANDIDATE' | 'ESCALATE_TO_GEMINI';
}

export interface SaveSolutionInput {
  incidentId: string;
  workspaceId?: string;
  title: string;
  originalErrorDescription: string;
  errorCode?: string | null;
  category: string;
  assetType?: string | null;
  operatingSystem?: string | null;
  productOrService?: string | null;
  environmentNotes?: string | null;
  symptoms: string[];
  diagnosticSteps: DiagnosticStepItem[];
  verifiedSolution: string;
  preventionNotes?: string | null;
  status?: ArticleStatus;
  confidenceBasis?: ConfidenceBasis;
  createdBy?: string;
}

export interface DuplicateDetectionResult {
  hasDuplicate: boolean;
  similarityScore: number;
  matchedArticle: KnowledgeArticleDTO | null;
  recommendation: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'WARN_DUPLICATE';
  reason: string;
}
