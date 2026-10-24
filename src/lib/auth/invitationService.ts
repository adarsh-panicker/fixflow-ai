// src/lib/auth/invitationService.ts
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { WorkspaceRole, WorkspaceInvitationDTO } from '@/types/auth';
import { recordAuditEvent } from './workspaceContext';

export interface CreateInvitationParams {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedById: string;
  invitedByEmail: string;
}

export interface AcceptInvitationParams {
  rawToken: string;
  name?: string;
  password?: string;
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Creates a cryptographically secure single-use workspace invitation.
 */
export async function createWorkspaceInvitation(
  params: CreateInvitationParams
): Promise<{ rawToken: string; invitation: WorkspaceInvitationDTO; inviteUrl: string }> {
  const normalizedEmail = params.email.trim().toLowerCase();

  // Validate role - Owners cannot be invited
  if (params.role === 'OWNER') {
    throw new Error('Cannot invite a user as OWNER. Ownership must be transferred by the current owner.');
  }

  // Check if user is already a member
  const existingUser = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
    include: {
      memberships: {
        where: { workspaceId: params.workspaceId },
      },
    },
  });

  if (existingUser && existingUser.memberships.length > 0) {
    throw new Error(`User with email '${normalizedEmail}' is already a member of this workspace.`);
  }

  // Generate 256-bit cryptographically secure raw token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  // Set 7-day expiration
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Expire or revoke any existing pending invitations for this email in this workspace
  await prisma.workspaceInvitation.updateMany({
    where: {
      workspaceId: params.workspaceId,
      email: normalizedEmail,
      status: 'PENDING',
    },
    data: {
      status: 'REVOKED',
    },
  });

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: params.workspaceId,
      email: normalizedEmail,
      role: params.role,
      tokenHash,
      invitedById: params.invitedById,
      status: 'PENDING',
      expiresAt,
    },
    include: {
      invitedBy: true,
    },
  });

  // Record audit log
  await recordAuditEvent(params.workspaceId, params.invitedByEmail, 'INVITATION_CREATED', {
    actorId: params.invitedById,
    targetType: 'INVITATION',
    targetId: invitation.id,
    metadata: {
      invitedEmail: normalizedEmail,
      role: params.role,
      expiresAt: expiresAt.toISOString(),
    },
  });

  const inviteUrl = `/accept-invitation?token=${rawToken}`;

  return {
    rawToken,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role as WorkspaceRole,
      status: invitation.status as any,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      invitedByName: invitation.invitedBy?.name || 'Administrator',
    },
    inviteUrl,
  };
}

/**
 * Validates a raw invitation token and returns the invitation and workspace metadata.
 */
export async function getInvitationByToken(rawToken: string) {
  if (!rawToken || rawToken.trim().length === 0) {
    throw new Error('Invitation token is required');
  }

  const tokenHash = hashToken(rawToken.trim());

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash },
    include: {
      workspace: true,
      invitedBy: true,
    },
  });

  if (!invitation) {
    throw new Error('Invalid or unknown invitation token.');
  }

  if (invitation.status === 'REVOKED') {
    throw new Error('This invitation has been revoked by a workspace administrator.');
  }

  if (invitation.status === 'ACCEPTED') {
    throw new Error('This invitation has already been used.');
  }

  if (new Date() > invitation.expiresAt) {
    // Update to EXPIRED for cleanliness
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    });
    throw new Error('This invitation has expired. Please request a new invitation.');
  }

  return invitation;
}

/**
 * Accepts a workspace invitation within an atomic transaction.
 */
export async function acceptWorkspaceInvitation(params: AcceptInvitationParams) {
  await getInvitationByToken(params.rawToken);
  const tokenHash = hashToken(params.rawToken.trim());

  return await prisma.$transaction(async (tx) => {
    // 1. Double check invitation is still pending inside transaction
    const lockedInvite = await tx.workspaceInvitation.findUnique({
      where: { tokenHash },
    });

    if (!lockedInvite || lockedInvite.status !== 'PENDING') {
      throw new Error('Invitation has already been accepted or is no longer valid.');
    }

    // 2. Find or create user profile
    let user = await tx.userProfile.findUnique({
      where: { email: lockedInvite.email },
    });

    if (!user) {
      if (!params.password) {
        throw new Error('A password is required to create a new user profile.');
      }
      const passwordHash = await bcrypt.hash(params.password, 10);
      user = await tx.userProfile.create({
        data: {
          email: lockedInvite.email,
          name: params.name?.trim() || lockedInvite.email.split('@')[0],
          passwordHash,
          emailVerified: new Date(),
        },
      });
    }

    // 3. Create or update workspace membership
    await tx.workspaceMembership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: lockedInvite.workspaceId,
          userId: user.id,
        },
      },
      update: {
        role: lockedInvite.role,
      },
      create: {
        workspaceId: lockedInvite.workspaceId,
        userId: user.id,
        role: lockedInvite.role,
      },
    });

    // 4. Mark invitation as accepted
    await tx.workspaceInvitation.update({
      where: { id: lockedInvite.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    // 5. Record Audit Events
    await tx.workspaceAuditEvent.create({
      data: {
        workspaceId: lockedInvite.workspaceId,
        actorId: user.id,
        actorEmail: user.email,
        eventType: 'INVITATION_ACCEPTED',
        targetType: 'INVITATION',
        targetId: lockedInvite.id,
        metadata: JSON.stringify({ role: lockedInvite.role }),
      },
    });

    await tx.workspaceAuditEvent.create({
      data: {
        workspaceId: lockedInvite.workspaceId,
        actorId: user.id,
        actorEmail: user.email,
        eventType: 'MEMBER_ADDED',
        targetType: 'USER',
        targetId: user.id,
        metadata: JSON.stringify({ role: lockedInvite.role, source: 'INVITATION' }),
      },
    });

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      workspaceId: lockedInvite.workspaceId,
      role: lockedInvite.role as WorkspaceRole,
    };
  });
}

/**
 * Revokes a pending workspace invitation.
 */
export async function revokeWorkspaceInvitation(
  workspaceId: string,
  invitationId: string,
  actorId: string,
  actorEmail: string
) {
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: { id: invitationId, workspaceId },
  });

  if (!invitation) {
    throw new Error('Invitation not found in this workspace.');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error(`Cannot revoke invitation with status '${invitation.status}'.`);
  }

  await prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { status: 'REVOKED' },
  });

  await recordAuditEvent(workspaceId, actorEmail, 'INVITATION_REVOKED', {
    actorId,
    targetType: 'INVITATION',
    targetId: invitationId,
    metadata: { email: invitation.email },
  });

  return { success: true };
}
