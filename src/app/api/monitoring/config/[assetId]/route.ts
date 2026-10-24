// src/app/api/monitoring/config/[assetId]/route.ts
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

    const config = await MonitoringService.getConfigByAssetId(assetId, workspaceId);

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error('Error fetching asset monitoring config:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch monitoring config' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId || 'ws-default';

    const config = await MonitoringService.upsertConfig({
      ...body,
      assetId,
    }, workspaceId);

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error('Error updating asset monitoring config:', error);
    const status = error.name === 'ZodError' ? 400 : 422;
    return NextResponse.json(
      { success: false, error: error.message || 'Validation failed' },
      { status }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  return POST(request, context);
}
