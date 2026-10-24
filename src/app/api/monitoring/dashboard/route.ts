// src/app/api/monitoring/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'monitoring:read');
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const agentId = searchParams.get('agentId') || undefined;

    const [summary, rows] = await Promise.all([
      MonitoringService.getDashboardSummary(context.workspaceId),
      MonitoringService.getMonitoredAssetRows(context.workspaceId, { search, status, agentId }),
    ]);

    return NextResponse.json({
      success: true,
      summary,
      rows,
      workspaceId: context.workspaceId,
    });
  } catch (error: any) {
    console.error('Error fetching monitoring dashboard data:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch monitoring dashboard data' },
      { status: error.statusCode || 500 }
    );
  }
}
