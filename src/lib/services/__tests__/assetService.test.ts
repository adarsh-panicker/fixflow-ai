// src/lib/services/__tests__/assetService.test.ts
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../db/prisma';
import { AssetService } from '../assetService';
import { CsvImportService } from '../csvImportService';
import { seedDatabase } from '../../../../prisma/seed';

describe('FixFlow AI Persistent Asset & Relationship Management', () => {
  before(async () => {
    // Re-seed clean test environment
    await seedDatabase();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  describe('1. Asset CRUD & Scoped Queries', () => {
    test('fetches seeded assets scoped to default workspace', async () => {
      const assets = await AssetService.getAssets('ws-default');
      assert.ok(assets.length >= 15);
      const tags = assets.map(a => a.assetTag);
      assert.ok(tags.includes('DC-DNS-01'));
      assert.ok(tags.includes('FS-CORP-01'));
    });

    test('creates a new asset with full metadata and Zod validation', async () => {
      const created = await AssetService.createAsset({
        assetTag: 'TEST-SRV-99',
        name: 'Automated Test Cluster Node',
        assetType: 'SERVER',
        manufacturer: 'HPE',
        model: 'ProLiant DL360 Gen10',
        hostname: 'test-node-99.corp.internal',
        ipAddress: '10.0.99.99',
        operatingSystem: 'Ubuntu 24.04 LTS',
        location: 'Test Lab - Rack T01',
        owner: 'QA Engineering',
        tags: 'test,qa,automated',
        criticality: 'TIER_3_MEDIUM',
        status: 'OPERATIONAL',
      }, 'ws-default');

      assert.equal(created.assetTag, 'TEST-SRV-99');
      assert.equal(created.owner, 'QA Engineering');
      assert.equal(created.ipAddress, '10.0.99.99');

      // Verify persistence by fetching
      const fetched = await AssetService.getAssetById('TEST-SRV-99', 'ws-default');
      assert.ok(fetched);
      assert.equal(fetched.name, 'Automated Test Cluster Node');
    });

    test('rejects duplicate asset tag creation in same workspace', async () => {
      await assert.rejects(
        async () => {
          await AssetService.createAsset({
            assetTag: 'TEST-SRV-99',
            name: 'Conflicting Node',
            assetType: 'SERVER',
          }, 'ws-default');
        },
        /already exists/
      );
    });

    test('updates asset fields and status', async () => {
      const existing = await AssetService.getAssetById('TEST-SRV-99', 'ws-default');
      assert.ok(existing);

      const updated = await AssetService.updateAsset(existing.id, {
        status: 'MAINTENANCE',
        location: 'Repaired - Rack T02',
      }, 'ws-default');

      assert.equal(updated.status, 'MAINTENANCE');
      assert.equal(updated.location, 'Repaired - Rack T02');
    });

    test('deletes asset cleanly', async () => {
      const existing = await AssetService.getAssetById('TEST-SRV-99', 'ws-default');
      assert.ok(existing);

      await AssetService.deleteAsset(existing.id, 'ws-default');
      const verify = await AssetService.getAssetById('TEST-SRV-99', 'ws-default');
      assert.equal(verify, null);
    });
  });

  describe('2. Relationship Constraints & Provenance Tracking', () => {
    test('creates explicit relationship between assets in same workspace', async () => {
      const dc = await AssetService.getAssetById('DC-DNS-01', 'ws-default');
      const fs = await AssetService.getAssetById('FS-CORP-01', 'ws-default');
      assert.ok(dc && fs);

      // Create managed_by link
      const rel = await AssetService.createRelationship({
        sourceAssetId: fs.id,
        targetAssetId: dc.id,
        relationshipType: 'MANAGED_BY',
        provenance: 'USER_CONFIRMED',
        description: 'Managed via Central Active Directory Group Policies',
      }, 'ws-default');

      assert.equal(rel.relationshipType, 'MANAGED_BY');
      assert.equal(rel.provenance, 'USER_CONFIRMED');

      // Clean up
      await AssetService.deleteRelationship(rel.id, 'ws-default');
    });

    test('prevents self-link relationships (source === target)', async () => {
      const dc = await AssetService.getAssetById('DC-DNS-01', 'ws-default');
      assert.ok(dc);

      await assert.rejects(
        async () => {
          await AssetService.createRelationship({
            sourceAssetId: dc.id,
            targetAssetId: dc.id,
            relationshipType: 'DEPENDS_ON',
          }, 'ws-default');
        },
        /Self-links are forbidden/
      );
    });

    test('prevents duplicate relationships between the same pair and type', async () => {
      // Find existing rel
      const rels = await AssetService.getRelationships('ws-default');
      assert.ok(rels.length > 0);
      const first = rels[0];

      await assert.rejects(
        async () => {
          await AssetService.createRelationship({
            sourceAssetId: first.sourceAssetId,
            targetAssetId: first.targetAssetId,
            relationshipType: first.relationshipType,
          }, 'ws-default');
        },
        /already exists/
      );
    });

    test('updates provenance from AI_SUGGESTED to USER_CONFIRMED', async () => {
      const rels = await AssetService.getRelationships('ws-default');
      const suggested = rels.find(r => r.provenance === 'AI_SUGGESTED');
      assert.ok(suggested, 'Seeded dataset should include an AI_SUGGESTED relationship');

      const confirmed = await AssetService.updateRelationship(suggested.id, {
        provenance: 'USER_CONFIRMED',
      }, 'ws-default');

      assert.equal(confirmed.provenance, 'USER_CONFIRMED');
    });

    test('cascades deletion: deleting an asset detaches all relationships', async () => {
      // Create temporary asset and link
      const temp1 = await AssetService.createAsset({
        assetTag: 'TEMP-CASCADE-A',
        name: 'Cascade Node A',
        assetType: 'SERVER',
      }, 'ws-default');

      const temp2 = await AssetService.createAsset({
        assetTag: 'TEMP-CASCADE-B',
        name: 'Cascade Node B',
        assetType: 'SWITCH',
      }, 'ws-default');

      const rel = await AssetService.createRelationship({
        sourceAssetId: temp1.id,
        targetAssetId: temp2.id,
        relationshipType: 'CONNECTED_TO',
      }, 'ws-default');

      // Verify relationship exists
      let allRels = await AssetService.getRelationships('ws-default');
      assert.ok(allRels.some(r => r.id === rel.id));

      // Delete temp1
      await AssetService.deleteAsset(temp1.id, 'ws-default');

      // Verify relationship was cascaded and removed
      allRels = await AssetService.getRelationships('ws-default');
      assert.equal(allRels.some(r => r.id === rel.id), false);

      // Clean up temp2
      await AssetService.deleteAsset(temp2.id, 'ws-default');
    });
  });

  describe('3. CSV Import, Column Mapping & Duplicate Detection', () => {
    test('parses CSV with column mapping and validates schema', () => {
      const csv = `Tag,Name,Type,IP,OS,Criticality
SRV-TEST-CSV,Test CSV Server,SERVER,10.0.50.1,Linux,TIER_2_HIGH
INVALID-IP-ROW,Broken Server,SERVER,999.999.999.999,Linux,TIER_3_MEDIUM`;

      const existingAssets = [{ id: '1', assetTag: 'EXISTING-01' }];
      const preview = CsvImportService.previewImport(csv, existingAssets as any);

      assert.equal(preview.totalRows, 2);
      assert.equal(preview.validRows, 1);
      assert.equal(preview.invalidRows, 1);
      assert.ok(preview.rows[1].errors.some(e => e.includes('Invalid IPv4')));
    });

    test('detects duplicate asset tags, hostnames, and IP addresses in CSV against DB', () => {
      const csv = `AssetTag,Name,AssetType,Hostname,IPAddress
DC-DNS-01,Duplicate Tag Host,SERVER,fresh-host.corp,10.0.88.88
FRESH-01,Duplicate IP Host,SERVER,fresh-host-2.corp,10.0.1.10
FRESH-02,Duplicate Hostname,SERVER,dc-dns-01.corp.internal,10.0.88.99
FRESH-03,Completely New Node,SERVER,unique-host.corp,10.0.88.100`;

      const existingAssets = [
        { id: 'ast-101', assetTag: 'DC-DNS-01', hostname: 'dc-dns-01.corp.internal', ipAddress: '10.0.1.10' },
      ];

      const preview = CsvImportService.previewImport(csv, existingAssets as any);

      assert.equal(preview.totalRows, 4);
      assert.equal(preview.duplicateRows, 3);
      assert.equal(preview.validRows, 1);

      assert.ok(preview.rows[0].duplicateReason?.includes("Asset tag 'DC-DNS-01' already exists"));
      assert.ok(preview.rows[1].duplicateReason?.includes("IP address '10.0.1.10' is already assigned"));
      assert.ok(preview.rows[2].duplicateReason?.includes("Hostname 'dc-dns-01.corp.internal' is already registered"));
      assert.equal(preview.rows[3].isDuplicate, false);
      assert.equal(preview.rows[3].isValid, true);
    });

    test('commits CSV import safely with onDuplicate: skip (does not overwrite silently)', async () => {
      const initialAssets = await AssetService.getAssets('ws-default');
      const _initialCount = initialAssets.length;

      const rowsToImport = [
        {
          assetTag: 'DC-DNS-01', // Existing
          name: 'ATTEMPTED OVERWRITE (SHOULD BE SKIPPED)',
          assetType: 'SERVER',
        },
        {
          assetTag: 'NEW-CSV-NODE-1',
          name: 'Brand New Node 1',
          assetType: 'WORKSTATION',
        },
      ];

      const result = await AssetService.commitCsvImport('ws-default', rowsToImport, { onDuplicate: 'skip' });
      assert.equal(result.createdCount, 1);
      assert.equal(result.skippedCount, 1);

      // Verify existing asset was NOT silently overwritten
      const dc = await AssetService.getAssetById('DC-DNS-01', 'ws-default');
      assert.notEqual(dc?.name, 'ATTEMPTED OVERWRITE (SHOULD BE SKIPPED)');

      // Clean up
      const created = await AssetService.getAssetById('NEW-CSV-NODE-1', 'ws-default');
      if (created) await AssetService.deleteAsset(created.id, 'ws-default');
    });
  });
});
