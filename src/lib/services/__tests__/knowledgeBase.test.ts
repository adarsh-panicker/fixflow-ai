// src/lib/services/__tests__/knowledgeBase.test.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../db/prisma';
import { KnowledgeBaseService } from '../knowledgeBaseService';
import { KnowledgeSearchService } from '../knowledgeSearchService';

describe('FixFlow AI - Local Error & Solution Knowledge Base', () => {
  const TEST_WORKSPACE = 'ws-test-kb';
  let verifiedArticleId = '';
  let draftArticleId = '';

  before(async () => {
    // 1. Create clean test workspace
    await prisma.workspace.upsert({
      where: { id: TEST_WORKSPACE },
      update: {},
      create: { id: TEST_WORKSPACE, name: 'Knowledge Base Test Workspace' },
    });

    // Clean up any stale data
    await prisma.knowledgeArticle.deleteMany({ where: { workspaceId: TEST_WORKSPACE } });

    // 2. Create a verified enterprise article (Windows SMB Share 0x80070035)
    const art1 = await KnowledgeBaseService.createArticle(
      {
        title: 'SMB Network Path Not Found (0x80070035) on Windows File Share',
        errorCode: '0x80070035',
        category: 'STORAGE',
        assetType: 'SERVER',
        operatingSystem: 'Windows Server 2022',
        originalErrorDescription:
          'Client workstations fail to connect to departmental file shares with error 0x80070035 Network Path Not Found.',
        symptoms: [
          'Error 0x80070035: The network path was not found',
          'Windows cannot access \\\\fs01.corp.internal\\shares',
        ],
        diagnosticSteps: [
          {
            title: 'Test SMB Port 445 Connectivity',
            command: 'Test-NetConnection -ComputerName fs01.corp.internal -Port 445',
            purpose: 'Verify TCP port 445 is open and reachable.',
            expectedResult: 'TcpTestSucceeded: True',
            riskRating: 'SAFE_READ_ONLY',
          },
        ],
        verifiedSolution:
          '1. Enable File and Printer Sharing in Windows Firewall.\n2. Restart LanmanWorkstation client service.\n3. Clear stale SMB credentials.',
        preventionNotes: 'Deploy GPO firewall rule for File and Printer Sharing inbound exception.',
        status: 'VERIFIED',
        confidenceBasis: 'ADMIN_VERIFIED',
        createdBy: 'Senior IT Architect',
      },
      TEST_WORKSPACE
    );
    verifiedArticleId = art1.id;

    // 3. Create a DRAFT article (PostgreSQL Connection Refused on Linux)
    const art2 = await KnowledgeBaseService.createArticle(
      {
        title: 'PostgreSQL Connection Refused on TCP Port 5432',
        errorCode: 'PG_CONN_REFUSED',
        category: 'DATABASE',
        assetType: 'SERVER',
        operatingSystem: 'Ubuntu Linux 22.04',
        originalErrorDescription:
          'Application cannot connect to PostgreSQL database server: Connection refused on port 5432.',
        symptoms: ['could not connect to server: Connection refused on port 5432'],
        diagnosticSteps: [
          {
            title: 'Check PostgreSQL Service Status',
            command: 'systemctl status postgresql',
            purpose: 'Verify systemd unit is active and running.',
            expectedResult: 'Active: active (running)',
            riskRating: 'SAFE_READ_ONLY',
          },
        ],
        verifiedSolution:
          '1. Set listen_addresses = "*" in postgresql.conf.\n2. Allow client CIDR subnet in pg_hba.conf.\n3. Reload postgresql service.',
        preventionNotes: 'Enforce standard pg_hba.conf subnet rules in deployment playbook.',
        status: 'DRAFT',
        confidenceBasis: 'USER_CONFIRMED',
        createdBy: 'Database Technician',
      },
      TEST_WORKSPACE
    );
    draftArticleId = art2.id;
  });

  after(async () => {
    await prisma.knowledgeArticle.deleteMany({ where: { workspaceId: TEST_WORKSPACE } });
    await prisma.workspace.delete({ where: { id: TEST_WORKSPACE } }).catch(() => {});
  });

  it('1. exact error code match yields high confidence recommendation (>= 75 score)', async () => {
    const res = await KnowledgeSearchService.searchLocalKnowledge({
      query: 'User receives error code 0x80070035 when opening shared folder',
      errorCode: '0x80070035',
      assetType: 'SERVER',
      operatingSystem: 'Windows Server 2022',
      workspaceId: TEST_WORKSPACE,
      verifiedOnly: true,
    });

    assert.equal(res.hasMatch, true, 'Must find matching verified solution');
    assert.ok(res.topMatch, 'topMatch must be populated');
    assert.equal(res.topMatch?.article.id, verifiedArticleId);
    assert.equal(res.topMatch?.confidenceLevel, 'HIGH');
    assert.ok(res.topMatch!.score >= 75, `Score should be >= 75, got ${res.topMatch!.score}`);
    assert.equal(res.suggestedAction, 'PRESENT_LOCAL_SOLUTION');
    assert.ok(
      res.topMatch!.matchReasons.some(r => r.includes('0x80070035')),
      'Match reasons must state exact error code match'
    );
  });

  it('2. matches semantic wording variation without explicit error code', async () => {
    const res = await KnowledgeSearchService.searchLocalKnowledge({
      query: 'Windows file share network path not found when connecting to shared repository',
      assetType: 'SERVER',
      operatingSystem: 'Windows Server 2022',
      workspaceId: TEST_WORKSPACE,
      verifiedOnly: true,
    });

    assert.equal(res.hasMatch, true, 'Must match on semantic tokens and normalized text');
    assert.ok(res.topMatch, 'topMatch must be present');
    assert.equal(res.topMatch?.article.id, verifiedArticleId);
    assert.ok(res.topMatch!.score >= 45, `Score should meet moderate threshold, got ${res.topMatch!.score}`);
  });

  it('3. rejects proposed solution when target operating system is strictly incompatible', async () => {
    // Querying with Windows SMB description, but target asset is Linux
    const res = await KnowledgeSearchService.searchLocalKnowledge({
      query: '0x80070035 Network Path Not Found on central fileserver',
      errorCode: '0x80070035',
      assetType: 'SERVER',
      operatingSystem: 'Ubuntu Linux 22.04', // Incompatible with Windows Server article
      workspaceId: TEST_WORKSPACE,
      verifiedOnly: true,
    });

    // Windows solution must NOT be returned for a Linux asset
    assert.equal(res.hasMatch, false, 'Must reject Windows-only solution on Linux environment');
    assert.equal(res.topMatch, null);
    assert.equal(res.suggestedAction, 'ESCALATE_TO_GEMINI');
  });

  it('4. rejects proposed solution when target asset type is incompatible', async () => {
    // Querying with SMB share description, but target asset is PRINTER
    const res = await KnowledgeSearchService.searchLocalKnowledge({
      query: 'Network path not found on printer 0x80070035',
      errorCode: '0x80070035',
      assetType: 'PRINTER', // Incompatible with SERVER/STORAGE
      operatingSystem: 'Windows Server 2022',
      workspaceId: TEST_WORKSPACE,
      verifiedOnly: true,
    });

    assert.equal(res.hasMatch, false, 'Must reject SERVER storage solution on PRINTER asset');
  });

  it('5. excludes DRAFT articles from automatic first-line recommendations (verifiedOnly: true)', async () => {
    const res = await KnowledgeSearchService.searchLocalKnowledge({
      query: 'PostgreSQL connection refused port 5432',
      errorCode: 'PG_CONN_REFUSED',
      assetType: 'SERVER',
      operatingSystem: 'Ubuntu Linux 22.04',
      workspaceId: TEST_WORKSPACE,
      verifiedOnly: true, // Only verified articles qualify
    });

    assert.equal(res.hasMatch, false, 'Draft article must NOT be returned when verifiedOnly is true');
  });

  it('6. includes DRAFT articles when verifiedOnly is set to false', async () => {
    const res = await KnowledgeSearchService.searchLocalKnowledge({
      query: 'PostgreSQL connection refused port 5432',
      errorCode: 'PG_CONN_REFUSED',
      assetType: 'SERVER',
      operatingSystem: 'Ubuntu Linux 22.04',
      workspaceId: TEST_WORKSPACE,
      verifiedOnly: false,
    });

    assert.equal(res.hasMatch, true, 'Draft article must be found when verifiedOnly is false');
    assert.equal(res.topMatch?.article.id, draftArticleId);
  });

  it('7. promotes DRAFT article to VERIFIED in admin verification workflow', async () => {
    const promoted = await KnowledgeBaseService.verifyArticle(
      draftArticleId,
      'Lead Infrastructure Architect',
      TEST_WORKSPACE
    );

    assert.equal(promoted.status, 'VERIFIED');
    assert.equal(promoted.confidenceBasis, 'ADMIN_VERIFIED');
    assert.equal(promoted.verifiedBy, 'Lead Infrastructure Architect');

    // Now it must be returned in verified search
    const searchAfterVerify = await KnowledgeSearchService.searchLocalKnowledge({
      query: 'PostgreSQL connection refused port 5432',
      errorCode: 'PG_CONN_REFUSED',
      assetType: 'SERVER',
      operatingSystem: 'Ubuntu Linux 22.04',
      workspaceId: TEST_WORKSPACE,
      verifiedOnly: true,
    });

    assert.equal(searchAfterVerify.hasMatch, true, 'Promoted article must now appear in verified searches');
    assert.equal(searchAfterVerify.topMatch?.article.id, draftArticleId);
  });

  it('8. records technician ACCEPTED outcome and increments successCount', async () => {
    const beforeArticle = await KnowledgeBaseService.getArticleById(verifiedArticleId, TEST_WORKSPACE);
    const initialSuccess = beforeArticle?.successCount || 0;

    const result = await KnowledgeBaseService.recordOutcome({
      articleId: verifiedArticleId,
      incidentId: 'INC-TEST-001',
      outcome: 'ACCEPTED',
      workspaceId: TEST_WORKSPACE,
    });

    assert.equal(result.success, true);
    assert.equal(result.article.successCount, initialSuccess + 1, 'successCount must increment by 1');
    assert.ok(result.article.lastUsedAt, 'lastUsedAt timestamp must be recorded');
  });

  it('9. records technician UNSUCCESSFUL outcome and increments failureCount', async () => {
    const beforeArticle = await KnowledgeBaseService.getArticleById(verifiedArticleId, TEST_WORKSPACE);
    const initialFailure = beforeArticle?.failureCount || 0;

    const result = await KnowledgeBaseService.recordOutcome({
      articleId: verifiedArticleId,
      incidentId: 'INC-TEST-002',
      outcome: 'UNSUCCESSFUL',
      workspaceId: TEST_WORKSPACE,
    });

    assert.equal(result.success, true);
    assert.equal(result.article.failureCount, initialFailure + 1, 'failureCount must increment by 1');
  });

  it('10. detects duplicate articles and recommends warning or updating existing', async () => {
    const dupCheck = await KnowledgeSearchService.detectDuplicates({
      title: 'SMB Network Path Not Found (0x80070035) on Windows Share',
      errorCode: '0x80070035',
      originalErrorDescription:
        'Clients fail to open file shares with error code 0x80070035 Network Path Not Found.',
      workspaceId: TEST_WORKSPACE,
    });

    assert.equal(dupCheck.hasDuplicate, true, 'Duplicate must be detected');
    assert.ok(dupCheck.similarityScore >= 75, `Similarity score should be >= 75, got ${dupCheck.similarityScore}`);
    assert.equal(dupCheck.matchedArticle?.id, verifiedArticleId);
    assert.ok(dupCheck.recommendation === 'UPDATE_EXISTING' || dupCheck.recommendation === 'WARN_DUPLICATE');
  });

  it('11. confirms no duplicate for genuinely new problem statement', async () => {
    const uniqueCheck = await KnowledgeSearchService.detectDuplicates({
      title: 'Kubernetes Ingress Gateway TLS Certificate Expired (ERR_CERT_DATE_INVALID)',
      errorCode: 'ERR_CERT_DATE_INVALID',
      originalErrorDescription: 'Traefik ingress controller rejected connection due to expired wildcard SSL cert.',
      workspaceId: TEST_WORKSPACE,
    });

    assert.equal(uniqueCheck.hasDuplicate, false, 'Should not detect duplicate for unique problem');
    assert.equal(uniqueCheck.recommendation, 'CREATE_NEW');
  });

  it('12. maintains strict multi-workspace isolation', async () => {
    const OTHER_WORKSPACE = 'ws-test-kb-isolated';
    await prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: {},
      create: { id: OTHER_WORKSPACE, name: 'Isolated Workspace' },
    });

    try {
      // Search in separate workspace
      const isolatedSearch = await KnowledgeSearchService.searchLocalKnowledge({
        query: '0x80070035 Network Path Not Found',
        errorCode: '0x80070035',
        assetType: 'SERVER',
        operatingSystem: 'Windows Server 2022',
        workspaceId: OTHER_WORKSPACE,
        verifiedOnly: false,
      });

      assert.equal(isolatedSearch.hasMatch, false, 'Articles from TEST_WORKSPACE must not leak into OTHER_WORKSPACE');
    } finally {
      await prisma.workspace.delete({ where: { id: OTHER_WORKSPACE } }).catch(() => {});
    }
  });

  it('13. computes accurate knowledge base statistics', async () => {
    const stats = await KnowledgeBaseService.getKnowledgeStats(TEST_WORKSPACE);

    assert.equal(stats.totalArticles, 2, 'Should have 2 articles total');
    assert.equal(stats.verifiedCount, 2, 'Both articles are now verified');
    assert.equal(stats.draftCount, 0);
    assert.ok(stats.totalSuccessReuses >= 1, 'Should reflect recorded success');
    assert.ok(stats.totalFailureOutcomes >= 1, 'Should reflect recorded failure');
    assert.ok(stats.globalSuccessRate !== null, 'Global success rate must be computed');
    assert.ok(stats.mostReused.length > 0, 'Most reused solutions must be listed');
  });

  it('14. archives an article and verifies it is excluded from active search', async () => {
    await KnowledgeBaseService.archiveArticle(draftArticleId, TEST_WORKSPACE);

    const activeList = await KnowledgeBaseService.getArticles(TEST_WORKSPACE, {
      status: 'VERIFIED',
    });

    assert.ok(!activeList.some(a => a.id === draftArticleId), 'Archived article must not appear in verified list');

    const archivedItem = await KnowledgeBaseService.getArticleById(draftArticleId, TEST_WORKSPACE);
    assert.equal(archivedItem?.status, 'ARCHIVED');
  });

  it('15. local knowledge search executes completely offline in sub-100ms timeframe', async () => {
    const start = performance.now();

    const res = await KnowledgeSearchService.searchLocalKnowledge({
      query: 'SMB 0x80070035 network path not found',
      errorCode: '0x80070035',
      assetType: 'SERVER',
      operatingSystem: 'Windows Server 2022',
      workspaceId: TEST_WORKSPACE,
      verifiedOnly: true,
    });

    const elapsed = performance.now() - start;

    assert.equal(res.hasMatch, true);
    assert.ok(elapsed < 100, `Execution must be fast local offline search, took ${elapsed.toFixed(1)}ms`);
  });
});
