// src/lib/ai/mockGeminiProvider.ts
import {
  IGeminiProvider,
  IntakeAnalysisInput,
  NextStepProposalInput,
  ExplainStepInput,
  SummarizeReportInput,
  AiProviderError,
} from './geminiAdapter';
import {
  AiIntakeAnalysis,
  AiNextStepProposal,
  AiStepExplanation,
  AiReportSummary,
} from './schemas';
import { SafetyValidator } from './safetyValidator';

export class MockGeminiProvider implements IGeminiProvider {
  public shouldFail: boolean = false;
  public failureStatusCode: number = 500;
  public failureMessage: string = 'Simulated Gemini Provider Error';
  public returnUnsafeCommand: boolean = false;
  public returnMalformedJson: boolean = false;
  public returnHallucinatedAsset: boolean = false;

  public isAvailable(): boolean {
    return !this.shouldFail;
  }

  public async analyzeIncidentIntake(input: IntakeAnalysisInput): Promise<AiIntakeAnalysis> {
    if (this.shouldFail) {
      throw new AiProviderError(this.failureMessage, this.failureStatusCode);
    }

    if (this.returnMalformedJson) {
      // Simulate validation failure (missing required fields)
      return {
        problemSummary: 'Bad',
      } as any;
    }

    const suggestedTags = this.returnHallucinatedAsset
      ? ['NONEXISTENT-TAG-999']
      : input.candidateAssets && input.candidateAssets.length > 0
      ? [input.candidateAssets[0].assetTag]
      : [];

    return {
      problemSummary: `Interpreted incident: ${input.title}. Symptoms point to service degradation.`,
      category: 'INFRASTRUCTURE',
      severity: 'P2_HIGH',
      needsClarification: input.rawDescription.length < 20,
      clarifyingQuestion:
        input.rawDescription.length < 20
          ? 'Is the server unreachable for all subnets or only specific users?'
          : null,
      suggestedAssetTags: suggestedTags,
      suspectedFailureDomain: 'Network Layer 3 / Routing',
      initialHypotheses: [
        {
          title: 'Perimeter Gateway Packet Drop',
          description: 'Network gateway is dropping inbound traffic on management subnet.',
          initialConfidence: 0.45,
        },
        {
          title: 'Remote Management Service Unresponsive',
          description: 'Local host operating system is frozen or TermService has terminated.',
          initialConfidence: 0.35,
        },
      ],
    };
  }

  public async proposeNextStep(input: NextStepProposalInput): Promise<AiNextStepProposal> {
    if (this.shouldFail) {
      throw new AiProviderError(this.failureMessage, this.failureStatusCode);
    }

    if (this.returnUnsafeCommand) {
      // Test rejection of forbidden tokens
      const unsafe = {
        observationInterpretation: 'Unsafe command simulation',
        interpretedOutcome: 'FAILED' as const,
        hypothesisUpdates: [],
        contradictionDetected: false,
        isDiagnosisReached: false,
        proposedNextStep: {
          title: 'Dangerous System Modification',
          toolName: 'disallowed_tool_exec',
          command: 'rm -rf / && reboot',
          purpose: 'Simulate dangerous prompt injection',
          expectedResult: 'System wiped',
          safetyClassification: 'SAFE_READ_ONLY' as const,
        },
      };

      // Run through validator to assert rejection
      const safety = SafetyValidator.validateCommand(
        unsafe.proposedNextStep.toolName,
        unsafe.proposedNextStep.command
      );

      if (!safety.isSafe) {
        throw new AiProviderError(
          `Safety violation in AI proposed command: ${safety.violations.join('; ')}`,
          422,
          false
        );
      }
      return unsafe;
    }

    const firstHyp = input.session.hypotheses[0];

    if (input.outcome === 'FAILED' && (input.lastExecutedStep.title.includes('Ping') || input.lastExecutedStep.title.includes('ICMP'))) {
      return {
        observationInterpretation: 'Target host failed ICMP ping. Network path is down or machine is powered off.',
        interpretedOutcome: 'FAILED',
        hypothesisUpdates: firstHyp
          ? [
              {
                hypothesisId: firstHyp.id,
                delta: 0.30,
                rationale: 'Ping timeout directly supports gateway or power failure.',
              },
            ]
          : [],
        contradictionDetected: false,
        isDiagnosisReached: false,
        proposedNextStep: {
          title: 'Ping Subnet Default Gateway',
          toolName: 'ping_icmp_probe',
          command: 'Test-Connection -TargetName 10.0.1.1 -Count 4',
          purpose: 'Determine if entire local subnet gateway is unreachable.',
          expectedResult: 'Gateway replies with 0% packet loss.',
          safetyClassification: 'SAFE_READ_ONLY',
        },
        terminalConclusion: null,
      };
    }

    // Terminal conclusion
    return {
      observationInterpretation: 'Confirmed gateway unreachable. Root cause isolated.',
      interpretedOutcome: 'FAILED',
      hypothesisUpdates: firstHyp
        ? [
            {
              hypothesisId: firstHyp.id,
              delta: 0.50,
              rationale: 'Gateway uplink dropped.',
              newStatus: 'CONFIRMED',
            },
          ]
        : [],
      contradictionDetected: false,
      isDiagnosisReached: true,
      proposedNextStep: null,
      terminalConclusion: {
        rootCause: 'Default Subnet Gateway Switch Uplink is disconnected.',
        recommendedFixes: [
          {
            action: 'Inspect Top-of-Rack physical switch connection and trunk status',
            owner: 'Network Engineering',
            priority: 'CRITICAL',
            remediationType: 'IMMEDIATE_FIX',
          },
        ],
      },
    };
  }

  public async explainDiagnosticStep(input: ExplainStepInput): Promise<AiStepExplanation> {
    if (this.shouldFail) {
      throw new AiProviderError(this.failureMessage, this.failureStatusCode);
    }

    return {
      stepTitle: input.step.title,
      plainEnglishPurpose: `This probe sends 4 test echo packets to ${input.targetAsset?.ipAddress || 'the target'} to see if it responds.`,
      whyThisTestMatters: 'If this fails, it tells us the device is disconnected from the network before wasting time checking software.',
      whatToLookForInOutput: 'Look for "0% packet loss" and low millisecond response times.',
      safetyAssurance: 'This test is completely read-only and will never alter system configurations.',
    };
  }

  public async summarizeResolutionReport(input: SummarizeReportInput): Promise<AiReportSummary> {
    if (this.shouldFail) {
      throw new AiProviderError(this.failureMessage, this.failureStatusCode);
    }

    return {
      executiveSummary: `Investigation completed for incident '${input.incident.title}'. The issue was methodically triaged using recorded network evidence, isolating an uplink failure.`,
      confirmedRootCause: 'Default Subnet Gateway Uplink port was offline.',
      fiveWhys: [
        { whyNumber: 1, question: 'Why was the server unreachable?', answer: 'Traffic to the server subnet was dropped.' },
        { whyNumber: 2, question: 'Why was traffic dropped?', answer: 'The default gateway did not forward packets.' },
        { whyNumber: 3, question: 'Why did the gateway not forward packets?', answer: 'The switch trunk port link went down.' },
        { whyNumber: 4, question: 'Why did the trunk link go down?', answer: 'A physical patch cable in rack B was dislodged during maintenance.' },
        { whyNumber: 5, question: 'Why was it dislodged?', answer: 'Cable management arm lacked strain relief latching.' },
      ],
      verifiedFixes: [
        {
          action: 'Re-seat optical patch cable in rack B core switch port 24',
          owner: 'Datacenter Ops',
          priority: 'CRITICAL',
          remediationType: 'IMMEDIATE_FIX',
        },
      ],
      unverifiedRecommendations: [
        {
          action: 'Install latching cable management brackets across all rack rows',
          owner: 'Facilities',
          priority: 'MEDIUM',
          remediationType: 'PREVENTIVE_MEASURE',
        },
      ],
      technicalEvidenceSummary: 'Evidence records 1 through 3 confirmed ping failure to target host followed by gateway timeout.',
    };
  }
}
