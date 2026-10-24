// src/lib/engine/agentEngine.ts
import {
  Incident,
  DiagnosticSession,
  DiagnosticStep,
  StepOutcome,
  PlanRevision,
  ResolutionReport,
  AuditEvent,
} from '@/types/incident';
import { Asset } from '@/types/asset';
import { DiagnosticEngine } from './diagnosticEngine';
import { SCENARIO_REGISTRY } from './scenarios';
import { SafetyValidator } from '@/lib/ai/safetyValidator';

export interface AgentPlanProposal {
  cycleNumber: number;
  steps: DiagnosticStep[];
  reasoning: string;
  isBudgetExhausted: boolean;
  loopDetected: boolean;
}

export interface AgentStepExecutionResult {
  session: DiagnosticSession;
  executedStep: DiagnosticStep;
  currentStep: DiagnosticStep | null;
  planRevision?: PlanRevision;
  isFinished: boolean;
  stopReason?: string;
  report?: ResolutionReport;
  auditEvents: AuditEvent[];
}

export class AgentEngine {
  public static readonly MAX_CYCLE_STEPS = 6;
  public static readonly DEFAULT_SESSION_BUDGET = 12;

  /**
   * Generates a bounded, sequence-ordered proposed investigation plan (max 6 steps per cycle)
   */
  public static generateInitialPlan(
    incident: Incident,
    targetAsset?: Asset | null,
    confirmedDependencies: Asset[] = []
  ): { session: DiagnosticSession; proposedPlan: DiagnosticStep[]; reasoning: string } {
    const session = DiagnosticEngine.initializeSession(incident, targetAsset, confirmedDependencies);
    session.mode = 'AGENT';
    session.sessionBudgetMax = session.sessionBudgetMax || this.DEFAULT_SESSION_BUDGET;

    const matchedScenario = session.scenarioId ? SCENARIO_REGISTRY[session.scenarioId] : null;
    const proposedPlan: DiagnosticStep[] = [];
    const reasoning = matchedScenario
      ? `Agent analyzed incident symptoms and correlated with target asset '${targetAsset?.assetTag || 'infrastructure'}'. Proposed initial diagnostic sequence prioritizing Layer 3/Layer 4 reachability before application inspection.`
      : 'Agent generated baseline diagnostic sequence for manual triage and symptom isolation.';

    if (matchedScenario) {
      // Pick initial step plus up to 5 subsequent steps from primary diagnostic tree
      const seenStepIds = new Set<string>();

      // 1. Initial Step
      if (session.steps.length > 0) {
        proposedPlan.push(session.steps[0]);
        seenStepIds.add(session.steps[0].stepId);
      }

      // 2. Traverse expected progression for primary hypothesis
      let currentStepId = session.steps[0]?.stepId;
      while (proposedPlan.length < this.MAX_CYCLE_STEPS && currentStepId) {
        const stepDef = matchedScenario.steps[currentStepId];
        if (!stepDef) break;

        // Traverse primary branch (e.g. FAILED rule or first rule)
        const nextRule = stepDef.nextRules.find(r => r.nextStepId && !seenStepIds.has(r.nextStepId));
        if (nextRule && nextRule.nextStepId && matchedScenario.steps[nextRule.nextStepId]) {
          const nextDef = matchedScenario.steps[nextRule.nextStepId];
          seenStepIds.add(nextDef.stepId);

          const step: DiagnosticStep = {
            id: `step-plan-${proposedPlan.length + 1}-${Date.now()}`,
            stepId: nextDef.stepId,
            title: nextDef.title,
            question: nextDef.question,
            toolName: nextDef.toolName,
            command: DiagnosticEngine.interpolateCommand(nextDef.commandTemplate, targetAsset, confirmedDependencies),
            purpose: nextDef.purpose,
            expectedResult: nextDef.expectedResult,
            expectedOutput: nextDef.expectedResult,
            possibleOutcomes: nextDef.possibleOutcomes,
            safetyClassification: nextDef.safetyClassification,
            riskRating: 'SAFE_READ_ONLY',
            requiresApproval: nextDef.requiresApproval || false,
            outcome: 'NOT_TESTED',
            orderIndex: proposedPlan.length,
            isClarifyingQuestion: nextDef.isClarifyingQuestion || false,
            isSimulatedDemo: incident.isDemo || false,
          };

          // Validate safety before adding to plan
          const safety = SafetyValidator.validateCommand(step.toolName || '', step.command);
          if (safety.isSafe) {
            proposedPlan.push(step);
          }
          currentStepId = nextDef.stepId;
        } else {
          break;
        }
      }
    } else {
      proposedPlan.push(...session.steps);
    }

    session.proposedPlan = proposedPlan;
    session.planRevisions = [
      {
        id: `rev-init-${Date.now()}`,
        cycleNumber: 1,
        triggerStepId: 'INIT',
        triggerOutcome: 'NOT_TESTED',
        reasoning,
        stepsAdded: proposedPlan.map(s => s.title),
        stepsPruned: [],
        timestamp: new Date().toISOString(),
      },
    ];

    return { session, proposedPlan, reasoning };
  }

  /**
   * Reassesses evidence and revises the remaining proposed plan when an observation contradicts or changes hypothesis priority
   */
  public static executeStepAndRevisePlan(
    session: DiagnosticSession,
    incident: Incident,
    stepId: string,
    outcome: StepOutcome,
    observedOutput: string = '',
    technicianNotes: string = '',
    targetAsset?: Asset | null,
    confirmedDependencies: Asset[] = [],
    isSimulatedDemo: boolean = false
  ): AgentStepExecutionResult {
    const auditEvents: AuditEvent[] = [];
    const now = new Date().toISOString();

    // 1. Record Result via Shared Engine (Hypothesis recalculation & evidence recording)
    const evalResult = DiagnosticEngine.recordStepResult(
      session,
      incident,
      stepId,
      outcome,
      observedOutput,
      technicianNotes,
      targetAsset,
      confirmedDependencies,
      isSimulatedDemo
    );

    auditEvents.push(...evalResult.auditEvents);

    const executedStep = session.steps.find(s => s.id === stepId || s.stepId === stepId)!;

    // 2. Check if Terminal Condition Reached
    if (evalResult.isFinished) {
      session.proposedPlan = [];
      return {
        session: evalResult.session,
        executedStep,
        currentStep: null,
        isFinished: true,
        stopReason: evalResult.stopReason,
        report: evalResult.report,
        auditEvents,
      };
    }

    // 3. Plan Revision & Adaptation: Re-evaluate remaining proposed steps
    const remainingPlan = (session.proposedPlan || []).filter(
      p => p.id !== stepId && p.stepId !== executedStep.stepId && p.outcome === 'NOT_TESTED'
    );

    const stepsPruned: string[] = [];
    const stepsAdded: string[] = [];
    let revisionReason = '';

    const matchedScenario = session.scenarioId ? SCENARIO_REGISTRY[session.scenarioId] : null;

    if (matchedScenario && evalResult.nextStep) {
      // Check if next recommended step is already in remaining plan
      const nextStepIndex = remainingPlan.findIndex(p => p.stepId === evalResult.nextStep?.stepId);

      if (nextStepIndex === -1) {
        // Evidence contradicted or switched branch!
        // Prune obsolete steps that were on the alternate branch
        remainingPlan.forEach(p => stepsPruned.push(p.title));
        remainingPlan.length = 0; // Prune old branch

        // Append new optimal step
        remainingPlan.push(evalResult.nextStep);
        stepsAdded.push(evalResult.nextStep.title);

        revisionReason = `Evidence from '${executedStep.title}' recorded ${outcome}. Switched diagnostic branch to '${evalResult.nextStep.title}'.`;
      } else {
        revisionReason = `Observation confirmed path. Proceeding with planned sequence.`;
      }
    }

    // 4. Duplicate-Action & Loop Prevention: Strip duplicate steps already executed
    const executedCommandSet = new Set(
      session.steps.filter(s => s.outcome !== 'NOT_TESTED').map(s => s.command.toLowerCase().trim())
    );

    const deduplicatedRemaining = remainingPlan.filter(step => {
      const isDuplicate = executedCommandSet.has(step.command.toLowerCase().trim());
      if (isDuplicate) {
        stepsPruned.push(`${step.title} (Duplicate Action)`);
      }
      return !isDuplicate;
    });

    // Enforce 6-step cycle bound
    const boundedPlan = deduplicatedRemaining.slice(0, this.MAX_CYCLE_STEPS);

    session.proposedPlan = boundedPlan;

    // 5. Check Overall Session Budget Limit
    let isFinished = false;
    let stopReason: string | undefined;

    if (session.totalStepsExecuted >= session.sessionBudgetMax) {
      isFinished = true;
      stopReason = 'SESSION_BUDGET_EXHAUSTED';
      session.status = 'STOPPED';
      session.stopReason = stopReason;
    } else if (boundedPlan.length === 0 && !evalResult.nextStep) {
      isFinished = true;
      stopReason = outcome === 'INCONCLUSIVE' ? 'ESCALATION_REQUIRED' : 'ROOT_CAUSE_IDENTIFIED';
      session.status = stopReason === 'ROOT_CAUSE_IDENTIFIED' ? 'COMPLETED' : 'ESCALATED';
      session.stopReason = stopReason;
    }

    // 6. Record Plan Revision in Timeline
    let planRevision: PlanRevision | undefined;
    if (stepsAdded.length > 0 || stepsPruned.length > 0 || revisionReason) {
      const cycleNumber = (session.planRevisions?.length || 0) + 1;
      planRevision = {
        id: `rev-${cycleNumber}-${Date.now()}`,
        cycleNumber,
        triggerStepId: executedStep.stepId,
        triggerOutcome: outcome,
        reasoning: revisionReason || `Plan adapted following ${outcome} result.`,
        stepsAdded,
        stepsPruned,
        timestamp: now,
      };

      session.planRevisions = [...(session.planRevisions || []), planRevision];

      auditEvents.push({
        id: `aud-rev-${Date.now()}`,
        sessionId: session.id,
        incidentId: incident.id,
        timestamp: now,
        eventType: stepsAdded.length > 0 || stepsPruned.length > 0 ? 'BRANCH_SWITCHED' : 'STEP_EXECUTED',
        actor: 'DIAGNOSTIC_ENGINE',
        details: `Agent Mode revised investigation plan: ${planRevision.reasoning}`,
        metadata: { stepsAdded, stepsPruned, cycleNumber },
      });
    }

    const currentStep = boundedPlan[0] || null;

    return {
      session,
      executedStep,
      currentStep,
      planRevision,
      isFinished,
      stopReason,
      report: evalResult.report,
      auditEvents,
    };
  }

  /**
   * Mode Switching: Seamlessly toggle between GUIDED and AGENT without losing investigation state
   */
  public static switchMode(
    session: DiagnosticSession,
    targetMode: 'GUIDED' | 'AGENT',
    targetAsset?: Asset | null,
    confirmedDependencies: Asset[] = []
  ): DiagnosticSession {
    session.mode = targetMode;
    session.updatedAt = new Date().toISOString();

    if (targetMode === 'AGENT') {
      const remaining = session.steps.filter(s => s.outcome === 'NOT_TESTED');
      const plan: DiagnosticStep[] = [...remaining];

      const matchedScenario = session.scenarioId ? SCENARIO_REGISTRY[session.scenarioId] : null;
      if (matchedScenario && plan.length > 0 && plan.length < this.MAX_CYCLE_STEPS) {
        const seenStepIds = new Set<string>(session.steps.map(s => s.stepId));
        let currentStepId = plan[plan.length - 1]?.stepId;

        while (plan.length < this.MAX_CYCLE_STEPS && currentStepId) {
          const stepDef = matchedScenario.steps[currentStepId];
          if (!stepDef) break;

          const nextRule = stepDef.nextRules.find(r => r.nextStepId && !seenStepIds.has(r.nextStepId));
          if (nextRule && nextRule.nextStepId && matchedScenario.steps[nextRule.nextStepId]) {
            const nextDef = matchedScenario.steps[nextRule.nextStepId];
            seenStepIds.add(nextDef.stepId);

            const step: DiagnosticStep = {
              id: `step-plan-${plan.length + 1}-${Date.now()}`,
              stepId: nextDef.stepId,
              title: nextDef.title,
              question: nextDef.question,
              toolName: nextDef.toolName,
              command: DiagnosticEngine.interpolateCommand(nextDef.commandTemplate, targetAsset, confirmedDependencies),
              purpose: nextDef.purpose,
              expectedResult: nextDef.expectedResult,
              expectedOutput: nextDef.expectedResult,
              possibleOutcomes: nextDef.possibleOutcomes,
              safetyClassification: nextDef.safetyClassification,
              riskRating: 'SAFE_READ_ONLY',
              requiresApproval: nextDef.requiresApproval || false,
              outcome: 'NOT_TESTED',
              orderIndex: plan.length,
              isClarifyingQuestion: nextDef.isClarifyingQuestion || false,
              isSimulatedDemo: false,
            };

            const safety = SafetyValidator.validateCommand(step.toolName || '', step.command);
            if (safety.isSafe) {
              plan.push(step);
            }
            currentStepId = nextDef.stepId;
          } else {
            break;
          }
        }
      }
      session.proposedPlan = plan.slice(0, this.MAX_CYCLE_STEPS);
    }

    return session;
  }
}
