// src/app/api/workspace/members/[userId]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getAuthorizedWorkspaceContext, recordAuditEvent } from '@/lib/auth/workspaceContext';
import { canManageRole } from '@/lib/auth/rbac';
import { WorkspaceRole } from '@/types/auth';

const updateRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'SUPPORT', 'VIEWER']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const context = await getAuthorizedWorkspaceContext(req, 'members:update_role');
    const body = await req.json();
    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
    }

    const newRole = parsed.data.role as WorkspaceRole;

    // Find target membership in current workspace
    const targetMembership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: context.workspaceId,
          userId: targetUserId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { success: false, error: 'Member not found in this workspace' },
        { status: 404 }
      );
    }

    const currentRole = targetMembership.role as WorkspaceRole;

    // Invariant: Prevent removing the final workspace OWNER
    if (currentRole === 'OWNER' && newRole !== 'OWNER') {
      const ownerCount = await prisma.workspaceMembership.count({
        where: {
          workspaceId: context.workspaceId,
          role: 'OWNER',
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot demote the last remaining workspace Owner. Assign another Owner first.',
          },
          { status: 400 }
        );
      }
    }

    // Role hierarchy permission check
    if (!canManageRole(context.role, currentRole, newRole)) {
      return NextResponse.json(
        {
          success: false,
          error: `Your role (${context.role}) does not have permission to change a ${currentRole} to ${newRole}`,
        },
        { status: 403 }
      );
    }

    // Update role
    const updated = await prisma.workspaceMembership.update({
      where: { id: targetMembership.id },
      data: { role: newRole },
    });

    // Record audit log
    await recordAuditEvent(context.workspaceId, context.user.email, 'ROLE_CHANGED', {
      actorId: context.user.userId,
      targetType: 'USER',
      targetId: targetUserId,
      metadata: {
        targetEmail: targetMembership.user.email,
        oldRole: currentRole,
        newRole,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Role updated to ${newRole}`,
      member: {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update member role' },
      { status: err.statusCode || 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const context = await getAuthorizedWorkspaceContext(req, 'members:remove');

    const targetMembership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: context.workspaceId,
          userId: targetUserId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { success: false, error: 'Member not found in this workspace' },
        { status: 404 }
      );
    }

    const currentRole = targetMembership.role as WorkspaceRole;

    // Invariant: Prevent removing the last remaining OWNER
    if (currentRole === 'OWNER') {
      const ownerCount = await prisma.workspaceMembership.count({
        where: {
          workspaceId: context.workspaceId,
          role: 'OWNER',
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot remove the last remaining workspace Owner. Transfer ownership first.',
          },
          { status: 400 }
        );
      }
    }

    // Check authority to remove
    if (!canManageRole(context.role, currentRole)) {
      return NextResponse.json(
        {
          success: false,
          error: `Your role (${context.role}) cannot remove a ${currentRole}`,
        },
        { status: 403 }
      );
    }

    // Delete membership
    await prisma.workspaceMembership.delete({
      where: { id: targetMembership.id },
    });

    await recordAuditEvent(context.workspaceId, context.user.email, 'MEMBER_REMOVED', {
      actorId: context.user.userId,
      targetType: 'USER',
      targetId: targetUserId,
      metadata: {
        removedEmail: targetMembership.user.email,
        formerRole: currentRole,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Member removed from workspace successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to remove member' },
      { status: err.statusCode || 500 }
    );
  }
}
