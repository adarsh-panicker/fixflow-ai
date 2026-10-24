// src/app/api/monitoring/agents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'monitoring:read');
    const agents = await MonitoringService.getAgents(context.workspaceId);

    return NextResponse.json({
      success: true,
      count: agents.length,
      agents,
      workspaceId: context.workspaceId,
    });
  } catch (error: any) {
    console.error('Error listing monitoring agents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list agents' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'monitoring:manage');
    const body = await request.json();

    const result = await MonitoringService.registerAgent({
      ...body,
      workspaceId: context.workspaceId,
    });

    return NextResponse.json({
      success: true,
      agent: result.agent,
      agentKey: result.agentKey,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error registering monitoring agent:', error);
    const status = error.statusCode || (error.name === 'ZodError' ? 400 : 422);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation failed' },
      { status }
    );
  }
}
