// src/app/api/workspace/members/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';
import { createWorkspaceInvitation } from '@/lib/auth/invitationService';
import { canManageRole } from '@/lib/auth/rbac';
import { WorkspaceRole } from '@/types/auth';

const inviteSchema = z.object({
  email: z.string().email('Valid email address is required'),
  role: z.enum(['ADMIN', 'SUPPORT', 'VIEWER']),
});

export async function GET(req: Request) {
  try {
    const context = await getAuthorizedWorkspaceContext(req, 'members:read');

    // Fetch members scoped to this workspace
    const members = await prisma.workspaceMembership.findMany({
      where: { workspaceId: context.workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Fetch pending invitations scoped to this workspace
    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        workspaceId: context.workspaceId,
        status: 'PENDING',
      },
      include: {
        invitedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role as WorkspaceRole,
        joinedAt: m.joinedAt.toISOString(),
        avatarUrl: m.user.avatarUrl,
      })),
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role as WorkspaceRole,
        status: inv.status,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        invitedByName: inv.invitedBy?.name || 'Administrator',
      })),
      currentUserRole: context.role,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch workspace members' },
      { status: err.statusCode || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const context = await getAuthorizedWorkspaceContext(req, 'members:invite');
    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid invitation data' },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;

    // Check if actor has permission to grant this role
    if (!canManageRole(context.role, undefined, role)) {
      return NextResponse.json(
        { success: false, error: `Your role (${context.role}) cannot grant the ${role} role` },
        { status: 403 }
      );
    }

    const result = await createWorkspaceInvitation({
      workspaceId: context.workspaceId,
      email,
      role: role as WorkspaceRole,
      invitedById: context.user.userId,
      invitedByEmail: context.user.email,
    });

    return NextResponse.json({
      success: true,
      message: `Invitation generated for ${email}`,
      invitation: result.invitation,
      inviteUrl: result.inviteUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to issue invitation' },
      { status: err.statusCode || 400 }
    );
  }
}
