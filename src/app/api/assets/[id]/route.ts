// src/app/api/assets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/lib/services/assetService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getAuthorizedWorkspaceContext(request, 'assets:read');

    const asset = await AssetService.getAssetById(id, context.workspaceId);

    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, asset });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch asset' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getAuthorizedWorkspaceContext(request, 'assets:write');
    const body = await request.json();

    const updated = await AssetService.updateAsset(id, body, context.workspaceId);

    return NextResponse.json({ success: true, asset: updated });
  } catch (error: any) {
    const status = error.statusCode || (error.name === 'ZodError' ? 400 : 422);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update asset' },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getAuthorizedWorkspaceContext(request, 'assets:delete');

    await AssetService.deleteAsset(id, context.workspaceId);

    return NextResponse.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete asset' },
      { status: error.statusCode || 422 }
    );
  }
}
