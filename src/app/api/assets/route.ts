// src/app/api/assets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/lib/services/assetService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';
    const search = searchParams.get('search') || undefined;
    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;
    const criticality = searchParams.get('criticality') || undefined;

    const assets = await AssetService.getAssets(workspaceId, {
      search,
      type,
      status,
      criticality,
    });

    return NextResponse.json({ success: true, count: assets.length, assets });
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId || 'ws-default';

    const asset = await AssetService.createAsset(body, workspaceId);

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating asset:', error);
    const status = error.name === 'ZodError' ? 400 : 422;
    return NextResponse.json(
      { success: false, error: error.message || 'Validation failed' },
      { status }
    );
  }
}
