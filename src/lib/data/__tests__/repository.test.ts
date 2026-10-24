// src/lib/data/__tests__/repository.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_ASSETS, DEMO_DEPENDENCIES, DEMO_INCIDENTS } from '../demoData';

describe('FixFlow AI Demo Repository & Data Models', () => {
  test('initializes with 15 realistic enterprise assets', () => {
    assert.equal(DEMO_ASSETS.length, 15);
    const tags = DEMO_ASSETS.map(a => a.assetTag);
    assert.ok(tags.includes('DC-DNS-01'));
    assert.ok(tags.includes('FS-CORP-01'));
    assert.ok(tags.includes('FW-EDGE-01'));
    assert.ok(tags.includes('EXEC-LT-04'));
    assert.ok(tags.includes('SRV-SQL-01'));
    assert.ok(tags.includes('PRN-WH-01'));
  });

  test('assets are annotated with isDemo: true', () => {
    for (const asset of DEMO_ASSETS) {
      assert.equal(asset.isDemo, true);
    }
  });

  test('initializes with 13 infrastructure relationship dependencies', () => {
    assert.equal(DEMO_DEPENDENCIES.length, 13);
    const relTypes = DEMO_DEPENDENCIES.map(d => d.relationshipType);
    assert.ok(relTypes.includes('ROUTES_THROUGH'));
    assert.ok(relTypes.includes('CONNECTS_TO'));
    assert.ok(relTypes.includes('AUTHENTICATES_AGAINST'));
    assert.ok(relTypes.includes('HOSTED_ON'));
    assert.ok(relTypes.includes('DEPENDS_ON'));
  });

  test('initializes with 5 realistic demo incidents', () => {
    assert.equal(DEMO_INCIDENTS.length, 5);
    const tickets = DEMO_INCIDENTS.map(i => i.ticketNumber);
    assert.ok(tickets.includes('INC-2026-0842'));
    assert.ok(tickets.includes('INC-2026-0843'));
    assert.ok(tickets.includes('INC-2026-0844'));
    assert.ok(tickets.includes('INC-2026-0845'));
    assert.ok(tickets.includes('INC-2026-0846'));
  });

  test('INC-2026-0842 has valid session steps, hypotheses, and post-mortem report', () => {
    const inc = DEMO_INCIDENTS.find(i => i.ticketNumber === 'INC-2026-0842');
    assert.ok(inc);
    assert.ok(inc.session);
    assert.ok(inc.session.steps.length >= 3);
    assert.ok(inc.session.hypotheses.length >= 3);
    assert.ok(inc.report);
    assert.equal(inc.report.fiveWhys.length, 5);
    assert.ok(inc.report.verifiedFixes.length >= 1);
  });
});
