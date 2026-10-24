// src/app/api/monitoring/agents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';

    await MonitoringService.revokeAgent(id, workspaceId);

    return NextResponse.json({
      success: true,
      message: 'Agent credential successfully revoked.',
    });
  } catch (error: any) {
    console.error('Error revoking agent:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to revoke agent' },
      { status: 500 }
    );
  }
}
