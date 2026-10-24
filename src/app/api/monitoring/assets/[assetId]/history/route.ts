// src/app/api/monitoring/assets/[assetId]/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';

    const history = await MonitoringService.getAssetMonitoringHistory(assetId, workspaceId);

    return NextResponse.json({
      success: true,
      ...history,
    });
  } catch (error: any) {
    console.error('Error fetching asset monitoring history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch asset history' },
      { status: 500 }
    );
  }
}
