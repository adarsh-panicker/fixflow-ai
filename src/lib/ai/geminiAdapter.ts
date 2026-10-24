// src/lib/ai/geminiAdapter.ts
import { GoogleGenAI } from '@google/genai';
import { getAiConfig } from './config';
import {
  AiIntakeAnalysisSchema,
  AiNextStepProposalSchema,
  AiStepExplanationSchema,
  AiReportSummarySchema,
  AiIntakeAnalysis,
  AiNextStepProposal,
  AiStepExplanation,
  AiReportSummary,
} from './schemas';
import { SafetyValidator } from './safetyValidator';
import { Asset } from '@/types/asset';
import { Incident, DiagnosticSession, DiagnosticStep, StepOutcome } from '@/types/incident';

export interface IntakeAnalysisInput {
  title: string;
  rawDescription: string;
  targetAsset?: Asset | null;
  candidateAssets?: Asset[];
}

export interface NextStepProposalInput {
  incident: Incident;
  session: DiagnosticSession;
  lastExecutedStep: DiagnosticStep;
  outcome: StepOutcome;
  observedOutput: string;
  technicianNotes?: string;
  targetAsset?: Asset | null;
  dependencies?: Asset[];
}

export interface ExplainStepInput {
  step: DiagnosticStep;
  incident: Incident;
  targetAsset?: Asset | null;
}

export interface SummarizeReportInput {
  incident: Incident;
  session: DiagnosticSession;
  targetAsset?: Asset | null;
}

export interface IGeminiProvider {
  isAvailable(): boolean;
  analyzeIncidentIntake(input: IntakeAnalysisInput): Promise<AiIntakeAnalysis>;
  proposeNextStep(input: NextStepProposalInput): Promise<AiNextStepProposal>;
  explainDiagnosticStep(input: ExplainStepInput): Promise<AiStepExplanation>;
  summarizeResolutionReport(input: SummarizeReportInput): Promise<AiReportSummary>;
}

export class AiProviderError extends Error {
  public statusCode: number;
  public isRetryable: boolean;

  constructor(message: string, statusCode: number = 500, isRetryable: boolean = false) {
    super(message);
    this.name = 'AiProviderError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export class GeminiProviderAdapter implements IGeminiProvider {
  private ai: GoogleGenAI | null = null;
  private model: string;
  private timeoutMs: number;
  private maxRetries: number;
  private maxOutputTokens: number;

  constructor() {
    const config = getAiConfig();
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
    this.maxRetries = config.maxRetries;
    this.maxOutputTokens = config.maxOutputTokens;

    if (config.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    }
  }

  public isAvailable(): boolean {
    return Boolean(this.ai);
  }

  /**
   * Helper to execute Gemini requests with bounded timeouts and retries
   */
  private async executeWithRetry<T>(
    prompt: string,
    systemInstruction: string,
    validator: (rawJson: any) => T
  ): Promise<T> {
    if (!this.ai) {
      throw new AiProviderError(
        'Gemini API key is not configured on the server. Please set GEMINI_API_KEY in .env.local.',
        401,
        false
      );
    }

    let lastError: any = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const response = await this.ai.models.generateContent({
            model: this.model,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              maxOutputTokens: this.maxOutputTokens,
              temperature: 0.1, // Low temperature for deterministic, rigorous outputs
            },
          });

          clearTimeout(timeoutId);

          const text = response.text?.trim();
          if (!text) {
            throw new AiProviderError('Empty response received from Gemini API.', 502, true);
          }

          let parsedJson: any;
          try {
            parsedJson = JSON.parse(text);
          } catch (jsonErr: any) {
            throw new AiProviderError(`Malformed JSON returned by Gemini: ${jsonErr.message}`, 422, false);
          }

          return validator(parsedJson);
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
            throw new AiProviderError(`Gemini request timed out after ${this.timeoutMs}ms.`, 504, true);
          }
          throw fetchErr;
        }
      } catch (err: any) {
        lastError = err;
        const status = err.status || err.statusCode || 500;
        const isRateLimit = status === 429 || err.message?.includes('429') || err.message?.includes('quota');
        const isServerUnavailable = status >= 500 && status < 600;

        if ((isRateLimit || isServerUnavailable) && attempt < this.maxRetries) {
          // Bounded exponential backoff: 500ms, 1500ms
          const backoffMs = (attempt + 1) * 750;
          await new Promise(res => setTimeout(res, backoffMs));
          continue;
        }

        break;
      }
    }

    throw new AiProviderError(
      lastError?.message || 'Failed to complete request to Gemini API after bounded retries.',
      lastError?.statusCode || 500,
      false
    );
  }

  /**
   * 1. Interpret Free-Text IT Problem & Suggest Registered Assets
   */
  public async analyzeIncidentIntake(input: IntakeAnalysisInput): Promise<AiIntakeAnalysis> {
    const candidateSummary = (input.candidateAssets || [])
      .slice(0, 15) // Context minimization: only candidate assets passed
      .map(a => `[Tag: ${a.assetTag}] Type: ${a.assetType}, Name: ${a.name}, IP: ${a.ipAddress || 'None'}, Host: ${a.hostname || 'None'}`)
      .join('\n');

    const systemInstruction = `You are FixFlow AI's incident triage intelligence engineer.
Analyze the user's free-text problem description.
Produce a strict JSON object matching this schema:
{
  "problemSummary": "concise 1-2 sentence problem summary",
  "category": "INFRASTRUCTURE | NETWORK | HARDWARE | STORAGE | APPLICATION | SECURITY",
  "severity": "P1_CRITICAL | P2_HIGH | P3_MEDIUM | P4_LOW",
  "needsClarification": boolean,
  "clarifyingQuestion": "question to technician if vague or ambiguous, else null",
  "suggestedAssetTags": ["exact tags from candidate list that relate to this issue"],
  "suspectedFailureDomain": "e.g. Network Layer 3 routing, DNS resolution, NTFS ACL permissions",
  "initialHypotheses": [
    {
      "title": "Clear hypothesis title",
      "description": "Specific failure mechanism description",
      "initialConfidence": 0.45
    }
  ]
}
RULES:
1. ONLY suggest asset tags that appear in the provided Candidate Assets list. Never fabricate asset tags.
2. If the problem is missing critical details, set needsClarification to true and formulate a clarifying question.
3. Keep initialConfidence scores between 0.10 and 0.60. Never claim 1.0 confidence.`;

    const prompt = `INCIDENT REPORT:
Title: ${input.title}
Description: ${input.rawDescription}

CANDIDATE REGISTERED ASSETS (Workspace scope):
${candidateSummary || 'No candidate assets provided.'}

Analyze the incident and respond with structured JSON.`;

    return this.executeWithRetry(prompt, systemInstruction, rawJson => {
      const validated = AiIntakeAnalysisSchema.parse(rawJson);

      // Validate suggested asset tags against candidates
      if (input.candidateAssets && input.candidateAssets.length > 0) {
        const knownTags = input.candidateAssets.map(a => a.assetTag);
        const { validTags } = SafetyValidator.validateAssetTags(validated.suggestedAssetTags, knownTags);
        validated.suggestedAssetTags = validTags;
      }

      return validated;
    });
  }

  /**
   * 2. Interpret User-Submitted Diagnostic Result, Revise Hypotheses & Propose Next Step
   */
  public async proposeNextStep(input: NextStepProposalInput): Promise<AiNextStepProposal> {
    // Context Minimization: Send only recent 5 evidence items
    const recentEvidence = input.session.evidence
      .slice(0, 5)
      .map(e => `[${e.polarity}] Test: ${e.summary} | Output: ${e.rawOutput || 'None'}`)
      .join('\n');

    const hypothesesList = input.session.hypotheses
      .map(h => `[ID: ${h.id}] "${h.title}" (Confidence: ${h.confidenceScore}, Status: ${h.status})`)
      .join('\n');

    const systemInstruction = `You are FixFlow AI's diagnostic planning engineer.
Evaluate the user's manual observation from step "${input.lastExecutedStep.title}".
Determine if the result indicates PASSED, FAILED, or INCONCLUSIVE.
Revise hypothesis confidence scores and recommend the single next diagnostic step OR declare terminal root cause.
Produce a strict JSON object matching this schema:
{
  "observationInterpretation": "plain English explanation of what the output means",
  "interpretedOutcome": "PASSED | FAILED | INCONCLUSIVE",
  "hypothesisUpdates": [
    {
      "hypothesisId": "exact hypothesis ID from the list",
      "delta": 0.35,
      "rationale": "why this test supports or refutes this hypothesis"
    }
  ],
  "contradictionDetected": false,
  "contradictionRationale": null,
  "isDiagnosisReached": false,
  "proposedNextStep": {
    "title": "Title of single next probe",
    "toolName": "ping_icmp_probe | socket_port_probe | dns_resolver_probe | service_status_probe | ntfs_permission_audit | vss_writer_audit | event_log_query",
    "command": "Safe read-only PowerShell or shell command",
    "purpose": "Precise reason for this test",
    "expectedResult": "Expected output if system is functioning normally",
    "safetyClassification": "SAFE_READ_ONLY"
  },
  "terminalConclusion": null
}
CRITICAL SAFETY & TRUTH INVARIANTS:
1. ONLY select tools from the approved allowlist: ping_icmp_probe, socket_port_probe, dns_resolver_probe, service_status_probe, ntfs_permission_audit, vss_writer_audit, event_log_query.
2. NEVER generate destructive commands (rm, del, format, reboot, shutdown, restart-service). Read-only commands only!
3. NEVER claim the application executed the command. All commands are run manually by the human technician.
4. If isDiagnosisReached is true, proposedNextStep must be null, and terminalConclusion must include rootCause and recommendedFixes.`;

    const prompt = `INCIDENT:
Title: ${input.incident.title}
Target Asset: ${input.targetAsset ? `${input.targetAsset.name} (${input.targetAsset.assetTag}, IP: ${input.targetAsset.ipAddress || 'N/A'})` : 'Unspecified'}

EXECUTED STEP:
Step Title: ${input.lastExecutedStep.title}
Command: ${input.lastExecutedStep.command}
Expected: ${input.lastExecutedStep.expectedResult}
User Recorded Outcome: ${input.outcome}
Observed Output / Terminal Text:
${input.observedOutput || '(None provided)'}
Technician Notes: ${input.technicianNotes || '(None)'}

EXISTING HYPOTHESES:
${hypothesesList}

PRIOR EVIDENCE (Recent):
${recentEvidence || 'No prior evidence recorded.'}

Evaluate the result and respond with structured JSON.`;

    return this.executeWithRetry(prompt, systemInstruction, rawJson => {
      const validated = AiNextStepProposalSchema.parse(rawJson);

      // Validate proposed command safety against allowlist
      if (validated.proposedNextStep) {
        const safety = SafetyValidator.validateCommand(
          validated.proposedNextStep.toolName,
          validated.proposedNextStep.command
        );

        if (!safety.isSafe) {
          throw new AiProviderError(
            `Safety violation in AI proposed command: ${safety.violations.join('; ')}`,
            422,
            false
          );
        }
      }

      return validated;
    });
  }

  /**
   * 3. Plain-English Step Explanation for Junior Technicians
   */
  public async explainDiagnosticStep(input: ExplainStepInput): Promise<AiStepExplanation> {
    const systemInstruction = `You are FixFlow AI's technical mentor.
Explain a diagnostic test step in friendly, precise, and accessible language for a junior IT technician.
Return strict JSON matching this schema:
{
  "stepTitle": "${input.step.title}",
  "plainEnglishPurpose": "What this test actually does in simple terms",
  "whyThisTestMatters": "Why this specific test is critical to isolate the failure",
  "whatToLookForInOutput": "Key keywords, return codes, or patterns to check in the terminal output",
  "safetyAssurance": "Clear statement confirming this test is 100% read-only and safe to execute"
}`;

    const prompt = `DIAGNOSTIC TEST DETAILS:
Title: ${input.step.title}
Tool: ${input.step.toolName}
Command: ${input.step.command}
Target Asset: ${input.targetAsset?.name || 'Target host'} (${input.targetAsset?.ipAddress || ''})
Formal Purpose: ${input.step.purpose}
Formal Expected Result: ${input.step.expectedResult}

Generate an accessible explanation for the technician.`;

    return this.executeWithRetry(prompt, systemInstruction, rawJson => {
      return AiStepExplanationSchema.parse(rawJson);
    });
  }

  /**
   * 4. Summarize Final Resolution Post-Mortem Report from Recorded Evidence
   */
  public async summarizeResolutionReport(input: SummarizeReportInput): Promise<AiReportSummary> {
    const evidenceLog = input.session.evidence
      .map((e, idx) => `[Evidence ${idx + 1}] Polarity: ${e.polarity} | Summary: ${e.summary} | Output: ${e.rawOutput || 'N/A'}`)
      .join('\n');

    const hypothesesSummary = input.session.hypotheses
      .map(h => `Hypothesis: "${h.title}" (Status: ${h.status}, Confidence: ${h.confidenceScore}) - ${h.description}`)
      .join('\n');

    const systemInstruction = `You are FixFlow AI's post-mortem incident lead.
Synthesize the recorded evidence from the completed diagnostic investigation into a formal Post-Mortem Report.
Produce strict JSON matching this schema:
{
  "executiveSummary": "Concise 2-3 paragraph executive summary of the incident from onset to resolution.",
  "confirmedRootCause": "Exact technical root cause isolated by the diagnostic evidence.",
  "fiveWhys": [
    { "whyNumber": 1, "question": "Why did the failure occur?", "answer": "..." },
    { "whyNumber": 2, "question": "Why was...", "answer": "..." },
    { "whyNumber": 3, "question": "Why was...", "answer": "..." },
    { "whyNumber": 4, "question": "Why was...", "answer": "..." },
    { "whyNumber": 5, "question": "Why was...", "answer": "..." }
  ],
  "verifiedFixes": [
    { "action": "Actionable fix confirmed by evidence", "owner": "Team", "priority": "CRITICAL", "remediationType": "IMMEDIATE_FIX" }
  ],
  "unverifiedRecommendations": [
    { "action": "Recommended long-term preventive action", "owner": "Team", "priority": "MEDIUM", "remediationType": "PREVENTIVE_MEASURE" }
  ],
  "technicalEvidenceSummary": "Chronological summary of key findings from the investigation timeline."
}
RULES:
1. Base all conclusions strictly on the RECORDED EVIDENCE. Never invent hypothetical failures.
2. Label unverified recommendations clearly so they are not mistaken for confirmed repairs.`;

    const prompt = `INCIDENT DETAILS:
Ticket: ${input.incident.ticketNumber}
Title: ${input.incident.title}
Target Asset: ${input.targetAsset ? `${input.targetAsset.name} (${input.targetAsset.assetTag})` : 'Unspecified'}
Category: ${input.incident.category}
Initial Problem: ${input.incident.rawDescription}

RECORDED EVIDENCE TIMELINE:
${evidenceLog}

HYPOTHESES OUTCOMES:
${hypothesesSummary}

Generate the final post-mortem report.`;

    return this.executeWithRetry(prompt, systemInstruction, rawJson => {
      return AiReportSummarySchema.parse(rawJson);
    });
  }
}
