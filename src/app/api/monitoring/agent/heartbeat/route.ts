// src/app/api/monitoring/agent/heartbeat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';
import { MonitoringAgentHeartbeatSchema } from '@/lib/validation/monitoringSchemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = MonitoringAgentHeartbeatSchema.parse(body);

    const result = await MonitoringService.recordHeartbeat(data.agentId, data.agentKey);

    return NextResponse.json({
      success: true,
      heartbeatAt: result.timestamp,
    });
  } catch (error: any) {
    const status = error.message?.includes('Authentication')
      ? 401
      : error.message?.includes('Authorization')
      ? 403
      : error.name === 'ZodError'
      ? 400
      : 500;

    return NextResponse.json(
      { success: false, error: error.message || 'Heartbeat rejected' },
      { status }
    );
  }
}
