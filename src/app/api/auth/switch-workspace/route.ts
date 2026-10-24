// src/app/api/auth/switch-workspace/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getSession, createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { WorkspaceRole } from '@/types/auth';

const switchSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid workspace ID' }, { status: 400 });
    }

    const { workspaceId } = parsed.data;

    // Verify user is a member of this target workspace
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.userId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'You are not a member of the requested workspace' },
        { status: 403 }
      );
    }

    // Generate new session token with updated activeWorkspaceId and role
    const newToken = await createSessionToken({
      userId: session.userId,
      email: session.email,
      name: session.name,
      activeWorkspaceId: membership.workspaceId,
      role: membership.role as WorkspaceRole,
      avatarUrl: session.avatarUrl,
    });

    await setSessionCookie(newToken);

    return NextResponse.json({
      success: true,
      activeWorkspaceId: membership.workspaceId,
      activeWorkspaceName: membership.workspace.name,
      role: membership.role,
    });
  } catch (err: any) {
    console.error('Workspace switch error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to switch workspace' },
      { status: 500 }
    );
  }
}
