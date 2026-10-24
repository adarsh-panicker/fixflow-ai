// src/app/api/monitoring/agent/assignments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = request.headers.get('x-agent-id') || searchParams.get('agentId');
    const agentKey = request.headers.get('x-agent-key') || searchParams.get('agentKey');
    const workspaceId = request.headers.get('x-workspace-id') || searchParams.get('workspaceId') || 'ws-default';

    if (!agentId || !agentKey) {
      return NextResponse.json(
        { success: false, error: 'Authentication required: Provide agentId and agentKey in headers or query params.' },
        { status: 401 }
      );
    }

    const assignments = await MonitoringService.getAgentAssignments(agentId, agentKey, workspaceId);

    return NextResponse.json({
      success: true,
      agentId,
      workspaceId,
      count: assignments.length,
      assignments,
    });
  } catch (error: any) {
    const status = error.message?.includes('Authentication')
      ? 401
      : error.message?.includes('Authorization')
      ? 403
      : 500;

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch assignments' },
      { status }
    );
  }
}
