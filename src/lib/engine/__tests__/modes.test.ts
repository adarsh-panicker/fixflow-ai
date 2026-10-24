// src/lib/engine/__tests__/modes.test.ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentEngine } from '../agentEngine';
import { GuidedAdapter } from '../guidedAdapter';
import { DiagnosticEngine } from '../diagnosticEngine';
import { SafetyValidator, APPROVED_TOOLS } from '@/lib/ai/safetyValidator';
import { Incident, DiagnosticStep } from '@/types/incident';
import { Asset } from '@/types/asset';

// Mock test asset
const mockServer: Asset = {
  id: 'ast-srv-01',
  assetTag: 'SRV-PROD-01',
  name: 'Primary Production ERP Server',
  assetType: 'SERVER',
  hostname: 'erp-prod-01.corp.internal',
  ipAddress: '10.0.1.50',
  criticality: 'TIER_1_CRITICAL',
  status: 'DEGRADED',
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
};

const mockGateway: Asset = {
  id: 'ast-gw-01',
  assetTag: 'GW-CORE-01',
  name: 'Core Distribution Switch & Gateway',
  assetType: 'NETWORK_DEVICE',
  hostname: 'gw-core-01.corp.internal',
  ipAddress: '10.0.1.1',
  criticality: 'TIER_1_CRITICAL',
  status: 'OPERATIONAL',
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
};

function createTestIncident(mode: 'GUIDED' | 'AGENT' = 'GUIDED'): Incident {
  return {
    id: `inc-test-${Date.now()}`,
    ticketNumber: 'INC-2026-9001',
    title: 'ERP Production Server Unreachable',
    rawDescription: 'Production ERP server is completely unreachable and timing out on all connections.',
    category: 'INFRASTRUCTURE',
    severity: 'P1_CRITICAL',
    status: 'INVESTIGATING',
    diagnosticMode: mode,
    experienceLevel: 'Intermediate',
    targetAssetId: mockServer.id,
    targetAsset: mockServer,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDemo: false,
  };
}

describe('FixFlow AI - Diagnostic Modes (Guided & Agent)', () => {
  // =========================================================================
  // 1. Guided Mode Features & Adaptive Guidance
  // =========================================================================
  describe('1. Guided Mode Features & Adaptive Guidance', () => {
    test('tailors explanation for Beginner, Intermediate, and Advanced experience levels', () => {
      const step: DiagnosticStep = {
        id: 'step-1',
        stepId: 'step-srv-icmp',
        title: 'ICMP Echo Probe to Server IP',
        toolName: 'ping_icmp_probe',
        command: 'Test-Connection -TargetName 10.0.1.50 -Count 4',
        purpose: 'Verify basic Layer 3 network reachability and round-trip latency to the target server.',
        expectedResult: '4 replies received with 0% packet loss.',
        expectedOutput: '4 replies received with 0% packet loss.',
        possibleOutcomes: ['PASSED', 'FAILED', 'INCONCLUSIVE'],
        safetyClassification: 'SAFE_READ_ONLY',
        riskRating: 'SAFE_READ_ONLY',
        outcome: 'NOT_TESTED',
      };

      // Beginner
      const beginner = GuidedAdapter.getTailoredExplanation(step, 'Beginner');
      assert.strictEqual(beginner.detailLevel, 'Beginner');
      assert.ok(beginner.guidanceText.includes('Plain-English Goal'));
      assert.ok(beginner.safetyNote.includes('100% Safe & Read-Only'));
      assert.ok(beginner.whatToCheck.includes('Look at your terminal output'));

      // Intermediate
      const intermediate = GuidedAdapter.getTailoredExplanation(step, 'Intermediate');
      assert.strictEqual(intermediate.detailLevel, 'Intermediate');
      assert.ok(intermediate.badgeLabel.includes('Standard Triage'));
      assert.ok(intermediate.safetyNote.includes('Human-in-the-loop manual execution'));

      // Advanced
      const advanced = GuidedAdapter.getTailoredExplanation(step, 'Advanced');
      assert.strictEqual(advanced.detailLevel, 'Advanced');
      assert.strictEqual(advanced.guidanceText, step.purpose);
      assert.ok(advanced.whatToCheck.includes('Expected:'));
      assert.strictEqual(advanced.safetyNote, 'Read-only audit probe.');
    });

    test('generates accurate alternate branch predictions before step submission', () => {
      const incident = createTestIncident('GUIDED');
      const session = DiagnosticEngine.initializeSession(incident, mockServer, [mockGateway]);
      const currentStep = session.steps[0];

      assert.ok(currentStep, 'Initial step should exist');
      const preview = GuidedAdapter.getAlternateBranchesPreview(session, currentStep);

      assert.ok(preview.passedNext, 'Passed branch preview must be defined');
      assert.ok(preview.failedNext, 'Failed branch preview must be defined');
      assert.ok(preview.inconclusiveNext, 'Inconclusive branch preview must be defined');
    });

    test('manual technician escalation halts session and records audit event', () => {
      const incident = createTestIncident('GUIDED');
      const session = DiagnosticEngine.initializeSession(incident, mockServer, [mockGateway]);

      const { session: escalatedSession, auditEvent } = GuidedAdapter.escalateSession(
        session,
        'Physical cable cut suspected on-site',
        'Technician dispatched to server room 2B.'
      );

      assert.strictEqual(escalatedSession.status, 'ESCALATED');
      assert.strictEqual(escalatedSession.stopReason, 'MANUAL_ESCALATION');
      assert.strictEqual(auditEvent.eventType, 'SESSION_ESCALATED');
      assert.strictEqual(auditEvent.actor, 'USER');
      assert.ok(auditEvent.details.includes('Physical cable cut suspected on-site'));
    });
  });

  // =========================================================================
  // 2. Agent Mode Investigation Planning & Bounds
  // =========================================================================
  describe('2. Agent Mode Investigation Planning & Bounds', () => {
    test('generates initial bounded plan with maximum 6 steps per planning cycle', () => {
      const incident = createTestIncident('AGENT');
      const { session, proposedPlan, reasoning } = AgentEngine.generateInitialPlan(
        incident,
        mockServer,
        [mockGateway]
      );

      assert.strictEqual(session.mode, 'AGENT');
      assert.ok(proposedPlan.length > 0, 'Plan should contain diagnostic steps');
      assert.ok(
        proposedPlan.length <= AgentEngine.MAX_CYCLE_STEPS,
        `Plan must not exceed max ${AgentEngine.MAX_CYCLE_STEPS} steps per cycle`
      );
      assert.ok(reasoning.length > 0, 'Reasoning must be provided');
      assert.strictEqual(session.planRevisions?.length, 1);
      assert.strictEqual(session.planRevisions[0].cycleNumber, 1);
    });

    test('every step in proposed plan uses an approved read-only tool from the allowlist', () => {
      const incident = createTestIncident('AGENT');
      const { proposedPlan } = AgentEngine.generateInitialPlan(incident, mockServer, [mockGateway]);

      for (const step of proposedPlan) {
        if (step.toolName) {
          const isApproved = APPROVED_TOOLS.includes(step.toolName as any);
          assert.ok(isApproved, `Tool '${step.toolName}' must be present in APPROVED_TOOLS`);
        }
        const safety = SafetyValidator.validateCommand(step.toolName || '', step.command);
        assert.ok(safety.isSafe, `Step '${step.title}' command must be safe and read-only`);
      }
    });
  });

  // =========================================================================
  // 3. Dynamic Plan Revision & Adaptive Traversal
  // =========================================================================
  describe('3. Dynamic Plan Revision & Adaptive Traversal', () => {
    test('revises plan, prunes obsolete steps, and logs revision changelog when evidence contradicts initial hypothesis', () => {
      const incident = createTestIncident('AGENT');
      const { session } = AgentEngine.generateInitialPlan(incident, mockServer, [mockGateway]);

      // Step 1: Intake clarifying question
      const q1Step = session.steps[0];
      const q1Result = AgentEngine.executeStepAndRevisePlan(
        session,
        incident,
        q1Step.id,
        'PASSED',
        'Server unreachable from all management workstations.',
        'Intake confirmed global failure.',
        mockServer,
        [mockGateway]
      );

      // Next step should be ICMP probe
      const icmpStep = q1Result.session.steps.find(s => s.stepId === 'step-srv-icmp') || q1Result.currentStep!;
      assert.ok(icmpStep, 'Should advance to ICMP probe step');

      // Record ICMP probe PASSED (contradicting initial hypothesis of gateway link failure)
      const icmpResult = AgentEngine.executeStepAndRevisePlan(
        q1Result.session,
        incident,
        icmpStep.id,
        'PASSED',
        '4 packets transmitted, 4 received, 0% packet loss.',
        'Host is reachable at Layer 3; switching branch to Layer 4 port check.',
        mockServer,
        [mockGateway]
      );

      // Verify Plan Revision was logged
      assert.ok(
        icmpResult.session.planRevisions && icmpResult.session.planRevisions.length >= 2,
        'Should record a new plan revision following branch change'
      );

      const latestRev = icmpResult.session.planRevisions![icmpResult.session.planRevisions!.length - 1];
      assert.strictEqual(latestRev.triggerOutcome, 'PASSED');
      assert.ok(latestRev.reasoning.includes('Evidence from'));
      assert.ok(latestRev.stepsPruned.length > 0, 'Obsolete gateway steps must be pruned');
      assert.ok(latestRev.stepsAdded.length > 0, 'New port check step must be added');

      // Next step should be TCP management port
      const nextStep = icmpResult.session.steps[icmpResult.session.currentStepIndex] || icmpResult.currentStep;
      assert.ok(nextStep, 'Should recommend next step');
      assert.strictEqual(nextStep?.stepId, 'step-srv-tcp-mgmt');
    });
  });

  // =========================================================================
  // 4. Safety Invariants: Loop Prevention & Tool Whitelisting
  // =========================================================================
  describe('4. Safety Invariants: Loop Prevention & Tool Whitelisting', () => {
    test('detects and strips duplicate commands from proposed plan', () => {
      const incident = createTestIncident('AGENT');
      const { session } = AgentEngine.generateInitialPlan(incident, mockServer, [mockGateway]);

      // Manually inject a proposed step with an already executed command
      const executedCommand = 'Test-Connection -TargetName 10.0.1.50 -Count 4';
      session.steps.push({
        id: 'step-exec-1',
        stepId: 'step-srv-icmp',
        title: 'ICMP Echo Probe to Server IP',
        toolName: 'ping_icmp_probe',
        command: executedCommand,
        purpose: 'Verify L3 reachability',
        expectedResult: 'Success',
        possibleOutcomes: ['PASSED', 'FAILED'],
        safetyClassification: 'SAFE_READ_ONLY',
        outcome: 'FAILED',
      });

      // Inject duplicate command into proposedPlan
      session.proposedPlan = [
        {
          id: 'step-dup-1',
          stepId: 'step-srv-icmp-dup',
          title: 'Duplicate ICMP Probe',
          toolName: 'ping_icmp_probe',
          command: executedCommand,
          purpose: 'Duplicate check',
          expectedResult: 'Success',
          possibleOutcomes: ['PASSED', 'FAILED'],
          safetyClassification: 'SAFE_READ_ONLY',
          outcome: 'NOT_TESTED',
        },
        {
          id: 'step-unique-1',
          stepId: 'step-srv-gateway',
          title: 'Test Default Gateway',
          toolName: 'ping_icmp_probe',
          command: 'Test-Connection -TargetName 10.0.1.1 -Count 4',
          purpose: 'Check gateway link',
          expectedResult: 'Replies received',
          possibleOutcomes: ['PASSED', 'FAILED'],
          safetyClassification: 'SAFE_READ_ONLY',
          outcome: 'NOT_TESTED',
        },
      ];

      // Execute a step and verify the duplicate was pruned
      const stepToExecute = session.steps[0];
      const result = AgentEngine.executeStepAndRevisePlan(
        session,
        incident,
        stepToExecute.id,
        'PASSED',
        'Output ok',
        'Notes',
        mockServer,
        [mockGateway]
      );

      const hasDuplicate = result.session.proposedPlan?.some(
        s => s.command.toLowerCase().trim() === executedCommand.toLowerCase().trim()
      );
      assert.strictEqual(hasDuplicate, false, 'Duplicate command must be pruned from remaining plan');
    });

    test('strictly rejects dangerous shell operations and unapproved tools', () => {
      const dangerousCommands = [
        { tool: 'shell_exec', cmd: 'rm -rf /' },
        { tool: 'powershell_exec', cmd: 'Remove-Item -Recurse -Force C:\\Windows' },
        { tool: 'bash_exec', cmd: 'sudo reboot' },
        { tool: 'netsh_exec', cmd: 'netsh interface set interface "Ethernet" admin=disable' },
        { tool: 'sql_exec', cmd: 'DROP TABLE assets;' },
      ];

      for (const dangerous of dangerousCommands) {
        const safety = SafetyValidator.validateCommand(dangerous.tool, dangerous.cmd);
        assert.strictEqual(safety.isSafe, false, `Command '${dangerous.cmd}' must be rejected by SafetyValidator`);
        assert.ok(safety.violations.length > 0, `Violations must be reported for '${dangerous.cmd}'`);
      }
    });

    test('enforces configurable session budget limit and stops cleanly with SESSION_BUDGET_EXHAUSTED', () => {
      const incident = createTestIncident('AGENT');
      const { session } = AgentEngine.generateInitialPlan(incident, mockServer, [mockGateway]);

      // Set budget limit to 2 steps
      session.sessionBudgetMax = 2;
      session.totalStepsExecuted = 1;

      const q1Step = session.steps[0];
      const result = AgentEngine.executeStepAndRevisePlan(
        session,
        incident,
        q1Step.id,
        'PASSED',
        'Intake completed',
        'Step 2 of 2',
        mockServer,
        [mockGateway]
      );

      assert.strictEqual(result.isFinished, true, 'Investigation must stop when budget limit is reached');
      assert.strictEqual(result.stopReason, 'SESSION_BUDGET_EXHAUSTED');
      assert.ok(['STOPPED', 'ESCALATED'].includes(result.session.status));
    });
  });

  // =========================================================================
  // 5. Mode Switching & State Preservation
  // =========================================================================
  describe('5. Mode Switching & State Preservation', () => {
    test('switching between GUIDED and AGENT retains 100% of session evidence, hypotheses, and timeline', () => {
      const incident = createTestIncident('GUIDED');
      let session = DiagnosticEngine.initializeSession(incident, mockServer, [mockGateway]);

      // Execute Step 1 in Guided Mode
      const step1 = session.steps[0];
      const step1Result = DiagnosticEngine.recordStepResult(
        session,
        incident,
        step1.id,
        'PASSED',
        'Intake verified',
        'Notes 1',
        mockServer,
        [mockGateway]
      );
      session = step1Result.session;

      const evidenceCountBefore = session.evidence.length;
      const initialHypotheses = JSON.stringify(session.hypotheses);
      const executedStepsBefore = session.steps.length;

      // Switch to AGENT Mode
      session = AgentEngine.switchMode(session, 'AGENT', mockServer, [mockGateway]);
      assert.strictEqual(session.mode, 'AGENT');
      assert.strictEqual(session.evidence.length, evidenceCountBefore, 'Evidence count must be preserved');
      assert.strictEqual(JSON.stringify(session.hypotheses), initialHypotheses, 'Hypotheses must be preserved');
      assert.strictEqual(session.steps.length, executedStepsBefore, 'Executed steps must be preserved');
      assert.ok(session.proposedPlan && session.proposedPlan.length > 0, 'Proposed plan should be populated');

      // Switch back to GUIDED Mode
      session = AgentEngine.switchMode(session, 'GUIDED', mockServer, [mockGateway]);
      assert.strictEqual(session.mode, 'GUIDED');
      assert.strictEqual(session.evidence.length, evidenceCountBefore, 'Evidence count must be preserved');
      assert.strictEqual(JSON.stringify(session.hypotheses), initialHypotheses, 'Hypotheses must be preserved');
    });

    test('preserves investigation state across serialization and rehydration', () => {
      const incident = createTestIncident('AGENT');
      const { session } = AgentEngine.generateInitialPlan(incident, mockServer, [mockGateway]);

      // Record a step result
      const step1 = session.steps[0];
      const result = AgentEngine.executeStepAndRevisePlan(
        session,
        incident,
        step1.id,
        'PASSED',
        'Verified global reachability issue',
        'Field notes saved',
        mockServer,
        [mockGateway]
      );

      // Serialize (simulating navigating away / repository JSON storage)
      const serialized = JSON.stringify(result.session);
      const rehydrated = JSON.parse(serialized);

      // Verify rehydrated session
      assert.strictEqual(rehydrated.id, result.session.id);
      assert.strictEqual(rehydrated.evidence.length, result.session.evidence.length);
      assert.strictEqual(rehydrated.hypotheses.length, result.session.hypotheses.length);
      assert.strictEqual(rehydrated.steps.length, result.session.steps.length);
      assert.strictEqual(rehydrated.planRevisions.length, result.session.planRevisions?.length);
      assert.strictEqual(rehydrated.mode, 'AGENT');
    });
  });

  // =========================================================================
  // 6. Guided vs Agent Consistency
  // =========================================================================
  describe('6. Guided vs Agent Consistency', () => {
    test('same diagnostic path produces identical root cause and hypothesis outcomes in Guided and Agent modes', () => {
      // 1. Run Scenario in Guided Mode
      const guidedIncident = createTestIncident('GUIDED');
      let guidedSession = DiagnosticEngine.initializeSession(guidedIncident, mockServer, [mockGateway]);

      // Q1: PASSED
      const gQ1 = DiagnosticEngine.recordStepResult(
        guidedSession,
        guidedIncident,
        guidedSession.steps[0].id,
        'PASSED',
        'Scope verified',
        '',
        mockServer,
        [mockGateway]
      );
      guidedSession = gQ1.session;

      // Ping: FAILED
      const gIcmp = DiagnosticEngine.recordStepResult(
        guidedSession,
        guidedIncident,
        guidedSession.steps[guidedSession.steps.length - 1].id,
        'FAILED',
        'Timeout',
        '',
        mockServer,
        [mockGateway]
      );
      guidedSession = gIcmp.session;

      // Gateway: FAILED (Identifies gateway root cause)
      const gGateway = DiagnosticEngine.recordStepResult(
        guidedSession,
        guidedIncident,
        guidedSession.steps[guidedSession.steps.length - 1].id,
        'FAILED',
        'Gateway 10.0.1.1 unreachable',
        '',
        mockServer,
        [mockGateway]
      );
      guidedSession = gGateway.session;

      // 2. Run Scenario in Agent Mode
      const agentIncident = createTestIncident('AGENT');
      const { session: initialAgentSession } = AgentEngine.generateInitialPlan(agentIncident, mockServer, [mockGateway]);
      let agentSession = initialAgentSession;

      // Q1: PASSED
      const aQ1 = AgentEngine.executeStepAndRevisePlan(
        agentSession,
        agentIncident,
        agentSession.steps[0].id,
        'PASSED',
        'Scope verified',
        '',
        mockServer,
        [mockGateway]
      );
      agentSession = aQ1.session;

      // Ping: FAILED
      const aIcmp = AgentEngine.executeStepAndRevisePlan(
        agentSession,
        agentIncident,
        agentSession.steps[agentSession.steps.length - 1].id,
        'FAILED',
        'Timeout',
        '',
        mockServer,
        [mockGateway]
      );
      agentSession = aIcmp.session;

      // Gateway: FAILED (Identifies gateway root cause)
      const aGateway = AgentEngine.executeStepAndRevisePlan(
        agentSession,
        agentIncident,
        agentSession.steps[agentSession.steps.length - 1].id,
        'FAILED',
        'Gateway 10.0.1.1 unreachable',
        '',
        mockServer,
        [mockGateway]
      );
      agentSession = aGateway.session;

      // Assert Consistency
      assert.strictEqual(
        guidedSession.status,
        agentSession.status,
        'Session final status must match across modes'
      );
      assert.strictEqual(
        guidedSession.stopReason,
        agentSession.stopReason,
        'Stop reason must match across modes'
      );
      assert.strictEqual(
        guidedSession.evidence.length,
        agentSession.evidence.length,
        'Evidence count must match across modes'
      );

      // Compare top hypothesis
      const guidedTopHyp = guidedSession.hypotheses.reduce((prev, curr) =>
        curr.confidenceScore > prev.confidenceScore ? curr : prev
      );
      const agentTopHyp = agentSession.hypotheses.reduce((prev, curr) =>
        curr.confidenceScore > prev.confidenceScore ? curr : prev
      );

      assert.strictEqual(guidedTopHyp.title, agentTopHyp.title, 'Top confirmed hypothesis must be identical');
      assert.strictEqual(guidedTopHyp.status, agentTopHyp.status, 'Top hypothesis status must match');
      assert.strictEqual(
        Math.round(guidedTopHyp.confidenceScore * 100),
        Math.round(agentTopHyp.confidenceScore * 100),
        'Confidence score must be consistent'
      );
    });
  });
});
