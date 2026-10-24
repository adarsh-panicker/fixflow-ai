// src/lib/ai/__tests__/geminiIntegration.test.ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MockGeminiProvider } from '../mockGeminiProvider';
import { SafetyValidator, APPROVED_TOOLS } from '../safetyValidator';
import {
  AiIntakeAnalysisSchema,
  AiNextStepProposalSchema,
  AiStepExplanationSchema,
  AiReportSummarySchema,
} from '../schemas';
import { DiagnosticEngine } from '@/lib/engine/diagnosticEngine';
import { Asset } from '@/types/asset';
import { Incident, DiagnosticSession, DiagnosticStep } from '@/types/incident';

const mockServerAsset: Asset = {
  id: 'ast-srv-01',
  assetTag: 'SRV-APP-01',
  name: 'Primary ERP Application Server',
  assetType: 'SERVER',
  hostname: 'srv-app-01.corp.internal',
  ipAddress: '10.0.1.50',
  criticality: 'TIER_1_CRITICAL',
  status: 'DEGRADED',
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
};

describe('FixFlow AI - Gemini Integration & Provider Adapter', () => {
  // =========================================================================
  // 1. Intake Analysis & Asset Grounding
  // =========================================================================
  describe('1. Free-Text Intake Interpretation & Asset Grounding', () => {
    test('interprets free-text incident and suggests matching registered assets', async () => {
      const mockProvider = new MockGeminiProvider();
      const analysis = await mockProvider.analyzeIncidentIntake({
        title: 'ERP Server unreachable on network',
        rawDescription: 'Users in building 4 cannot open ERP client. Ping times out.',
        candidateAssets: [mockServerAsset],
      });

      // Assert Zod validation succeeds
      const validated = AiIntakeAnalysisSchema.parse(analysis);
      assert.equal(validated.category, 'INFRASTRUCTURE');
      assert.equal(validated.severity, 'P2_HIGH');
      assert.ok(validated.initialHypotheses.length >= 1);
      assert.deepEqual(validated.suggestedAssetTags, ['SRV-APP-01']);
    });

    test('requests clarifying question when incident description is too brief', async () => {
      const mockProvider = new MockGeminiProvider();
      const analysis = await mockProvider.analyzeIncidentIntake({
        title: 'Broken',
        rawDescription: 'down',
      });

      const validated = AiIntakeAnalysisSchema.parse(analysis);
      assert.equal(validated.needsClarification, true);
      assert.ok(validated.clarifyingQuestion !== null);
    });

    test('rejects hallucinated asset tags not present in candidate inventory', async () => {
      const mockProvider = new MockGeminiProvider();
      mockProvider.returnHallucinatedAsset = true;

      const analysis = await mockProvider.analyzeIncidentIntake({
        title: 'Database connection drop',
        rawDescription: 'Connection to SQL cluster timed out after 30 seconds.',
        candidateAssets: [mockServerAsset],
      });

      const { validTags, invalidTags } = SafetyValidator.validateAssetTags(
        analysis.suggestedAssetTags,
        [mockServerAsset.assetTag]
      );

      assert.deepEqual(validTags, []);
      assert.deepEqual(invalidTags, ['NONEXISTENT-TAG-999']);
    });
  });

  // =========================================================================
  // 2. Next-Step Planning & Safety Tool Validation
  // =========================================================================
  describe('2. Diagnostic Planning & Safety Invariants', () => {
    const mockIncident: Incident = {
      id: 'inc-ai-01',
      ticketNumber: 'INC-2026-0501',
      title: 'ERP Server network failure',
      rawDescription: 'Server unreachable from client subnet.',
      category: 'INFRASTRUCTURE',
      severity: 'P2_HIGH',
      status: 'INVESTIGATING',
      experienceLevel: 'Intermediate',
      diagnosticMode: 'GUIDED',
      targetAssetId: mockServerAsset.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockSession: DiagnosticSession = {
      id: 'ses-ai-01',
      incidentId: mockIncident.id,
      mode: 'GUIDED',
      currentStepIndex: 0,
      status: 'ACTIVE',
      totalStepsExecuted: 1,
      sessionBudgetMax: 12,
      steps: [
        {
          id: 'step-1',
          stepId: 'step-icmp',
          title: 'ICMP Echo Probe to Server',
          toolName: 'ping_icmp_probe',
          command: 'Test-Connection -TargetName 10.0.1.50 -Count 4',
          purpose: 'Verify L3 reachability',
          expectedResult: '0% packet loss',
          outcome: 'FAILED',
        },
      ],
      evidence: [],
      hypotheses: [
        {
          id: 'hyp-gw-1',
          sessionId: 'ses-ai-01',
          title: 'Gateway Failure',
          description: 'Gateway dropped routing',
          confidenceScore: 0.50,
          status: 'CANDIDATE',
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    test('interprets failed ping and proposes safe read-only gateway test', async () => {
      const mockProvider = new MockGeminiProvider();
      const proposal = await mockProvider.proposeNextStep({
        incident: mockIncident,
        session: mockSession,
        lastExecutedStep: mockSession.steps[0],
        outcome: 'FAILED',
        observedOutput: 'Request timed out. 100% loss.',
        targetAsset: mockServerAsset,
      });

      const validated = AiNextStepProposalSchema.parse(proposal);
      assert.equal(validated.interpretedOutcome, 'FAILED');
      assert.ok(validated.proposedNextStep);
      assert.equal(validated.proposedNextStep?.toolName, 'ping_icmp_probe');
      assert.ok(APPROVED_TOOLS.includes(validated.proposedNextStep?.toolName as any));

      // Verify safety validation
      const safety = SafetyValidator.validateCommand(
        validated.proposedNextStep.toolName,
        validated.proposedNextStep.command
      );
      assert.equal(safety.isSafe, true);
    });

    test('strictly rejects unsafe commands and disallowed tools from the model', async () => {
      const mockProvider = new MockGeminiProvider();
      mockProvider.returnUnsafeCommand = true;

      await assert.rejects(
        async () => {
          await mockProvider.proposeNextStep({
            incident: mockIncident,
            session: mockSession,
            lastExecutedStep: mockSession.steps[0],
            outcome: 'FAILED',
            observedOutput: 'Testing injection',
          });
        },
        {
          name: 'AiProviderError',
          statusCode: 422,
        }
      );
    });

    test('safety validator flags forbidden tokens (rm, reboot, shutdown, metacharacters)', () => {
      // 1. Destructive token
      const check1 = SafetyValidator.validateCommand('ping_icmp_probe', 'ping 10.0.1.1; rm -rf /');
      assert.equal(check1.isSafe, false);
      assert.ok(check1.violations.some(v => v.includes('rm ')));

      // 2. Chaining metacharacter
      const check2 = SafetyValidator.validateCommand('socket_port_probe', 'Test-NetConnection 10.0.1.1 -Port 445 && reboot');
      assert.equal(check2.isSafe, false);
      assert.ok(check2.violations.some(v => v.includes('reboot')));

      // 3. Disallowed tool
      const check3 = SafetyValidator.validateCommand('arbitrary_powershell_eval', 'Get-Process');
      assert.equal(check3.isSafe, false);
      assert.ok(check3.violations.some(v => v.includes('Disallowed tool identifier')));
    });

    test('validates evidence reference IDs against existing session evidence', () => {
      const existing = ['ev-101', 'ev-102'];
      const referenced = ['ev-101', 'ev-999-fabricated'];

      const result = SafetyValidator.validateEvidenceReferences(referenced, existing);
      assert.deepEqual(result.validIds, ['ev-101']);
      assert.deepEqual(result.invalidIds, ['ev-999-fabricated']);
    });
  });

  // =========================================================================
  // 3. Step Explanation & Report Summarization
  // =========================================================================
  describe('3. Step Explanation & Post-Mortem Report Summarization', () => {
    test('generates plain-English step explanation with safety assurance', async () => {
      const mockProvider = new MockGeminiProvider();
      const step: DiagnosticStep = {
        id: 'step-icmp',
        stepId: 'step-icmp',
        title: 'ICMP Echo Probe to Server',
        toolName: 'ping_icmp_probe',
        command: 'Test-Connection -TargetName 10.0.1.50 -Count 4',
        purpose: 'Verify L3 reachability',
        expectedResult: '0% packet loss',
        outcome: 'NOT_TESTED',
      };

      const explanation = await mockProvider.explainDiagnosticStep({
        step,
        incident: {
          id: 'inc-1',
          ticketNumber: 'INC-2026-0501',
          title: 'Server down',
          rawDescription: 'down',
          category: 'INFRASTRUCTURE',
          severity: 'P2_HIGH',
          status: 'INVESTIGATING',
          experienceLevel: 'Beginner',
          diagnosticMode: 'GUIDED',
          createdAt: '',
          updatedAt: '',
        },
        targetAsset: mockServerAsset,
      });

      const validated = AiStepExplanationSchema.parse(explanation);
      assert.ok(validated.plainEnglishPurpose.length >= 10);
      assert.ok(validated.safetyAssurance.includes('read-only'));
    });

    test('summarizes recorded evidence into a structured 5-Whys post-mortem report', async () => {
      const mockProvider = new MockGeminiProvider();
      const report = await mockProvider.summarizeResolutionReport({
        incident: {
          id: 'inc-1',
          ticketNumber: 'INC-2026-0501',
          title: 'ERP Server network failure',
          rawDescription: 'Server unreachable from client subnet.',
          category: 'INFRASTRUCTURE',
          severity: 'P2_HIGH',
          status: 'ROOT_CAUSE_IDENTIFIED',
          experienceLevel: 'Intermediate',
          diagnosticMode: 'GUIDED',
          createdAt: '',
          updatedAt: '',
        },
        session: {
          id: 'ses-1',
          incidentId: 'inc-1',
          mode: 'GUIDED',
          currentStepIndex: 2,
          totalStepsExecuted: 2,
          sessionBudgetMax: 12,
          steps: [],
          evidence: [
            {
              id: 'ev-1',
              sessionId: 'ses-1',
              summary: 'Target host 10.0.1.50 ICMP ping timed out.',
              polarity: 'REFUTING',
              recordedAt: new Date().toISOString(),
            },
            {
              id: 'ev-2',
              sessionId: 'ses-1',
              summary: 'Subnet Default Gateway 10.0.1.1 unreachable.',
              polarity: 'REFUTING',
              recordedAt: new Date().toISOString(),
            },
          ],
          hypotheses: [
            {
              id: 'hyp-1',
              sessionId: 'ses-1',
              title: 'Gateway Failure',
              description: 'Gateway dropped routing',
              confidenceScore: 0.95,
              status: 'CONFIRMED',
              updatedAt: new Date().toISOString(),
            },
          ],
        },
        targetAsset: mockServerAsset,
      });

      const validated = AiReportSummarySchema.parse(report);
      assert.equal(validated.fiveWhys.length, 5);
      assert.ok(validated.confirmedRootCause.includes('Gateway'));
      assert.ok(validated.verifiedFixes.length >= 1);
      assert.ok(validated.unverifiedRecommendations.length >= 1);
    });
  });

  // =========================================================================
  // 4. Provider Failures, Rate Limits & Fallback
  // =========================================================================
  describe('4. Error Handling, Rate Limits & Deterministic Fallback', () => {
    test('handles 429 rate limit or 500 provider error gracefully', async () => {
      const mockProvider = new MockGeminiProvider();
      mockProvider.shouldFail = true;
      mockProvider.failureStatusCode = 429;
      mockProvider.failureMessage = 'Resource has been exhausted (rate limit exceeded).';

      await assert.rejects(
        async () => {
          await mockProvider.analyzeIncidentIntake({
            title: 'Test',
            rawDescription: 'Test incident description',
          });
        },
        {
          name: 'AiProviderError',
          statusCode: 429,
        }
      );
    });

    test('falls back seamlessly to deterministic engine when AI provider fails', () => {
      // Proves that if Gemini is unavailable, the deterministic engine completely takes over without error
      const incident: Incident = {
        id: 'inc-offline-demo',
        ticketNumber: 'INC-2026-0502',
        title: 'Finance shared folder access denied',
        rawDescription: 'Users cannot open \\\\fs01\\Shared with error 0x80070005',
        category: 'STORAGE',
        severity: 'P2_HIGH',
        status: 'INVESTIGATING',
        experienceLevel: 'Intermediate',
        diagnosticMode: 'GUIDED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Deterministic engine initializes full session without any AI key
      const session = DiagnosticEngine.initializeSession(incident);
      assert.equal(session.scenarioId, 'share-inaccessible');
      assert.ok(session.steps.length >= 1);

      // Deterministic engine evaluates result and advances tree
      const res = DiagnosticEngine.recordStepResult(
        session,
        incident,
        session.steps[0].id,
        'PASSED',
        '0x80070005 Access is Denied observed'
      );
      assert.equal(res.nextStep?.stepId, 'step-shr-smb-port');
      assert.equal(res.recordedEvidence.polarity, 'SUPPORTING');
    });
  });
});
