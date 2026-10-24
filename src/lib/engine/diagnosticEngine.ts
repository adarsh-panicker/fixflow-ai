// src/lib/engine/diagnosticEngine.ts
import {
  Incident,
  DiagnosticSession,
  DiagnosticStep,
  Evidence,
  Hypothesis,
  AuditEvent,
  StepOutcome,
  ResolutionReport,
  ActionItem,
} from '@/types/incident';
import { Asset } from '@/types/asset';
import {
  ScenarioDefinition,
  ScenarioStepDefinition,
  NextStepRule,
  SCENARIO_REGISTRY,
  getAllScenarios,
} from './scenarios';

export interface StepEvaluationResult {
  session: DiagnosticSession;
  nextStep: DiagnosticStep | null;
  recordedEvidence: Evidence;
  auditEvents: AuditEvent[];
  hasContradiction: boolean;
  contradictionMessage?: string;
  isFinished: boolean;
  stopReason?: string;
  report?: ResolutionReport;
}

export class DiagnosticEngine {
  /**
   * Matches an incident to a registered diagnostic scenario based on description, title, and asset context
   */
  public static matchScenario(
    incident: { title: string; rawDescription: string; category?: string; targetAsset?: Asset | null },
    _assets: Asset[] = []
  ): ScenarioDefinition | null {
    const text = `${incident.title} ${incident.rawDescription} ${incident.category || ''}`.toLowerCase();
    const scenarios = getAllScenarios();

    // 1. Direct keyword match
    let bestMatch: ScenarioDefinition | null = null;
    let highestScore = 0;

    for (const scenario of scenarios) {
      let score = 0;
      for (const kw of scenario.triggerKeywords) {
        if (text.includes(kw.toLowerCase())) {
          score += 2;
        }
      }

      // Check if target asset type matches scenario
      if (incident.targetAsset && scenario.applicableAssetTypes.includes(incident.targetAsset.assetType)) {
        score += 3;
      }

      if (score > highestScore && score >= 2) {
        highestScore = score;
        bestMatch = scenario;
      }
    }

    return bestMatch;
  }

  /**
   * Detects if critical context is missing from the incident intake
   */
  public static detectMissingInformation(
    incident: { title: string; rawDescription: string; targetAssetId?: string | null },
    targetAsset?: Asset | null
  ): { isMissing: boolean; reason?: string } {
    const text = `${incident.title} ${incident.rawDescription}`.toLowerCase();

    if (!incident.targetAssetId && !targetAsset) {
      return {
        isMissing: true,
        reason: 'Target IT asset is not specified. Clarifying questions needed to identify affected system.',
      };
    }

    if (text.length < 15) {
      return {
        isMissing: true,
        reason: 'Incident description is too brief. Clarifying symptoms and scope required.',
      };
    }

    return { isMissing: false };
  }

  /**
   * Interpolate command templates with real asset and network parameters
   */
  public static interpolateCommand(
    template: string,
    targetAsset?: Asset | null,
    upstreamDependencies: Asset[] = []
  ): string {
    const targetIp = targetAsset?.ipAddress || '10.0.1.50';
    const hostname = targetAsset?.hostname || targetAsset?.assetTag || 'target-host.corp.internal';
    const assetName = targetAsset?.name || 'Target Asset';

    // Find upstream DNS server if available in dependencies
    const dnsDep = upstreamDependencies.find(d => d.name.toLowerCase().includes('dns') || d.tags?.includes('dns'));
    const dnsIp = dnsDep?.ipAddress || '10.0.1.10';

    // Subnet gateway approximation
    const ipParts = targetIp.split('.');
    const gatewayIp = ipParts.length === 4 ? `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.1` : '10.0.1.1';

    return template
      .replace(/{target_ip}/g, targetIp)
      .replace(/{hostname}/g, hostname)
      .replace(/{asset_name}/g, assetName)
      .replace(/{dns_ip}/g, dnsIp)
      .replace(/{gateway_ip}/g, gatewayIp)
      .replace(/{hypervisor_host}/g, 'HV-CORE-01.corp.internal')
      .replace(/{share_name}/g, 'FinancialDocs')
      .replace(/{service_name}/g, 'Spooler');
  }

  /**
   * Initialize a new diagnostic session for an incident
   */
  public static initializeSession(
    incident: Incident,
    targetAsset?: Asset | null,
    confirmedDependencies: Asset[] = []
  ): DiagnosticSession {
    const matchedScenario = this.matchScenario(incident, confirmedDependencies);
    const _missingInfo = this.detectMissingInformation(incident, targetAsset);

    const sessionId = `ses-${Date.now()}`;
    const now = new Date().toISOString();

    let initialHypotheses: Hypothesis[] = [];
    let initialStepDef: ScenarioStepDefinition | null = null;
    let scenarioId: string | null = null;

    if (matchedScenario) {
      scenarioId = matchedScenario.id;

      // Populate base hypotheses from scenario
      initialHypotheses = matchedScenario.initialHypotheses.map(h => ({
        id: `${h.id}-${Date.now()}`,
        sessionId,
        title: h.title,
        description: h.description,
        confidenceScore: h.initialConfidence,
        status: 'CANDIDATE',
        supportingEvidenceIds: [],
        refutingEvidenceIds: [],
        updatedAt: now,
      }));

      // Enrich with confirmed upstream infrastructure dependencies!
      if (confirmedDependencies.length > 0) {
        confirmedDependencies.forEach((dep, idx) => {
          initialHypotheses.push({
            id: `hyp-dep-${idx}-${Date.now()}`,
            sessionId,
            title: `Upstream Dependency Failure: ${dep.name} (${dep.assetTag})`,
            description: `Target asset depends on ${dep.name} (${dep.ipAddress || dep.hostname || 'Network'}). Upstream degradation will cause service outage.`,
            confidenceScore: 0.35,
            status: 'CANDIDATE',
            supportingEvidenceIds: [],
            refutingEvidenceIds: [],
            updatedAt: now,
          });
        });
      }

      // Check whether to start with clarifying question or technical step
      const stepKey = matchedScenario.initialStepId;
      initialStepDef = matchedScenario.steps[stepKey];
    } else {
      // Fallback for unsupported / generic issues
      scenarioId = 'generic-unsupported';
      initialHypotheses = [
        {
          id: `hyp-gen-1-${Date.now()}`,
          sessionId,
          title: 'Unregistered or Complex Incident Pattern',
          description: 'The symptoms described do not match an automated diagnostic scenario. Manual technician investigation is required.',
          confidenceScore: 0.50,
          status: 'CANDIDATE',
          supportingEvidenceIds: [],
          refutingEvidenceIds: [],
          updatedAt: now,
        },
      ];
    }

    const firstStep: DiagnosticStep = initialStepDef
      ? {
          id: `step-run-1-${Date.now()}`,
          stepId: initialStepDef.stepId,
          title: initialStepDef.title,
          question: initialStepDef.question,
          toolName: initialStepDef.toolName,
          command: this.interpolateCommand(initialStepDef.commandTemplate, targetAsset, confirmedDependencies),
          purpose: initialStepDef.purpose,
          expectedResult: initialStepDef.expectedResult,
          expectedOutput: initialStepDef.expectedResult,
          possibleOutcomes: initialStepDef.possibleOutcomes,
          safetyClassification: initialStepDef.safetyClassification,
          riskRating: 'SAFE_READ_ONLY',
          requiresApproval: initialStepDef.requiresApproval || false,
          outcome: 'NOT_TESTED',
          orderIndex: 0,
          isClarifyingQuestion: initialStepDef.isClarifyingQuestion || false,
          isSimulatedDemo: incident.isDemo || false,
        }
      : {
          id: `step-run-1-${Date.now()}`,
          stepId: 'step-unsupported-q1',
          title: 'Manual Technician Intake & Scope Clarification',
          question: 'Please document the exact symptoms, error codes, and affected assets for manual escalation.',
          toolName: 'technician_intake',
          command: 'N/A - Manual Triage Interview',
          purpose: 'Gather essential diagnostic details for an unsupported scenario.',
          expectedResult: 'Technician enters comprehensive incident symptoms.',
          possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE', 'NOT_TESTED'],
          safetyClassification: 'CLARIFYING_QUESTION',
          riskRating: 'SAFE_READ_ONLY',
          requiresApproval: false,
          outcome: 'NOT_TESTED',
          orderIndex: 0,
          isClarifyingQuestion: true,
          isSimulatedDemo: incident.isDemo || false,
        };

    const session: DiagnosticSession = {
      id: sessionId,
      incidentId: incident.id,
      scenarioId,
      currentStepId: firstStep.id,
      currentStepIndex: 0,
      status: 'ACTIVE',
      sessionStatus: 'ACTIVE',
      mode: incident.diagnosticMode || 'GUIDED',
      totalStepsExecuted: 0,
      sessionBudgetMax: 12,
      stopReason: null,
      steps: [firstStep],
      evidence: [],
      hypotheses: initialHypotheses,
      createdAt: now,
      updatedAt: now,
    };

    return session;
  }

  /**
   * Detects contradictory evidence across the session timeline
   */
  public static detectContradictions(
    session: DiagnosticSession,
    newStep: DiagnosticStep,
    outcome: StepOutcome
  ): { hasContradiction: boolean; message?: string } {
    // E.g., If a ping or reachability test was previously marked PASSED, but another reachability test is now marked FAILED without an intervening change
    const pingSteps = session.steps.filter(
      s => s.outcome !== 'NOT_TESTED' && s.outcome !== 'SKIPPED' && (s.toolName === 'ping_icmp_probe' || s.title.toLowerCase().includes('ping'))
    );

    if (pingSteps.length > 0 && (newStep.toolName === 'ping_icmp_probe' || newStep.title.toLowerCase().includes('ping'))) {
      const prevPassed = pingSteps.some(s => s.outcome === 'PASSED');
      const prevFailed = pingSteps.some(s => s.outcome === 'FAILED');

      if (outcome === 'FAILED' && prevPassed) {
        return {
          hasContradiction: true,
          message: `Contradiction detected: Ping to target host previously PASSED on step '${pingSteps.find(s => s.outcome === 'PASSED')?.title}', but currently recorded as FAILED. Verify physical connection or intermittent dropouts.`,
        };
      }
      if (outcome === 'PASSED' && prevFailed) {
        return {
          hasContradiction: true,
          message: `Contradiction detected: Ping previously FAILED, but currently recorded as PASSED. Target system may have rebooted or network path recovered.`,
        };
      }
    }

    return { hasContradiction: false };
  }

  /**
   * Record a user-submitted step observation and deterministically evaluate the next action
   */
  public static recordStepResult(
    session: DiagnosticSession,
    incident: Incident,
    stepId: string,
    outcome: StepOutcome,
    observedOutput: string = '',
    technicianNotes: string = '',
    targetAsset?: Asset | null,
    confirmedDependencies: Asset[] = [],
    isSimulatedDemo: boolean = false
  ): StepEvaluationResult {
    const now = new Date().toISOString();
    const auditEvents: AuditEvent[] = [];

    // 1. Locate current step
    const stepIndex = session.steps.findIndex(s => s.id === stepId || s.stepId === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step '${stepId}' not found in active session '${session.id}'.`);
    }

    const currentStep = session.steps[stepIndex];

    // Mark current step executed
    currentStep.outcome = outcome;
    currentStep.observedOutput = observedOutput || (outcome === 'PASSED' ? 'Verification succeeded as expected.' : 'Verification failed or timed out.');
    currentStep.technicianNotes = technicianNotes || undefined;
    currentStep.executedAt = now;
    currentStep.isSimulatedDemo = isSimulatedDemo;

    session.totalStepsExecuted += 1;

    // Audit Step Execution
    auditEvents.push({
      id: `aud-${Date.now()}-1`,
      sessionId: session.id,
      incidentId: incident.id,
      timestamp: now,
      eventType: 'STEP_EXECUTED',
      actor: 'USER',
      details: `User recorded result '${outcome}' for diagnostic test '${currentStep.title}'. (Application executed NO commands).`,
      metadata: { stepId: currentStep.stepId, outcome, isSimulatedDemo },
    });

    // 2. Check for Contradictions
    const contradictionCheck = this.detectContradictions(session, currentStep, outcome);
    const hasContradiction = contradictionCheck.hasContradiction;
    const contradictionMessage = contradictionCheck.message;

    if (hasContradiction) {
      auditEvents.push({
        id: `aud-${Date.now()}-c`,
        sessionId: session.id,
        incidentId: incident.id,
        timestamp: now,
        eventType: 'CONTRADICTION_DETECTED',
        actor: 'DIAGNOSTIC_ENGINE',
        details: contradictionMessage || 'Conflicting diagnostic evidence detected in timeline.',
        metadata: { stepId: currentStep.stepId, outcome },
      });
    }

    // 3. Create Evidence Record
    const evidenceId = `ev-${Date.now()}`;
    const polarity = outcome === 'PASSED' ? 'SUPPORTING' : outcome === 'FAILED' ? 'REFUTING' : 'NEUTRAL';
    const evidenceSummary = currentStep.isClarifyingQuestion
      ? `Technician intake note: ${observedOutput || 'Clarification received.'}`
      : `Test '${currentStep.title}' recorded ${outcome}. ${observedOutput || ''}`;

    const newEvidence: Evidence = {
      id: evidenceId,
      sessionId: session.id,
      stepId: currentStep.stepId,
      summary: evidenceSummary,
      rawOutput: observedOutput || undefined,
      polarity,
      technicianNotes: technicianNotes || undefined,
      hypothesisIds: [],
      confidenceImpact: outcome === 'PASSED' ? 0.20 : outcome === 'FAILED' ? -0.25 : 0,
      isContradictory: hasContradiction,
      recordedAt: now,
    };

    session.evidence.unshift(newEvidence);

    // 4. Branching Logic via Scenario Definition
    const scenario = session.scenarioId ? SCENARIO_REGISTRY[session.scenarioId] : null;
    let nextStepDef: ScenarioStepDefinition | null = null;
    let conclusionData: NextStepRule['conclusion'] | undefined;

    if (scenario) {
      const stepDef = scenario.steps[currentStep.stepId];
      if (stepDef) {
        // Find matching rule
        const rule = stepDef.nextRules.find(r => r.outcome === outcome) || stepDef.nextRules.find(r => r.outcome === '*');

        if (rule) {
          // Apply hypothesis impact
          if (rule.hypothesisImpact) {
            rule.hypothesisImpact.forEach(impact => {
              const hyp = session.hypotheses.find(h => h.id.includes(impact.hypothesisId));
              if (hyp) {
                newEvidence.hypothesisIds?.push(hyp.id);
                hyp.confidenceScore = Math.max(0.05, Math.min(0.99, Number((hyp.confidenceScore + impact.delta).toFixed(2))));

                if (impact.targetStatus) {
                  hyp.status = impact.targetStatus;
                } else if (hyp.confidenceScore >= 0.85) {
                  hyp.status = 'CONFIRMED';
                } else if (hyp.confidenceScore <= 0.15) {
                  hyp.status = 'REFUTED';
                } else {
                  hyp.status = 'INVESTIGATING';
                }

                if (hasContradiction) {
                  hyp.status = 'CONTRADICTORY';
                }

                hyp.updatedAt = now;
                if (impact.delta > 0) {
                  hyp.supportingEvidenceIds = Array.from(new Set([...(hyp.supportingEvidenceIds || []), evidenceId]));
                } else {
                  hyp.refutingEvidenceIds = Array.from(new Set([...(hyp.refutingEvidenceIds || []), evidenceId]));
                }
              }
            });
          }

          if (rule.conclusion) {
            conclusionData = rule.conclusion;
          }

          if (rule.nextStepId && scenario.steps[rule.nextStepId]) {
            nextStepDef = scenario.steps[rule.nextStepId];
          }
        }
      }
    } else {
      // Default heuristic for generic sessions
      session.hypotheses.forEach(h => {
        if (outcome === 'PASSED') h.confidenceScore = Math.min(0.95, h.confidenceScore + 0.10);
        if (outcome === 'FAILED') h.confidenceScore = Math.max(0.05, h.confidenceScore - 0.20);
        h.updatedAt = now;
      });
    }

    // 5. Evaluate Session Stop & Budget Conditions
    let isFinished = false;
    let stopReason: string | undefined;

    if (conclusionData) {
      isFinished = true;
      stopReason = conclusionData.stopReason;
    } else if (session.totalStepsExecuted >= session.sessionBudgetMax) {
      isFinished = true;
      stopReason = 'SESSION_BUDGET_EXHAUSTED';
    } else if (!nextStepDef) {
      isFinished = true;
      stopReason = outcome === 'INCONCLUSIVE' ? 'ESCALATION_REQUIRED' : 'ROOT_CAUSE_IDENTIFIED';
    }

    // 6. Build and Append Next Step (Preserving All Previous Steps!)
    let nextStep: DiagnosticStep | null = null;

    if (!isFinished && nextStepDef) {
      nextStep = {
        id: `step-run-${session.steps.length + 1}-${Date.now()}`,
        stepId: nextStepDef.stepId,
        title: nextStepDef.title,
        question: nextStepDef.question,
        toolName: nextStepDef.toolName,
        command: this.interpolateCommand(nextStepDef.commandTemplate, targetAsset, confirmedDependencies),
        purpose: nextStepDef.purpose,
        expectedResult: nextStepDef.expectedResult,
        expectedOutput: nextStepDef.expectedResult,
        possibleOutcomes: nextStepDef.possibleOutcomes,
        safetyClassification: nextStepDef.safetyClassification,
        riskRating: 'SAFE_READ_ONLY',
        requiresApproval: nextStepDef.requiresApproval || false,
        outcome: 'NOT_TESTED',
        orderIndex: session.steps.length,
        isClarifyingQuestion: nextStepDef.isClarifyingQuestion || false,
        isSimulatedDemo,
      };

      session.steps.push(nextStep);
      session.currentStepId = nextStep.id;
      session.currentStepIndex = session.steps.length - 1;

      auditEvents.push({
        id: `aud-${Date.now()}-2`,
        sessionId: session.id,
        incidentId: incident.id,
        timestamp: now,
        eventType: 'STEP_RECOMMENDED',
        actor: 'DIAGNOSTIC_ENGINE',
        details: `Engine evaluated evidence and recommended next step: '${nextStep.title}'.`,
        metadata: { nextStepId: nextStep.stepId },
      });
    } else {
      session.status = stopReason === 'ROOT_CAUSE_IDENTIFIED' ? 'COMPLETED' : 'ESCALATED';
      session.sessionStatus = session.status;
      session.stopReason = stopReason || 'COMPLETED';

      auditEvents.push({
        id: `aud-${Date.now()}-stop`,
        sessionId: session.id,
        incidentId: incident.id,
        timestamp: now,
        eventType: stopReason === 'ROOT_CAUSE_IDENTIFIED' ? 'SESSION_STOPPED' : 'SESSION_ESCALATED',
        actor: 'DIAGNOSTIC_ENGINE',
        details: `Session finished with reason: ${session.stopReason}.`,
        metadata: { stopReason: session.stopReason },
      });
    }

    session.updatedAt = now;

    // 7. Generate Resolution Report if Root Cause Identified
    let report: ResolutionReport | undefined;
    if (isFinished && conclusionData) {
      const _topHypothesis = session.hypotheses.find(h => h.status === 'CONFIRMED') || session.hypotheses[0];

      const verifiedFixes: ActionItem[] = conclusionData.recommendedFixes.map((f, idx) => ({
        id: `fix-${idx + 1}`,
        incidentId: incident.id,
        action: f.action,
        owner: f.owner,
        priority: f.priority,
        isVerified: true,
        remediationType: f.remediationType,
        targetAssetTag: targetAsset?.assetTag,
      }));

      report = {
        id: `rep-${session.id}`,
        incidentId: incident.id,
        executiveSummary: `Investigation completed for incident '${incident.title}'. Evaluated ${session.totalStepsExecuted} diagnostic observations. Confirmed root cause: ${conclusionData.rootCause}`,
        confirmedRootCause: conclusionData.rootCause,
        fiveWhys: [
          { whyNumber: 1, question: `Why did ${incident.title} occur?`, answer: conclusionData.rootCause },
          { whyNumber: 2, question: 'Why was this not detected earlier?', answer: 'Diagnostic evidence was masked until systematic verification of Layer 3/Layer 7 components.' },
        ],
        verifiedFixes,
        unverifiedRecommendations: [],
        signOffOperator: 'Diagnostic Engine (Deterministic Guided Mode)',
        evidenceSummary: session.evidence.map(e => `[${e.polarity}] ${e.summary}`).join('\n'),
        status: 'CONFIRMED',
        generatedAt: now,
        updatedAt: now,
      };
    }

    return {
      session,
      nextStep,
      recordedEvidence: newEvidence,
      auditEvents,
      hasContradiction,
      contradictionMessage,
      isFinished,
      stopReason,
      report,
    };
  }
}
