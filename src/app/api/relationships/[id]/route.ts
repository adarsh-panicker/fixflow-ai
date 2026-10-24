// src/app/api/relationships/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/lib/services/assetService';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId || 'ws-default';

    const updated = await AssetService.updateRelationship(id, body, workspaceId);

    return NextResponse.json({ success: true, relationship: updated });
  } catch (error: any) {
    const status = error.name === 'ZodError' ? 400 : 422;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update relationship' },
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
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';

    await AssetService.deleteRelationship(id, workspaceId);

    return NextResponse.json({ success: true, message: 'Relationship detached successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to detach relationship' },
      { status: 422 }
    );
  }
}
