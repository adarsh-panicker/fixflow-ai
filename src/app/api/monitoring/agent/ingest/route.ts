// src/app/api/monitoring/agent/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await MonitoringService.ingestCheckResults(body);

    return NextResponse.json({
      success: true,
      ingestedCount: result.ingestedCount,
      agentId: result.agentId,
    });
  } catch (error: any) {
    console.error('Error ingesting monitoring results:', error);
    const status = error.message?.includes('Authentication')
      ? 401
      : error.message?.includes('Authorization')
      ? 403
      : error.name === 'ZodError'
      ? 400
      : 500;

    return NextResponse.json(
      { success: false, error: error.message || 'Ingestion failed' },
      { status }
    );
  }
}
