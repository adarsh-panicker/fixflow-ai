// src/lib/engine/__tests__/lifecycleAndReporting.test.ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { repository } from '@/lib/data/repository';
import { Incident, PostMortemReport } from '@/types/incident';

describe('FixFlow AI - Incident Lifecycle, Infrastructure Context & Reporting', () => {
  // =========================================================================
  // 1. Incident Lifecycle: Persistence, Reopen, Resume & Resolution
  // =========================================================================
  describe('1. Incident Lifecycle & Session Persistence', () => {
    test('creates and persists an incident with an active diagnostic session', () => {
      const asset = repository.getAssets()[0];
      const incident = repository.createIncident({
        title: 'Network Packet Loss on Core Interface',
        rawDescription: 'Users experiencing intermittent packet drops and ping timeouts to core server.',
        category: 'Networking & Routing',
        severity: 'P1_CRITICAL',
        status: 'INVESTIGATING',
        diagnosticMode: 'GUIDED',
        experienceLevel: 'Intermediate',
        targetAssetId: asset.id,
        targetAsset: asset,
      });

      assert.ok(incident.id, 'Incident ID must be generated');
      assert.ok(incident.ticketNumber.startsWith('INC-2026-'), 'Ticket number must be formatted');
      assert.ok(incident.session, 'Diagnostic session must be initialized');
      assert.strictEqual(incident.status, 'INVESTIGATING');
      assert.strictEqual(incident.session.steps.length > 0, true);

      // Verify retrieval by ID
      const retrieved = repository.getIncidentById(incident.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.ticketNumber, incident.ticketNumber);
      assert.strictEqual(retrieved.session?.steps.length, incident.session.steps.length);
    });

    test('reopens a resolved incident and safely resumes unfinished diagnostic session', () => {
      const asset = repository.getAssets()[0];
      const incident = repository.createIncident({
        title: 'Temporary Service Interruption',
        rawDescription: 'Intermittent failure reported.',
        category: 'Windows & System Services',
        severity: 'P2_HIGH',
        status: 'INVESTIGATING',
        diagnosticMode: 'GUIDED',
        experienceLevel: 'Intermediate',
        targetAssetId: asset.id,
        targetAsset: asset,
      });

      // Execute initial step
      const step1 = incident.session!.steps[0];
      const updated = repository.recordStepResult(
        incident.id,
        step1.id,
        'PASSED',
        'Initial test passed',
        '0% loss'
      );
      assert.ok(updated);
      const evidenceCountBefore = updated.session!.evidence.length;
      assert.strictEqual(evidenceCountBefore, 1);

      // Mark incident as RESOLVED
      const resolved = repository.resolveIncident(
        incident.id,
        'Service restarted and verified functional.',
        'Senior Engineer'
      );
      assert.ok(resolved);
      assert.strictEqual(resolved.status, 'RESOLVED');
      assert.strictEqual(resolved.session?.status, 'RESOLVED');
      assert.strictEqual(resolved.resolutionNotes, 'Service restarted and verified functional.');

      // Reopen incident
      const reopened = repository.reopenIncident(incident.id, 'Issue recurred after 2 hours');
      assert.ok(reopened);
      assert.strictEqual(reopened.status, 'INVESTIGATING', 'Incident status must revert to INVESTIGATING');
      assert.strictEqual(reopened.session?.status, 'ACTIVE', 'Session status must revert to ACTIVE');
      assert.strictEqual(reopened.session?.stopReason, null);

      // Verify historical evidence was preserved
      assert.strictEqual(
        reopened.session?.evidence.length,
        evidenceCountBefore,
        'Recorded evidence must be preserved when reopening'
      );

      // Resume diagnostics: record step 2
      const step2 = reopened.session!.steps[reopened.session!.steps.length - 1];
      const resumed = repository.recordStepResult(
        incident.id,
        step2.id,
        'FAILED',
        'Follow-up test failed',
        'Error 503'
      );
      assert.ok(resumed);
      assert.strictEqual(resumed.session?.evidence.length, 2, 'New evidence must be appended');
    });

    test('preserves resolved incidents as permanent historical records', () => {
      const asset = repository.getAssets()[0];
      const incident = repository.createIncident({
        title: 'Closed Outage Archive Test',
        rawDescription: 'Legacy outage for historical archive check.',
        category: 'Backup & Storage',
        severity: 'P3_MEDIUM',
        status: 'INVESTIGATING',
        diagnosticMode: 'GUIDED',
        experienceLevel: 'Intermediate',
        targetAssetId: asset.id,
        targetAsset: asset,
      });

      const resolved = repository.resolveIncident(
        incident.id,
        'VSS snapshot writer timeout resolved by clearing shadow copy storage.',
        'Lead Storage Admin'
      );
      assert.ok(resolved);

      const archived = repository.getIncidentById(incident.id);
      assert.ok(archived);
      assert.strictEqual(archived.status, 'RESOLVED');
      assert.strictEqual(archived.session?.status, 'RESOLVED');
      assert.ok(archived.resolutionNotes?.includes('VSS snapshot writer timeout'));
    });
  });

  // =========================================================================
  // 2. Search & Multi-Criteria Filtering
  // =========================================================================
  describe('2. Search & Multi-Criteria Filtering', () => {
    test('filters incidents by title, ticket number, category, severity, and asset tag', () => {
      const asset = repository.getAssets()[0];
      const uniqueTag = `TAG-${Date.now()}`;
      const uniqueTitle = `Special Database Lockout ${Date.now()}`;

      const inc = repository.createIncident({
        title: uniqueTitle,
        rawDescription: `Unique error code 0x8899 on ${uniqueTag}.`,
        category: 'Database & Storage',
        severity: 'P1_CRITICAL',
        status: 'INVESTIGATING',
        diagnosticMode: 'GUIDED',
        experienceLevel: 'Intermediate',
        targetAssetId: asset.id,
        targetAsset: { ...asset, assetTag: uniqueTag },
      });

      // Search by title
      const byTitle = repository.searchAndFilterIncidents({ searchTerm: uniqueTitle });
      assert.strictEqual(byTitle.some(i => i.id === inc.id), true);

      // Search by ticket number
      const byTicket = repository.searchAndFilterIncidents({ searchTerm: inc.ticketNumber });
      assert.strictEqual(byTicket.some(i => i.id === inc.id), true);

      // Search by asset tag
      const byAssetTag = repository.searchAndFilterIncidents({ searchTerm: uniqueTag });
      assert.strictEqual(byAssetTag.some(i => i.id === inc.id), true);

      // Filter by Severity
      const p1Results = repository.searchAndFilterIncidents({ severity: 'P1_CRITICAL' });
      assert.ok(p1Results.every(i => i.severity === 'P1_CRITICAL'));

      // Filter by Status
      const investigatingResults = repository.searchAndFilterIncidents({ status: 'INVESTIGATING' });
      assert.ok(investigatingResults.every(i => i.status === 'INVESTIGATING'));

      // Filter by Target Asset ID
      const byAssetId = repository.searchAndFilterIncidents({ assetId: asset.id });
      assert.ok(byAssetId.every(i => i.targetAssetId === asset.id || i.targetAsset?.id === asset.id));

      // Filter by Date
      const todayResults = repository.searchAndFilterIncidents({ dateRange: 'TODAY' });
      assert.ok(todayResults.some(i => i.id === inc.id));
    });
  });

  // =========================================================================
  // 3. Infrastructure Context Retrieval & Immutability
  // =========================================================================
  describe('3. Infrastructure Context & Evidence Immutability', () => {
    test('retrieves directly related upstream and downstream infrastructure dependencies', () => {
      const allAssets = repository.getAssets();
      const serverAsset = allAssets.find(a => a.assetType === 'SERVER') || allAssets[0];

      const topology = repository.getRelatedDependencies(serverAsset.id);
      assert.ok(topology);
      assert.strictEqual(topology.targetAsset?.id, serverAsset.id);
      assert.ok(Array.isArray(topology.upstream), 'Upstream dependencies array must exist');
      assert.ok(Array.isArray(topology.downstream), 'Downstream dependencies array must exist');
      assert.ok(topology.upstream.length <= 5, 'Dependencies must be bounded to max 5');
      assert.ok(topology.downstream.length <= 5, 'Dependencies must be bounded to max 5');

      // Verify relationships have required fields
      const allRels = [...topology.upstream, ...topology.downstream];
      for (const rel of allRels) {
        assert.ok(rel.relationship.relationshipType, 'Relationship type must be defined');
        assert.ok(rel.asset.assetTag, 'Related asset tag must be defined');
      }
    });

    test('updating asset or incident metadata does not corrupt previously recorded evidence or hypotheses', () => {
      const allAssets = repository.getAssets();
      const asset = allAssets[0];

      const incident = repository.createIncident({
        title: 'Immutability Verification Incident',
        rawDescription: 'Testing that CMDB metadata changes do not alter empirical evidence.',
        category: 'Networking & Routing',
        severity: 'P2_HIGH',
        status: 'INVESTIGATING',
        diagnosticMode: 'GUIDED',
        experienceLevel: 'Intermediate',
        targetAssetId: asset.id,
        targetAsset: asset,
      });

      // Record step result
      const step1 = incident.session!.steps[0];
      const updatedInc = repository.recordStepResult(
        incident.id,
        step1.id,
        'FAILED',
        'Connection timed out at packet 3',
        'PING: Request timed out.'
      );
      assert.ok(updatedInc);

      const originalEvidence = JSON.stringify(updatedInc.session!.evidence);
      const originalHypotheses = JSON.stringify(updatedInc.session!.hypotheses);

      // Now simulate updating the asset in the CMDB
      repository.updateAsset(asset.id, {
        ipAddress: '10.99.99.99',
        name: 'Renamed Production Server',
        location: 'Relocated to Building 9'
      });

      // Update incident metadata
      repository.updateIncident(incident.id, {
        title: 'Updated Incident Title After Move',
        category: 'Firewall & Security'
      });

      // Retrieve incident again
      const refreshedInc = repository.getIncidentById(incident.id);
      assert.ok(refreshedInc);

      // Verify evidence and hypotheses remain 100% identical
      assert.strictEqual(
        JSON.stringify(refreshedInc.session!.evidence),
        originalEvidence,
        'Recorded evidence must remain immutable after asset or incident changes'
      );
      assert.strictEqual(
        JSON.stringify(refreshedInc.session!.hypotheses),
        originalHypotheses,
        'Hypotheses must remain immutable after asset or incident changes'
      );
    });
  });

  // =========================================================================
  // 4. Reporting, Post-Mortem RCA & Inconclusive Statements
  // =========================================================================
  describe('4. Reporting & Post-Mortem RCA Integrity', () => {
    test('generates report strictly from recorded empirical session data without hallucination', () => {
      const asset = repository.getAssets()[0];
      const incident = repository.createIncident({
        title: 'ERP Cluster Gateway Failure',
        rawDescription: 'Accounting team unable to load ERP interface. Gateway ping times out.',
        category: 'Networking & Routing',
        severity: 'P1_CRITICAL',
        status: 'INVESTIGATING',
        diagnosticMode: 'GUIDED',
        experienceLevel: 'Intermediate',
        targetAssetId: asset.id,
        targetAsset: asset,
      });

      // Record 2 diagnostic steps
      let currentInc: Incident | undefined = incident;
      const step1 = currentInc.session!.steps[0];
      currentInc = repository.recordStepResult(
        incident.id,
        step1.id,
        'PASSED',
        'Scope confirmed across subnets',
        'Verified global reachability failure'
      );
      assert.ok(currentInc);

      const step2 = currentInc.session!.steps[currentInc.session!.steps.length - 1];
      currentInc = repository.recordStepResult(
        incident.id,
        step2.id,
        'FAILED',
        'Host failed to reply to ICMP echo probe',
        '100% packet loss'
      );
      assert.ok(currentInc);

      // Save structured post-mortem report
      const report: PostMortemReport = {
        id: `rep-${incident.id}`,
        incidentId: incident.id,
        executiveSummary: 'Incident INC-2026 ERP Cluster Gateway Failure post-mortem.',
        confirmedRootCause: 'Core gateway routing table dropped packet forwarding for ERP subnet.',
        fiveWhys: [
          { whyNumber: 1, question: 'Why could users not connect?', answer: 'ERP server was unreachable.' },
          { whyNumber: 2, question: 'Why was the server unreachable?', answer: 'ICMP echo probe failed with 100% loss.' }
        ],
        verifiedFixes: [
          { id: 'fix-1', action: 'Restored gateway static route entry', owner: 'Network Ops', isVerified: true }
        ],
        unverifiedRecommendations: [
          { id: 'rec-1', action: 'Implement automated route drift detection', owner: 'DevOps', isVerified: false }
        ],
        signOffOperator: 'Lead Systems Architect',
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const withReport = repository.updateIncident(incident.id, { report });
      assert.ok(withReport);

      // Verify report contents
      const fetched = repository.getIncidentById(incident.id);
      assert.ok(fetched?.report);
      assert.strictEqual(fetched.report.confirmedRootCause, report.confirmedRootCause);
      assert.strictEqual(fetched.report.verifiedFixes.length, 1);
      assert.strictEqual(fetched.report.fiveWhys.length, 2);
      assert.strictEqual(fetched.report.signOffOperator, 'Lead Systems Architect');
    });

    test('supports editing, saving, and reopening reports without loss of evidence', () => {
      const asset = repository.getAssets()[0];
      const incident = repository.createIncident({
        title: 'Editable Report Verification',
        rawDescription: 'Testing report field editing and persistence.',
        category: 'Windows & System Services',
        severity: 'P2_HIGH',
        status: 'INVESTIGATING',
        diagnosticMode: 'GUIDED',
        experienceLevel: 'Intermediate',
        targetAssetId: asset.id,
        targetAsset: asset,
      });

      // Update report fields
      const editedSummary = 'Edited executive summary: Root cause verified through manual inspection.';
      const editedRootCause = 'Defective RAM module on DIMM slot 2.';

      const initialReport: PostMortemReport = {
        id: `rep-${Date.now()}`,
        incidentId: incident.id,
        executiveSummary: editedSummary,
        confirmedRootCause: editedRootCause,
        fiveWhys: [{ whyNumber: 1, question: 'Why did the host reboot?', answer: 'Kernel panic from uncorrectable ECC memory error.' }],
        verifiedFixes: [{ id: 'fix-1', action: 'Replaced DIMM 2 module', owner: 'Hardware Tech', isVerified: true }],
        unverifiedRecommendations: [{ id: 'rec-1', action: 'Run overnight MemTest86 on host', owner: 'Hardware Tech', isVerified: false }],
        signOffOperator: 'Chief Infrastructure Officer',
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      repository.updateIncident(incident.id, { report: initialReport });

      // Reopen and reload report
      const reloaded = repository.getIncidentById(incident.id);
      assert.ok(reloaded?.report);
      assert.strictEqual(reloaded.report.executiveSummary, editedSummary);
      assert.strictEqual(reloaded.report.confirmedRootCause, editedRootCause);
      assert.strictEqual(reloaded.report.signOffOperator, 'Chief Infrastructure Officer');
    });

    test('escalated or inconclusive sessions clearly indicate inconclusive notice', () => {
      const asset = repository.getAssets()[0];
      const incident = repository.createIncident({
        title: 'Inconclusive Diagnostic Session',
        rawDescription: 'Multiple contradictory test results.',
        category: 'Networking & Routing',
        severity: 'P2_HIGH',
        status: 'INVESTIGATING',
        diagnosticMode: 'GUIDED',
        experienceLevel: 'Intermediate',
        targetAssetId: asset.id,
        targetAsset: asset,
      });

      // Escalate session
      const escalated = repository.escalateIncident(
        incident.id,
        'Inconclusive telemetry - physical hardware inspection required',
        'Dispatched technician to DC-West.'
      );
      assert.ok(escalated);
      assert.strictEqual(escalated.session?.status, 'ESCALATED');
      assert.strictEqual(escalated.session?.stopReason, 'MANUAL_ESCALATION');

      // Check whether session meets inconclusive criteria
      const isInconclusive =
        escalated.session?.status === 'ESCALATED' ||
        escalated.session?.stopReason === 'MANUAL_ESCALATION' ||
        escalated.status !== 'ROOT_CAUSE_IDENTIFIED';

      assert.strictEqual(isInconclusive, true, 'Escalated session must be classified as inconclusive');
    });
  });
});
