// src/lib/engine/__tests__/diagnosticEngine.test.ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DiagnosticEngine } from '../diagnosticEngine';
import {
  SCENARIO_SERVER_UNREACHABLE,
  SCENARIO_PRINTER_UNAVAILABLE,
  SCENARIO_SHARED_FILE_INACCESSIBLE,
  SCENARIO_DNS_FAILURE,
  SCENARIO_WINDOWS_SERVICE_FAILURE,
} from '../scenarios';
import { Incident } from '@/types/incident';
import { Asset } from '@/types/asset';

// Sample Mock Assets
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

const mockPrinterAsset: Asset = {
  id: 'ast-prt-01',
  assetTag: 'PRT-EXEC-02',
  name: 'Floor 3 Executive Printer',
  assetType: 'PRINTER',
  hostname: 'prt-exec-02.corp.internal',
  ipAddress: '10.0.4.15',
  criticality: 'TIER_3_MEDIUM',
  status: 'OFFLINE',
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
};

const mockShareAsset: Asset = {
  id: 'ast-shr-01',
  assetTag: 'NAS-FIN-SHARE',
  name: 'Finance Shared Documents Volume',
  assetType: 'SHARED_FOLDER',
  hostname: 'nas-storage-01.corp.internal',
  ipAddress: '10.0.2.80',
  criticality: 'TIER_2_HIGH',
  status: 'OPERATIONAL',
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
};

const mockDnsServerAsset: Asset = {
  id: 'ast-dns-01',
  assetTag: 'DC-DNS-01',
  name: 'Primary Domain Controller & DNS',
  assetType: 'SERVER',
  hostname: 'dc-dns-01.corp.internal',
  ipAddress: '10.0.1.10',
  criticality: 'TIER_1_CRITICAL',
  status: 'OPERATIONAL',
  tags: 'dns,ad',
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
};

describe('Diagnostic Troubleshooting Engine', () => {
  // =========================================================================
  // 1. Scenario Matching & Intake Validation
  // =========================================================================
  describe('1. Scenario Matching & Missing Information Detection', () => {
    test('accurately matches incident keywords to all 5 scenarios', () => {
      // 1. Server unreachable
      const srvMatch = DiagnosticEngine.matchScenario({
        title: 'Application server unreachable and timeout',
        rawDescription: 'Users report ping failed to ERP server.',
        targetAsset: mockServerAsset,
      });
      assert.equal(srvMatch?.id, SCENARIO_SERVER_UNREACHABLE.id);

      // 2. Printer stuck
      const prtMatch = DiagnosticEngine.matchScenario({
        title: 'Floor 3 printer offline and print queue deadlocked',
        rawDescription: 'Spooler is holding jobs, cannot print invoices.',
        targetAsset: mockPrinterAsset,
      });
      assert.equal(prtMatch?.id, SCENARIO_PRINTER_UNAVAILABLE.id);

      // 3. Share inaccessible
      const shrMatch = DiagnosticEngine.matchScenario({
        title: 'Shared folder access denied on finance UNC path',
        rawDescription: 'Client receives network path not found 0x80070035 connecting to SMB share.',
        targetAsset: mockShareAsset,
      });
      assert.equal(shrMatch?.id, SCENARIO_SHARED_FILE_INACCESSIBLE.id);

      // 4. DNS resolution failure
      const dnsMatch = DiagnosticEngine.matchScenario({
        title: 'DNS resolution failure for internal host',
        rawDescription: 'Resolve-DnsName and nslookup cannot resolve accounting portal FQDN.',
      });
      assert.equal(dnsMatch?.id, SCENARIO_DNS_FAILURE.id);

      // 5. Windows service failure
      const svcMatch = DiagnosticEngine.matchScenario({
        title: 'Windows service crash with event 7034',
        rawDescription: 'The database listener service failed to start on boot.',
      });
      assert.equal(svcMatch?.id, SCENARIO_WINDOWS_SERVICE_FAILURE.id);
    });

    test('detects missing target asset or brief description', () => {
      const missing = DiagnosticEngine.detectMissingInformation({
        title: 'It is broken',
        rawDescription: 'help',
      });
      assert.equal(missing.isMissing, true);
      assert.ok(missing.reason?.includes('Target IT asset is not specified'));

      const valid = DiagnosticEngine.detectMissingInformation(
        {
          title: 'Database connection failure',
          rawDescription: 'The production SQL cluster stopped responding to queries on port 1433.',
          targetAssetId: 'ast-srv-01',
        },
        mockServerAsset
      );
      assert.equal(valid.isMissing, false);
    });

    test('gracefully handles unsupported issues without throwing', () => {
      const unsupported = DiagnosticEngine.matchScenario({
        title: 'User spilled coffee on mechanical keyboard',
        rawDescription: 'Keys sticking after spill.',
      });
      assert.equal(unsupported, null);

      const incident: Incident = {
        id: 'inc-unsupported',
        ticketNumber: 'INC-2026-9999',
        title: 'Keyboard mechanical hardware issue',
        rawDescription: 'Keys sticking after coffee spill.',
        category: 'PERIPHERAL',
        severity: 'P4_LOW',
        status: 'OPEN',
        experienceLevel: 'Beginner',
        diagnosticMode: 'GUIDED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = DiagnosticEngine.initializeSession(incident);
      assert.equal(session.scenarioId, 'generic-unsupported');
      assert.equal(session.steps.length, 1);
      assert.equal(session.steps[0].isClarifyingQuestion, true);
    });
  });

  // =========================================================================
  // 2. Scenario 1: Server Unreachable (Branching & Conclusion)
  // =========================================================================
  describe('2. Scenario: Server Unreachable Execution Paths', () => {
    test('completes positive branching: Ping Fails -> Gateway Fails -> Gateway Down Root Cause', () => {
      const incident: Incident = {
        id: 'inc-srv-test',
        ticketNumber: 'INC-2026-0001',
        title: 'Primary ERP Server Unreachable',
        rawDescription: 'ERP server stopped responding to network traffic.',
        category: 'INFRASTRUCTURE',
        severity: 'P1_CRITICAL',
        status: 'INVESTIGATING',
        experienceLevel: 'Intermediate',
        diagnosticMode: 'GUIDED',
        targetAssetId: mockServerAsset.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Initialize session
      const session = DiagnosticEngine.initializeSession(incident, mockServerAsset, [mockDnsServerAsset]);
      assert.equal(session.scenarioId, 'srv-unreachable');
      assert.equal(session.steps[0].stepId, 'step-srv-q1');
      assert.equal(session.steps[0].safetyClassification, 'CLARIFYING_QUESTION');

      // 2. Answer clarifying question
      const res1 = DiagnosticEngine.recordStepResult(
        session,
        incident,
        session.steps[0].id,
        'PASSED',
        'Verified unreachable across all management subnets.',
        'No recent network maintenance reported.'
      );
      assert.equal(res1.isFinished, false);
      assert.equal(res1.nextStep?.stepId, 'step-srv-icmp');
      assert.ok(res1.nextStep?.command.includes('10.0.1.50'), 'Interpolated target IP into ICMP command');

      // 3. Record ICMP Ping FAILED
      const res2 = DiagnosticEngine.recordStepResult(
        res1.session,
        incident,
        res1.nextStep.id,
        'FAILED',
        'Request timed out. 100% packet loss.',
        'Tested from admin management subnet.'
      );
      assert.equal(res2.isFinished, false);
      assert.equal(res2.nextStep?.stepId, 'step-srv-gateway');

      // 4. Record Gateway Ping FAILED -> Terminal Conclusion
      const res3 = DiagnosticEngine.recordStepResult(
        res2.session,
        incident,
        res2.nextStep.id,
        'FAILED',
        'Gateway 10.0.1.1 unreachable.',
        'Switch uplink LED is unlit.'
      );
      assert.equal(res3.isFinished, true);
      assert.equal(res3.stopReason, 'ROOT_CAUSE_IDENTIFIED');
      assert.ok(res3.report?.confirmedRootCause.includes('Default Gateway'));
      assert.ok((res3.report?.verifiedFixes.length ?? 0) >= 1);

      // Verify all steps preserved in timeline
      assert.equal(res3.session.steps.length, 3);
      assert.equal(res3.session.evidence.length, 3);
    });

    test('completes alternative branch: Ping Succeeds -> Management Port Blocked', () => {
      const incident: Incident = {
        id: 'inc-srv-alt',
        ticketNumber: 'INC-2026-0002',
        title: 'ERP Server cannot connect via RDP',
        rawDescription: 'Users cannot connect to desktop.',
        category: 'INFRASTRUCTURE',
        severity: 'P2_HIGH',
        status: 'INVESTIGATING',
        experienceLevel: 'Intermediate',
        diagnosticMode: 'GUIDED',
        targetAssetId: mockServerAsset.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = DiagnosticEngine.initializeSession(incident, mockServerAsset);

      // Step 1: Clarifying question
      const r1 = DiagnosticEngine.recordStepResult(session, incident, session.steps[0].id, 'PASSED');

      // Step 2: Ping Succeeds
      const r2 = DiagnosticEngine.recordStepResult(
        r1.session,
        incident,
        r1.nextStep!.id,
        'PASSED',
        'Reply from 10.0.1.50: bytes=32 time=2ms TTL=128'
      );
      assert.equal(r2.nextStep?.stepId, 'step-srv-tcp-mgmt');

      // Step 3: TCP Port 3389 Fails -> Firewall or Service Terminated
      const r3 = DiagnosticEngine.recordStepResult(
        r2.session,
        incident,
        r2.nextStep!.id,
        'FAILED',
        'TcpTestSucceeded : False. Port 3389 filtered.'
      );
      assert.equal(r3.isFinished, true);
      assert.equal(r3.stopReason, 'ROOT_CAUSE_IDENTIFIED');
      assert.ok(r3.report?.confirmedRootCause.includes('Firewall'));
    });
  });

  // =========================================================================
  // 3. Scenario 2: Printer Unavailable (Queue & Spooler)
  // =========================================================================
  describe('3. Scenario: Printer Unavailable Execution', () => {
    test('completes printer triage to stalled print job deadlock', () => {
      const incident: Incident = {
        id: 'inc-prt-test',
        ticketNumber: 'INC-2026-0003',
        title: 'Printer unavailable and queue stuck',
        rawDescription: 'Floor 3 printer stopped printing.',
        category: 'HARDWARE',
        severity: 'P3_MEDIUM',
        status: 'INVESTIGATING',
        experienceLevel: 'Beginner',
        diagnosticMode: 'GUIDED',
        targetAssetId: mockPrinterAsset.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = DiagnosticEngine.initializeSession(incident, mockPrinterAsset);
      assert.equal(session.scenarioId, 'printer-stuck');

      // Step 1: Clarifying question
      const r1 = DiagnosticEngine.recordStepResult(session, incident, session.steps[0].id, 'PASSED', 'Display shows Ready, no paper jam.');
      assert.equal(r1.nextStep?.stepId, 'step-prt-icmp');

      // Step 2: Ping succeeds
      const r2 = DiagnosticEngine.recordStepResult(r1.session, incident, r1.nextStep!.id, 'PASSED', 'Reply from 10.0.4.15 time=4ms');
      assert.equal(r2.nextStep?.stepId, 'step-prt-spooler');

      // Step 3: Spooler is Running
      const r3 = DiagnosticEngine.recordStepResult(r2.session, incident, r2.nextStep!.id, 'PASSED', 'Status: Running');
      assert.equal(r3.nextStep?.stepId, 'step-prt-jobs');

      // Step 4: Stalled jobs found in queue -> Confirms Queue Deadlock
      const r4 = DiagnosticEngine.recordStepResult(
        r3.session,
        incident,
        r3.nextStep!.id,
        'FAILED',
        'Job ID 412 status Error (Printing). Size 142MB corrupted PDF.'
      );
      assert.equal(r4.isFinished, true);
      assert.equal(r4.stopReason, 'ROOT_CAUSE_IDENTIFIED');
      assert.ok(r4.report?.confirmedRootCause.includes('print queue'));
    });
  });

  // =========================================================================
  // 4. Scenario 3: Shared File Inaccessible (ACL & Permissions)
  // =========================================================================
  describe('4. Scenario: Shared File Inaccessible Execution', () => {
    test('completes share triage identifying NTFS ACL permission denial', () => {
      const incident: Incident = {
        id: 'inc-shr-test',
        ticketNumber: 'INC-2026-0004',
        title: 'Shared folder access denied on UNC path',
        rawDescription: 'Finance department cannot open \\\\nas-storage-01\\FinancialDocs',
        category: 'STORAGE',
        severity: 'P2_HIGH',
        status: 'INVESTIGATING',
        experienceLevel: 'Intermediate',
        diagnosticMode: 'GUIDED',
        targetAssetId: mockShareAsset.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = DiagnosticEngine.initializeSession(incident, mockShareAsset);
      assert.equal(session.scenarioId, 'share-inaccessible');

      // Step 1: Clarifying question
      const r1 = DiagnosticEngine.recordStepResult(session, incident, session.steps[0].id, 'PASSED', 'Error 0x80070005 Access is Denied');

      // Step 2: SMB Port 445 is Open
      const r2 = DiagnosticEngine.recordStepResult(r1.session, incident, r1.nextStep!.id, 'PASSED', 'TcpTestSucceeded : True');
      assert.equal(r2.nextStep?.stepId, 'step-shr-path');

      // Step 3: Test-Path returns True
      const r3 = DiagnosticEngine.recordStepResult(r2.session, incident, r2.nextStep!.id, 'PASSED', 'True');
      assert.equal(r3.nextStep?.stepId, 'step-shr-acl');

      // Step 4: icacls shows missing security group -> Root Cause Confirmed
      const r4 = DiagnosticEngine.recordStepResult(
        r3.session,
        incident,
        r3.nextStep!.id,
        'FAILED',
        'CORP\\Finance-Users is NOT present in DACL permissions.'
      );
      assert.equal(r4.isFinished, true);
      assert.equal(r4.stopReason, 'ROOT_CAUSE_IDENTIFIED');
      assert.ok(r4.report?.confirmedRootCause.includes('NTFS Access Control List'));
    });
  });

  // =========================================================================
  // 5. Scenario 4: DNS Resolution Failure (Client Cache & Port 53)
  // =========================================================================
  describe('5. Scenario: DNS Resolution Failure Execution', () => {
    test('completes DNS triage identifying negative client cache entry', () => {
      const incident: Incident = {
        id: 'inc-dns-test',
        ticketNumber: 'INC-2026-0005',
        title: 'DNS name resolution failure for intranet portal',
        rawDescription: 'Users cannot resolve portal.corp.internal',
        category: 'NETWORK',
        severity: 'P3_MEDIUM',
        status: 'INVESTIGATING',
        experienceLevel: 'Intermediate',
        diagnosticMode: 'GUIDED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = DiagnosticEngine.initializeSession(incident, mockServerAsset, [mockDnsServerAsset]);
      assert.equal(session.scenarioId, 'dns-failure');

      // Step 1: Clarify FQDN
      const r1 = DiagnosticEngine.recordStepResult(session, incident, session.steps[0].id, 'PASSED', 'Target: portal.corp.internal');
      assert.equal(r1.nextStep?.stepId, 'step-dns-resolve-primary');

      // Step 2: Primary DNS Server returns valid IP (Server is healthy!)
      const r2 = DiagnosticEngine.recordStepResult(
        r1.session,
        incident,
        r1.nextStep!.id,
        'PASSED',
        'portal.corp.internal A 10.0.1.50'
      );
      assert.equal(r2.nextStep?.stepId, 'step-dns-client-cache');

      // Step 3: Inspect Client Cache -> Negative TTL response found!
      const r3 = DiagnosticEngine.recordStepResult(
        r2.session,
        incident,
        r2.nextStep!.id,
        'FAILED',
        'Entry: portal.corp.internal Status: NoRecords TTL: 240'
      );
      assert.equal(r3.isFinished, true);
      assert.equal(r3.stopReason, 'ROOT_CAUSE_IDENTIFIED');
      assert.ok(r3.report?.confirmedRootCause.includes('negative TTL entry'));
      assert.ok(r3.report?.verifiedFixes.some(f => f.action.includes('Clear-DnsClientCache')));
    });
  });

  // =========================================================================
  // 6. Scenario 5: Windows Service Failure (Logon Failure)
  // =========================================================================
  describe('6. Scenario: Windows Service Failure Execution', () => {
    test('completes Windows service failure triage identifying service account logon failure', () => {
      const incident: Incident = {
        id: 'inc-svc-test',
        ticketNumber: 'INC-2026-0006',
        title: 'Windows service crash event 7000',
        rawDescription: 'The reporting daemon service failed on boot.',
        category: 'APPLICATION',
        severity: 'P2_HIGH',
        status: 'INVESTIGATING',
        experienceLevel: 'Advanced',
        diagnosticMode: 'GUIDED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = DiagnosticEngine.initializeSession(incident, mockServerAsset);
      assert.equal(session.scenarioId, 'service-failure');

      // Step 1: Clarifying question
      const r1 = DiagnosticEngine.recordStepResult(session, incident, session.steps[0].id, 'PASSED', 'Service: ReportDaemon');

      // Step 2: Get-Service confirms Stopped
      const r2 = DiagnosticEngine.recordStepResult(r1.session, incident, r1.nextStep!.id, 'FAILED', 'Status: Stopped');
      assert.equal(r2.nextStep?.stepId, 'step-svc-eventlog');

      // Step 3: Event Log records Event 7000 Logon Failure
      const r3 = DiagnosticEngine.recordStepResult(
        r2.session,
        incident,
        r2.nextStep!.id,
        'FAILED',
        'Event 7000: The ReportDaemon service failed to start due to logon failure.'
      );
      assert.equal(r3.nextStep?.stepId, 'step-svc-account');

      // Step 4: Query WMI -> Exit code 1069 Logon Failure confirmed!
      const r4 = DiagnosticEngine.recordStepResult(
        r3.session,
        incident,
        r3.nextStep!.id,
        'FAILED',
        'StartName: CORP\\svc_report ExitCode: 1069'
      );
      assert.equal(r4.isFinished, true);
      assert.equal(r4.stopReason, 'ROOT_CAUSE_IDENTIFIED');
      assert.ok(r4.report?.confirmedRootCause.includes('Service account password expired'));
    });
  });

  // =========================================================================
  // 7. Safety, Contradictions, and Guardrails
  // =========================================================================
  describe('7. Safety, Contradictions & Stop Invariants', () => {
    test('detects contradictory evidence and marks hypotheses contradictory', () => {
      const incident: Incident = {
        id: 'inc-contra',
        ticketNumber: 'INC-2026-0007',
        title: 'ERP Server unreachable on network',
        rawDescription: 'Server down and no response to network traffic.',
        category: 'INFRASTRUCTURE',
        severity: 'P3_MEDIUM',
        status: 'INVESTIGATING',
        experienceLevel: 'Intermediate',
        diagnosticMode: 'GUIDED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = DiagnosticEngine.initializeSession(incident, mockServerAsset);
      assert.equal(session.scenarioId, 'srv-unreachable');

      // Clarifying question
      const r1 = DiagnosticEngine.recordStepResult(session, incident, session.steps[0].id, 'PASSED');
      assert.ok(r1.nextStep, 'Has next diagnostic step');

      // Step 2: Ping Passed
      const r2 = DiagnosticEngine.recordStepResult(r1.session, incident, r1.nextStep.id, 'PASSED', 'Ping 4 replies 0% loss.');
      assert.equal(r2.hasContradiction, false);

      // Now inject a second ping step recording FAILED to test contradiction detection
      const contraStep = {
        ...r2.nextStep!,
        id: 'step-contra-test',
        title: 'Secondary Ping ICMP Probe',
        toolName: 'ping_icmp_probe',
      };
      r2.session.steps.push(contraStep);

      const r3 = DiagnosticEngine.recordStepResult(
        r2.session,
        incident,
        contraStep.id,
        'FAILED',
        '100% loss, ping failed.'
      );

      assert.equal(r3.hasContradiction, true);
      assert.ok(r3.contradictionMessage?.includes('Contradiction detected'));
      assert.ok(r3.auditEvents.some(a => a.eventType === 'CONTRADICTION_DETECTED'));
    });

    test('enforces session budget maximum and stops cleanly', () => {
      const incident: Incident = {
        id: 'inc-budget',
        ticketNumber: 'INC-2026-0008',
        title: 'Production server unreachable timeout',
        rawDescription: 'Testing safety boundary when budget is reached',
        category: 'INFRASTRUCTURE',
        severity: 'P4_LOW',
        status: 'INVESTIGATING',
        experienceLevel: 'Intermediate',
        diagnosticMode: 'GUIDED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = DiagnosticEngine.initializeSession(incident, mockServerAsset);
      assert.equal(session.scenarioId, 'srv-unreachable');
      session.sessionBudgetMax = 2; // Strict bound for testing

      // Step 1
      const r1 = DiagnosticEngine.recordStepResult(session, incident, session.steps[0].id, 'PASSED');
      assert.equal(r1.isFinished, false);
      assert.ok(r1.nextStep);

      // Step 2 -> Hits budget
      const r2 = DiagnosticEngine.recordStepResult(r1.session, incident, r1.nextStep.id, 'PASSED');
      assert.equal(r2.isFinished, true);
      assert.equal(r2.stopReason, 'SESSION_BUDGET_EXHAUSTED');
    });

    test('audit events explicitly declare no commands executed by the application', () => {
      const incident: Incident = {
        id: 'inc-audit-safety',
        ticketNumber: 'INC-2026-0009',
        title: 'Safety check',
        rawDescription: 'Testing audit claims',
        category: 'INFRASTRUCTURE',
        severity: 'P4_LOW',
        status: 'INVESTIGATING',
        experienceLevel: 'Intermediate',
        diagnosticMode: 'GUIDED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const session = DiagnosticEngine.initializeSession(incident, mockServerAsset);
      const res = DiagnosticEngine.recordStepResult(session, incident, session.steps[0].id, 'PASSED');

      const stepExecutedAudit = res.auditEvents.find(a => a.eventType === 'STEP_EXECUTED');
      assert.ok(stepExecutedAudit);
      assert.ok(stepExecutedAudit.details.includes('(Application executed NO commands)'));
    });
  });
});
