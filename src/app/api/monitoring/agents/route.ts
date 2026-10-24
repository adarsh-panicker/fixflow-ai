// src/app/api/monitoring/agents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';

    const agents = await MonitoringService.getAgents(workspaceId);

    return NextResponse.json({
      success: true,
      count: agents.length,
      agents,
    });
  } catch (error: any) {
    console.error('Error listing monitoring agents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list agents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await MonitoringService.registerAgent(body);

    return NextResponse.json({
      success: true,
      agent: result.agent,
      agentKey: result.agentKey,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error registering monitoring agent:', error);
    const status = error.name === 'ZodError' ? 400 : 422;
    return NextResponse.json(
      { success: false, error: error.message || 'Validation failed' },
      { status }
    );
  }
}
