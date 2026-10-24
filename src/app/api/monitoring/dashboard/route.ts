// src/app/api/monitoring/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const agentId = searchParams.get('agentId') || undefined;

    const [summary, rows] = await Promise.all([
      MonitoringService.getDashboardSummary(workspaceId),
      MonitoringService.getMonitoredAssetRows(workspaceId, { search, status, agentId }),
    ]);

    return NextResponse.json({
      success: true,
      summary,
      rows,
    });
  } catch (error: any) {
    console.error('Error fetching monitoring dashboard data:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch monitoring dashboard data' },
      { status: 500 }
    );
  }
}
