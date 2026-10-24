// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);

    if (!session) {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    const userWithWorkspaces = await prisma.userProfile.findUnique({
      where: { id: session.userId },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!userWithWorkspaces || !userWithWorkspaces.isActive) {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    const availableWorkspaces = userWithWorkspaces.memberships.map((m) => ({
      id: m.workspaceId,
      name: m.workspace.name,
      description: m.workspace.description,
      role: m.role,
    }));

    const activeMembership = userWithWorkspaces.memberships.find(
      (m) => m.workspaceId === session.activeWorkspaceId
    ) || userWithWorkspaces.memberships[0];

    return NextResponse.json({
      success: true,
      user: {
        id: userWithWorkspaces.id,
        email: userWithWorkspaces.email,
        name: userWithWorkspaces.name,
        avatarUrl: userWithWorkspaces.avatarUrl,
        activeWorkspaceId: activeMembership?.workspaceId,
        activeWorkspaceName: activeMembership?.workspace.name,
        activeRole: activeMembership?.role,
        availableWorkspaces,
      },
    });
  } catch (err: any) {
    console.error('Session lookup error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to verify session' },
      { status: 500 }
    );
  }
}
