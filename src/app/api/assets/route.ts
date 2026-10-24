// src/app/api/assets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/lib/services/assetService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'assets:read');
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || undefined;
    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;
    const criticality = searchParams.get('criticality') || undefined;

    const assets = await AssetService.getAssets(context.workspaceId, {
      search,
      type,
      status,
      criticality,
    });

    return NextResponse.json({ success: true, count: assets.length, assets, workspaceId: context.workspaceId });
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch assets' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'assets:write');
    const body = await request.json();

    const asset = await AssetService.createAsset(body, context.workspaceId);

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating asset:', error);
    const status = error.statusCode || (error.name === 'ZodError' ? 400 : 422);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation failed' },
      { status }
    );
  }
}
