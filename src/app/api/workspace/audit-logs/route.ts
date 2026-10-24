// src/app/api/workspace/audit-logs/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function GET(req: Request) {
  try {
    const context = await getAuthorizedWorkspaceContext(req, 'audit:read');

    const logs = await prisma.workspaceAuditEvent.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        actorEmail: log.actorEmail,
        targetType: log.targetType,
        targetId: log.targetId,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch audit logs' },
      { status: err.statusCode || 500 }
    );
  }
}
