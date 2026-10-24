// src/app/api/monitoring/incidents/[id]/acknowledge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getAuthorizedWorkspaceContext(request, 'monitoring:acknowledge');
    const body = await request.json().catch(() => ({}));
    const acknowledgedBy = context.user.name || body.acknowledgedBy || 'Lead Incident Technician';
    const notes = body.notes || undefined;

    const incident = await MonitoringService.acknowledgeIncident(id, acknowledgedBy, notes, context.workspaceId);

    return NextResponse.json({
      success: true,
      incident,
    });
  } catch (error: any) {
    console.error('Error acknowledging availability incident:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to acknowledge incident' },
      { status: error.statusCode || 500 }
    );
  }
}
