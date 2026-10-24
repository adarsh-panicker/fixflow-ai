// src/app/api/workspaces/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireSession } from '@/lib/auth/session';

const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  description: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);

    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId: session.userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        description: m.workspace.description,
        role: m.role,
        isActive: m.workspace.id === session.activeWorkspaceId,
        joinedAt: m.joinedAt.toISOString(),
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unauthorized' },
      { status: 401 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession(req);
    const body = await req.json();
    const parsed = createWorkspaceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid workspace data' },
        { status: 400 }
      );
    }

    const { name, description } = parsed.data;

    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: name.trim(),
          description: description?.trim(),
        },
      });

      await tx.workspaceMembership.create({
        data: {
          workspaceId: ws.id,
          userId: session.userId,
          role: 'OWNER',
        },
      });

      await tx.workspaceAuditEvent.create({
        data: {
          workspaceId: ws.id,
          actorId: session.userId,
          actorEmail: session.email,
          eventType: 'WORKSPACE_CREATED',
          targetType: 'WORKSPACE',
          targetId: ws.id,
          metadata: JSON.stringify({ name }),
        },
      });

      return ws;
    });

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        role: 'OWNER',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
