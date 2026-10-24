// src/lib/engine/guidedAdapter.ts
import { DiagnosticStep, DiagnosticSession, ExperienceLevel, AuditEvent } from '@/types/incident';
import { SCENARIO_REGISTRY } from './scenarios';

export interface BranchPreview {
  passedNext: string;
  failedNext: string;
  inconclusiveNext: string;
}

export interface TailoredStepView {
  badgeLabel: string;
  guidanceText: string;
  whatToCheck: string;
  safetyNote: string;
  detailLevel: ExperienceLevel;
}

export class GuidedAdapter {
  /**
   * Adapts technical instructions for Beginner, Intermediate, and Advanced technicians
   */
  public static getTailoredExplanation(
    step: DiagnosticStep,
    experience: ExperienceLevel = 'Intermediate'
  ): TailoredStepView {
    if (experience === 'Beginner') {
      return {
        badgeLabel: 'Beginner Guidance',
        guidanceText: `Plain-English Goal: ${step.purpose}. This test checks whether the system can talk to the target device without making any changes.`,
        whatToCheck: `Look at your terminal output. If it succeeds, you should see: "${step.expectedResult || step.expectedOutput}". If you see an error like "timed out", "unreachable", or "access denied", select Failed.`,
        safetyNote: '100% Safe & Read-Only. This command cannot delete files, restart services, or alter configurations.',
        detailLevel: 'Beginner',
      };
    }

    if (experience === 'Advanced') {
      return {
        badgeLabel: 'Advanced Minimalist',
        guidanceText: step.purpose,
        whatToCheck: `Expected: ${step.expectedResult || step.expectedOutput || 'ExitCode 0'}`,
        safetyNote: 'Read-only audit probe.',
        detailLevel: 'Advanced',
      };
    }

    // Default: Intermediate
    return {
      badgeLabel: 'Standard Triage',
      guidanceText: `${step.purpose} Evaluates transport and operational status on target asset.`,
      whatToCheck: `Verify terminal response against standard baseline: ${step.expectedResult || step.expectedOutput}`,
      safetyNote: 'Standard read-only diagnostic command. Human-in-the-loop manual execution.',
      detailLevel: 'Intermediate',
    };
  }

  /**
   * Generates a preview of what the decision tree will recommend for Passed vs Failed
   */
  public static getAlternateBranchesPreview(
    session: DiagnosticSession,
    currentStep: DiagnosticStep
  ): BranchPreview {
    const scenario = session.scenarioId ? SCENARIO_REGISTRY[session.scenarioId] : null;

    if (!scenario) {
      return {
        passedNext: 'Advance to next symptom probe',
        failedNext: 'Escalate to Tier 3 engineering',
        inconclusiveNext: 'Gather additional intake telemetry',
      };
    }

    const stepDef = scenario.steps[currentStep.stepId];
    if (!stepDef) {
      return {
        passedNext: 'Proceed to next diagnostic verification',
        failedNext: 'Isolate root cause',
        inconclusiveNext: 'Escalate',
      };
    }

    const passedRule = stepDef.nextRules.find(r => r.outcome === 'PASSED') || stepDef.nextRules.find(r => r.outcome === '*');
    const failedRule = stepDef.nextRules.find(r => r.outcome === 'FAILED') || stepDef.nextRules.find(r => r.outcome === '*');
    const incRule = stepDef.nextRules.find(r => r.outcome === 'INCONCLUSIVE') || stepDef.nextRules.find(r => r.outcome === '*');

    const passedNext = passedRule?.conclusion
      ? `Root Cause Isolated: ${passedRule.conclusion.rootCause}`
      : passedRule?.nextStepId && scenario.steps[passedRule.nextStepId]
      ? scenario.steps[passedRule.nextStepId].title
      : 'Complete diagnostic branch';

    const failedNext = failedRule?.conclusion
      ? `Root Cause Isolated: ${failedRule.conclusion.rootCause}`
      : failedRule?.nextStepId && scenario.steps[failedRule.nextStepId]
      ? scenario.steps[failedRule.nextStepId].title
      : 'Complete diagnostic branch';

    const inconclusiveNext = incRule?.conclusion
      ? `Escalate: ${incRule.conclusion.rootCause}`
      : incRule?.nextStepId && scenario.steps[incRule.nextStepId]
      ? scenario.steps[incRule.nextStepId].title
      : 'Escalate to Senior Engineer';

    return {
      passedNext,
      failedNext,
      inconclusiveNext,
    };
  }

  /**
   * Manual technician escalation
   */
  public static escalateSession(
    session: DiagnosticSession,
    reason: string,
    technicianNotes?: string
  ): { session: DiagnosticSession; auditEvent: AuditEvent } {
    const now = new Date().toISOString();
    session.status = 'ESCALATED';
    session.sessionStatus = 'ESCALATED';
    session.stopReason = 'MANUAL_ESCALATION';
    session.updatedAt = now;

    const auditEvent: AuditEvent = {
      id: `aud-esc-${Date.now()}`,
      sessionId: session.id,
      timestamp: now,
      eventType: 'SESSION_ESCALATED',
      actor: 'USER',
      details: `Technician manually escalated incident: ${reason}. Notes: ${technicianNotes || 'None'}`,
      metadata: { reason, technicianNotes },
    };

    return { session, auditEvent };
  }
}
