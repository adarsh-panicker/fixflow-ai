// src/app/api/monitoring/incidents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';
    const status = searchParams.get('status') || undefined;

    const where: any = { workspaceId };
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const incidents = await prisma.availabilityIncident.findMany({
      where,
      orderBy: { thresholdCrossedAt: 'desc' },
      include: {
        asset: {
          select: { id: true, assetTag: true, name: true, assetType: true, criticality: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: incidents.length,
      incidents,
    });
  } catch (error: any) {
    console.error('Error fetching availability incidents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}
