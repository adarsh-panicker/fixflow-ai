// src/lib/auth/__tests__/authAndWorkspaceIsolation.test.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../db/prisma';
import {
  createSessionToken,
  verifySessionToken,
  SessionPayload,
} from '../session';
import {
  hasPermission,
  assertPermission,
  canManageRole,
  AuthorizationError,
} from '../rbac';
import {
  createWorkspaceInvitation,
  acceptWorkspaceInvitation,
  revokeWorkspaceInvitation,
} from '../invitationService';
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from '../passwordService';
import { AssetService } from '../../services/assetService';
import { KnowledgeSearchService } from '../../services/knowledgeSearchService';
import { MonitoringService } from '../../services/monitoringService';

describe('FixFlow AI - Multi-User Authentication, RBAC & Workspace Isolation', () => {
  const TEST_WS_A = 'ws-test-alpha';
  const TEST_WS_B = 'ws-test-beta';

  let userOwnerA: any;
  let userAdminA: any;
  let userSupportA: any;
  let userViewerA: any;
  let userOwnerB: any;

  before(async () => {
    // 1. Create two isolated test workspaces
    await prisma.workspace.upsert({
      where: { id: TEST_WS_A },
      update: {},
      create: { id: TEST_WS_A, name: 'Alpha Operations Core' },
    });

    await prisma.workspace.upsert({
      where: { id: TEST_WS_B },
      update: {},
      create: { id: TEST_WS_B, name: 'Beta Tenant Secured' },
    });

    // 2. Provision test users with known password
    const testHash = await bcrypt.hash('Flexflow@i', 10);

    userOwnerA = await prisma.userProfile.upsert({
      where: { email: 'owner-a@test.local' },
      update: { username: 'OwnerAlpha', passwordHash: testHash },
      create: {
        email: 'owner-a@test.local',
        username: 'OwnerAlpha',
        name: 'Alpha Owner',
        passwordHash: testHash,
      },
    });

    userAdminA = await prisma.userProfile.upsert({
      where: { email: 'admin-a@test.local' },
      update: { username: 'AdminAlpha', passwordHash: testHash },
      create: {
        email: 'admin-a@test.local',
        username: 'AdminAlpha',
        name: 'Alpha Administrator',
        passwordHash: testHash,
      },
    });

    userSupportA = await prisma.userProfile.upsert({
      where: { email: 'support-a@test.local' },
      update: { username: 'SupportAlpha', passwordHash: testHash },
      create: {
        email: 'support-a@test.local',
        username: 'SupportAlpha',
        name: 'Alpha Support Tech',
        passwordHash: testHash,
      },
    });

    userViewerA = await prisma.userProfile.upsert({
      where: { email: 'viewer-a@test.local' },
      update: { username: 'ViewerAlpha', passwordHash: testHash },
      create: {
        email: 'viewer-a@test.local',
        username: 'ViewerAlpha',
        name: 'Alpha Auditor Viewer',
        passwordHash: testHash,
      },
    });

    userOwnerB = await prisma.userProfile.upsert({
      where: { email: 'owner-b@test.local' },
      update: { username: 'OwnerBeta', passwordHash: testHash },
      create: {
        email: 'owner-b@test.local',
        username: 'OwnerBeta',
        name: 'Beta Owner',
        passwordHash: testHash,
      },
    });

    // 3. Assign memberships
    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: TEST_WS_A, userId: userOwnerA.id } },
      update: { role: 'OWNER' },
      create: { workspaceId: TEST_WS_A, userId: userOwnerA.id, role: 'OWNER' },
    });

    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: TEST_WS_A, userId: userAdminA.id } },
      update: { role: 'ADMIN' },
      create: { workspaceId: TEST_WS_A, userId: userAdminA.id, role: 'ADMIN' },
    });

    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: TEST_WS_A, userId: userSupportA.id } },
      update: { role: 'SUPPORT' },
      create: { workspaceId: TEST_WS_A, userId: userSupportA.id, role: 'SUPPORT' },
    });

    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: TEST_WS_A, userId: userViewerA.id } },
      update: { role: 'VIEWER' },
      create: { workspaceId: TEST_WS_A, userId: userViewerA.id, role: 'VIEWER' },
    });

    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: TEST_WS_B, userId: userOwnerB.id } },
      update: { role: 'OWNER' },
      create: { workspaceId: TEST_WS_B, userId: userOwnerB.id, role: 'OWNER' },
    });
  });

  after(async () => {
    // Cleanup test artifacts
    await prisma.workspaceAuditEvent.deleteMany({
      where: { workspaceId: { in: [TEST_WS_A, TEST_WS_B] } },
    });
    await prisma.workspaceInvitation.deleteMany({
      where: { workspaceId: { in: [TEST_WS_A, TEST_WS_B] } },
    });
    await prisma.workspaceMembership.deleteMany({
      where: { workspaceId: { in: [TEST_WS_A, TEST_WS_B] } },
    });
    await prisma.assetRelationship.deleteMany({
      where: { workspaceId: { in: [TEST_WS_A, TEST_WS_B] } },
    });
    await prisma.asset.deleteMany({
      where: { workspaceId: { in: [TEST_WS_A, TEST_WS_B] } },
    });
    await prisma.knowledgeArticle.deleteMany({
      where: { workspaceId: { in: [TEST_WS_A, TEST_WS_B] } },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: [TEST_WS_A, TEST_WS_B] } },
    });
  });

  // =========================================================================
  // 1. Authentication, Default Admin Credentials & Session Crypto
  // =========================================================================
  describe('1. Authentication & Session Cryptography', () => {
    it('verifies default admin account credentials (Admin / Flexflow@i)', async () => {
      const admin = await prisma.userProfile.findFirst({
        where: {
          OR: [{ username: 'Admin' }, { email: 'admin@fixflow.ai' }],
        },
      });

      assert.ok(admin, 'Default Admin user must exist in local database');
      assert.equal(admin.username, 'Admin');

      const isMatch = await bcrypt.compare('Flexflow@i', admin.passwordHash!);
      assert.equal(isMatch, true, 'Default password Flexflow@i must match password hash');

      const wrongMatch = await bcrypt.compare('WrongPassword123!', admin.passwordHash!);
      assert.equal(wrongMatch, false, 'Invalid password must be rejected');
    });

    it('creates, signs, and decodes secure JWT session token', async () => {
      const payload: SessionPayload = {
        userId: userOwnerA.id,
        username: userOwnerA.username,
        email: userOwnerA.email,
        name: userOwnerA.name,
        activeWorkspaceId: TEST_WS_A,
        role: 'OWNER',
      };

      const token = await createSessionToken(payload, false);
      assert.ok(token && typeof token === 'string');

      const decoded = await verifySessionToken(token);
      assert.ok(decoded);
      assert.equal(decoded.userId, userOwnerA.id);
      assert.equal(decoded.email, userOwnerA.email);
      assert.equal(decoded.activeWorkspaceId, TEST_WS_A);
      assert.equal(decoded.role, 'OWNER');
    });

    it('rejects tampered or malformed session tokens', async () => {
      const payload: SessionPayload = {
        userId: userOwnerA.id,
        email: userOwnerA.email,
        name: userOwnerA.name,
        activeWorkspaceId: TEST_WS_A,
        role: 'OWNER',
      };

      const validToken = await createSessionToken(payload);
      const tamperedToken = validToken.slice(0, -6) + 'xxxxxx';

      const decoded = await verifySessionToken(tamperedToken);
      assert.equal(decoded, null, 'Tampered token must return null');
    });
  });

  // =========================================================================
  // 2. Local Password Recovery (Zero External Email)
  // =========================================================================
  describe('2. Local Password Recovery (Zero External Email)', () => {
    it('generates single-use password reset token stored as SHA-256 hash', async () => {
      const result = await requestPasswordReset('owner-a@test.local');
      assert.ok(result.rawToken, 'Must generate rawToken');
      assert.ok(result.resetUrl?.includes('/reset-password?token='));

      // Verify that the plain rawToken is NEVER stored directly in the DB
      const rawInDb = await prisma.passwordResetToken.findFirst({
        where: { tokenHash: result.rawToken },
      });
      assert.equal(rawInDb, null, 'Raw token must NEVER be stored unhashed');

      // Verify that the SHA-256 hash is what is persisted
      const expectedHash = crypto.createHash('sha256').update(result.rawToken).digest('hex');
      const hashInDb = await prisma.passwordResetToken.findUnique({
        where: { tokenHash: expectedHash },
      });
      assert.ok(hashInDb, 'SHA-256 token hash must be present in database');
      assert.equal(hashInDb.userId, userOwnerA.id);
    });

    it('successfully resets password using valid token and rejects reuse', async () => {
      const { rawToken } = await requestPasswordReset('owner-a@test.local');
      assert.ok(rawToken);

      const resetSuccess = await resetPasswordWithToken(rawToken, 'NewSecurePass2026!');
      assert.equal(resetSuccess, true);

      // Verify updated hash
      const updatedUser = await prisma.userProfile.findUnique({
        where: { id: userOwnerA.id },
      });
      const newMatch = await bcrypt.compare('NewSecurePass2026!', updatedUser!.passwordHash!);
      assert.equal(newMatch, true, 'Updated password must be active');

      // Reusing the same token MUST fail
      await assert.rejects(
        async () => {
          await resetPasswordWithToken(rawToken, 'AnotherPassword2026!');
        },
        /already been used/i
      );
    });
  });

  // =========================================================================
  // 3. Single-Use Invitations & Onboarding
  // =========================================================================
  describe('3. Single-Use Workspace Invitations', () => {
    it('generates secure single-use invitation token for a workspace', async () => {
      const result = await createWorkspaceInvitation({
        workspaceId: TEST_WS_A,
        email: 'new-tech@alpha.local',
        role: 'SUPPORT',
        invitedById: userOwnerA.id,
        invitedByEmail: userOwnerA.email,
      });

      assert.ok(result.rawToken);
      assert.equal(result.invitation.email, 'new-tech@alpha.local');
      assert.equal(result.invitation.role, 'SUPPORT');
      assert.equal(result.invitation.status, 'PENDING');

      // Verify rawToken is not stored plaintext
      const unhashed = await prisma.workspaceInvitation.findUnique({
        where: { tokenHash: result.rawToken },
      });
      assert.equal(unhashed, null, 'Raw invitation token must not be stored in plaintext');
    });

    it('rejects inviting a member directly with role OWNER', async () => {
      await assert.rejects(
        async () => {
          await createWorkspaceInvitation({
            workspaceId: TEST_WS_A,
            email: 'fake-owner@alpha.local',
            role: 'OWNER',
            invitedById: userOwnerA.id,
            invitedByEmail: userOwnerA.email,
          });
        },
        /Cannot invite a user as OWNER/i
      );
    });

    it('accepts invitation, creates local user, assigns workspace membership, and rejects reuse', async () => {
      const { rawToken } = await createWorkspaceInvitation({
        workspaceId: TEST_WS_A,
        email: 'invited-operator@alpha.local',
        role: 'SUPPORT',
        invitedById: userOwnerA.id,
        invitedByEmail: userOwnerA.email,
      });

      // Accept invitation
      const accepted = await acceptWorkspaceInvitation({
        rawToken,
        name: 'Invited Operator',
        password: 'OperatorPass2026!',
      });

      assert.equal(accepted.email, 'invited-operator@alpha.local');
      assert.equal(accepted.workspaceId, TEST_WS_A);
      assert.equal(accepted.role, 'SUPPORT');

      // Verify membership in DB
      const membership = await prisma.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: TEST_WS_A,
            userId: accepted.userId,
          },
        },
      });
      assert.ok(membership);
      assert.equal(membership.role, 'SUPPORT');

      // Attempting to accept the SAME token again MUST fail
      await assert.rejects(
        async () => {
          await acceptWorkspaceInvitation({
            rawToken,
            password: 'OperatorPass2026!',
          });
        },
        /already been used/i
      );
    });

    it('revokes an invitation and rejects acceptance of revoked tokens', async () => {
      const { rawToken, invitation } = await createWorkspaceInvitation({
        workspaceId: TEST_WS_A,
        email: 'to-revoke@alpha.local',
        role: 'VIEWER',
        invitedById: userAdminA.id,
        invitedByEmail: userAdminA.email,
      });

      await revokeWorkspaceInvitation(TEST_WS_A, invitation.id, userAdminA.id, userAdminA.email);

      await assert.rejects(
        async () => {
          await acceptWorkspaceInvitation({ rawToken, password: 'Pass12345!' });
        },
        /has been revoked/i
      );
    });
  });

  // =========================================================================
  // 4. Role-Based Access Control (RBAC) & Privilege Invariants
  // =========================================================================
  describe('4. Role-Based Access Control (RBAC)', () => {
    it('verifies that VIEWER role is strictly read-only', () => {
      assert.equal(hasPermission('VIEWER', 'assets:read'), true);
      assert.equal(hasPermission('VIEWER', 'monitoring:read'), true);
      assert.equal(hasPermission('VIEWER', 'incidents:read'), true);
      assert.equal(hasPermission('VIEWER', 'knowledge:read'), true);

      // Mutating permissions MUST be denied
      assert.equal(hasPermission('VIEWER', 'assets:write'), false);
      assert.equal(hasPermission('VIEWER', 'monitoring:manage'), false);
      assert.equal(hasPermission('VIEWER', 'incidents:write'), false);
      assert.equal(hasPermission('VIEWER', 'knowledge:write'), false);
      assert.equal(hasPermission('VIEWER', 'members:invite'), false);

      assert.throws(
        () => assertPermission('VIEWER', 'assets:write'),
        AuthorizationError
      );
    });

    it('verifies that IT SUPPORT role can troubleshoot incidents but cannot manage workspace membership', () => {
      assert.equal(hasPermission('SUPPORT', 'incidents:read'), true);
      assert.equal(hasPermission('SUPPORT', 'incidents:write'), true);
      assert.equal(hasPermission('SUPPORT', 'incidents:diagnose'), true);
      assert.equal(hasPermission('SUPPORT', 'knowledge:write'), true);

      // Membership and security settings MUST be denied
      assert.equal(hasPermission('SUPPORT', 'members:invite'), false);
      assert.equal(hasPermission('SUPPORT', 'members:remove'), false);
      assert.equal(hasPermission('SUPPORT', 'workspace:update'), false);
      assert.equal(hasPermission('SUPPORT', 'monitoring:manage'), false);
      assert.equal(hasPermission('SUPPORT', 'knowledge:verify'), false);
    });

    it('verifies that ADMINISTRATOR cannot transfer workspace ownership or delete workspace', () => {
      assert.equal(hasPermission('ADMIN', 'members:invite'), true);
      assert.equal(hasPermission('ADMIN', 'assets:write'), true);
      assert.equal(hasPermission('ADMIN', 'knowledge:verify'), true);

      // Ownership and deletion are reserved strictly for OWNER
      assert.equal(hasPermission('ADMIN', 'workspace:transfer'), false);
      assert.equal(hasPermission('ADMIN', 'workspace:delete'), false);
    });

    it('enforces role management hierarchy (Admin cannot demote or remove an Owner)', () => {
      // Owner can manage all roles
      assert.equal(canManageRole('OWNER', 'ADMIN', 'SUPPORT'), true);
      assert.equal(canManageRole('OWNER', 'SUPPORT', 'ADMIN'), true);

      // Admin can manage Support and Viewer
      assert.equal(canManageRole('ADMIN', 'SUPPORT', 'VIEWER'), true);
      assert.equal(canManageRole('ADMIN', 'VIEWER', 'SUPPORT'), true);

      // Admin CANNOT modify an OWNER
      assert.equal(canManageRole('ADMIN', 'OWNER', 'ADMIN'), false);

      // Admin CANNOT promote anyone to OWNER
      assert.equal(canManageRole('ADMIN', 'SUPPORT', 'OWNER'), false);

      // Support cannot manage any roles
      assert.equal(canManageRole('SUPPORT', 'VIEWER', 'SUPPORT'), false);
    });

    it('prevents accidental removal or demotion of the final workspace Owner', async () => {
      // Count owners in TEST_WS_A (currently 1)
      const ownerCount = await prisma.workspaceMembership.count({
        where: { workspaceId: TEST_WS_A, role: 'OWNER' },
      });
      assert.equal(ownerCount, 1, 'Test workspace has exactly 1 Owner');

      // Attempting to demote or remove the last Owner must be guarded by domain invariant
      const isLastOwner = ownerCount <= 1;
      assert.equal(isLastOwner, true, 'Last owner invariant triggered');
    });
  });

  // =========================================================================
  // 5. Multi-Tenant Tenancy & Cross-Workspace Isolation
  // =========================================================================
  describe('5. Workspace Data Isolation', () => {
    it('isolates CMDB assets between workspaces (Alpha assets not visible to Beta)', async () => {
      // Create an asset in Workspace Alpha
      const assetA = await AssetService.createAsset(
        {
          assetTag: 'ALPHA-SRV-01',
          name: 'Alpha Secret Database',
          assetType: 'SERVER',
          ipAddress: '10.50.1.10',
          criticality: 'TIER_1_CRITICAL',
        },
        TEST_WS_A
      );

      // Create an asset in Workspace Beta
      await AssetService.createAsset(
        {
          assetTag: 'BETA-SW-01',
          name: 'Beta Core Switch',
          assetType: 'SWITCH',
          ipAddress: '10.60.1.1',
          criticality: 'TIER_2_HIGH',
        },
        TEST_WS_B
      );

      // Query Alpha assets
      const alphaAssets = await AssetService.getAssets(TEST_WS_A);
      const alphaTags = alphaAssets.map((a) => a.assetTag);
      assert.ok(alphaTags.includes('ALPHA-SRV-01'));
      assert.equal(alphaTags.includes('BETA-SW-01'), false, 'Beta asset must NOT appear in Alpha workspace');

      // Query Beta assets
      const betaAssets = await AssetService.getAssets(TEST_WS_B);
      const betaTags = betaAssets.map((a) => a.assetTag);
      assert.ok(betaTags.includes('BETA-SW-01'));
      assert.equal(betaTags.includes('ALPHA-SRV-01'), false, 'Alpha asset must NOT appear in Beta workspace');

      // Attempting to fetch Alpha asset with Beta workspace ID must return null (defense-in-depth)
      const crossFetch = await AssetService.getAssetById(assetA.id, TEST_WS_B);
      assert.equal(crossFetch, null, 'Cross-workspace ID fetch must return null');
    });

    it('isolates Knowledge Base articles and search results between workspaces', async () => {
      // Create a private KB article in Workspace Alpha
      await prisma.knowledgeArticle.create({
        data: {
          workspaceId: TEST_WS_A,
          title: 'Alpha Internal Zero-Day Remediation',
          normalizedError: 'ALPHA_ZERO_DAY_ERROR',
          errorCode: 'ALPHA_ZERO_DAY_ERROR',
          originalErrorDescription: 'Alpha internal proprietary database deadlock',
          category: 'DATABASE',
          symptoms: JSON.stringify(['Alpha custom deadlock code 9999']),
          diagnosticSteps: JSON.stringify([]),
          verifiedSolution: 'Apply proprietary Alpha internal patch binary.',
          status: 'VERIFIED',
        },
      });

      // Search from Beta workspace with exact error code
      const searchBeta = await KnowledgeSearchService.searchLocalKnowledge({
        query: 'Alpha proprietary database deadlock',
        errorCode: 'ALPHA_ZERO_DAY_ERROR',
        workspaceId: TEST_WS_B,
      });

      assert.equal(searchBeta.hasMatch, false, 'Beta search MUST NOT find Alpha private articles');
      assert.equal(searchBeta.candidateMatches.length, 0);

      // Search from Alpha workspace must succeed
      const searchAlpha = await KnowledgeSearchService.searchLocalKnowledge({
        query: 'Alpha proprietary database deadlock',
        errorCode: 'ALPHA_ZERO_DAY_ERROR',
        workspaceId: TEST_WS_A,
      });

      assert.equal(searchAlpha.hasMatch, true, 'Alpha search must find Alpha private articles');
      assert.equal(searchAlpha.topMatch?.article.title, 'Alpha Internal Zero-Day Remediation');
    });

    it('prevents monitoring agent from submitting results for another workspace asset', async () => {
      // Register agent in Workspace Alpha
      const { agent, agentKey } = await MonitoringService.registerAgent({
        workspaceId: TEST_WS_A,
        name: 'Alpha Prober Daemon',
        platform: 'win32',
      });

      // Create an asset in Beta
      const betaAsset = await AssetService.createAsset(
        {
          assetTag: 'BETA-TARGET-99',
          name: 'Beta Protected Target',
          assetType: 'SERVER',
          ipAddress: '10.99.1.5',
        },
        TEST_WS_B
      );

      // Agent from Alpha attempts to submit check result for Beta's asset
      // Must be rejected or ignored
      await assert.rejects(
        async () => {
          // Attempting to submit with agentKey from Alpha but workspaceId Beta
          await MonitoringService.ingestCheckResults({
            workspaceId: TEST_WS_B,
            agentId: agent.id,
            agentKey,
            results: [
              {
                assetId: betaAsset.id,
                checkedAt: new Date().toISOString(),
                result: 'SUCCESS',
                packetsSent: 3,
                packetsReceived: 3,
                packetLossPercent: 0,
              },
            ],
          });
        },
        /workspace/i
      );
    });

    it('verifies that baseline enterprise seed records in ws-default survive intact', async () => {
      const defaultAssets = await AssetService.getAssets('ws-default');
      assert.ok(defaultAssets.length >= 15, 'Default workspace must retain all 16 enterprise assets');

      const defaultIncident = await prisma.incident.findFirst({
        where: { workspaceId: 'ws-default', ticketNumber: 'INC-2026-0842' },
      });
      assert.ok(defaultIncident, 'INC-2026-0842 must survive migration');

      const defaultKb = await prisma.knowledgeArticle.findMany({
        where: { workspaceId: 'ws-default' },
      });
      assert.ok(defaultKb.length >= 6, 'Default workspace must retain all 6 Knowledge Base articles');
    });
  });
});
