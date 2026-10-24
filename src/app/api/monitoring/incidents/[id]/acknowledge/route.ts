// src/app/api/monitoring/incidents/[id]/acknowledge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const acknowledgedBy = body.acknowledgedBy || 'Lead Incident Technician';
    const notes = body.notes || undefined;
    const workspaceId = body.workspaceId || 'ws-default';

    const incident = await MonitoringService.acknowledgeIncident(id, acknowledgedBy, notes, workspaceId);

    return NextResponse.json({
      success: true,
      incident,
    });
  } catch (error: any) {
    console.error('Error acknowledging availability incident:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to acknowledge incident' },
      { status: 500 }
    );
  }
}
