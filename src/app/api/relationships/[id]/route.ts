// src/app/api/relationships/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/lib/services/assetService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getAuthorizedWorkspaceContext(request, 'assets:write');
    const body = await request.json();

    const updated = await AssetService.updateRelationship(id, body, context.workspaceId);

    return NextResponse.json({ success: true, relationship: updated });
  } catch (error: any) {
    const status = error.statusCode || (error.name === 'ZodError' ? 400 : 422);
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
    const context = await getAuthorizedWorkspaceContext(request, 'assets:write');

    await AssetService.deleteRelationship(id, context.workspaceId);

    return NextResponse.json({ success: true, message: 'Relationship detached successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to detach relationship' },
      { status: error.statusCode || 422 }
    );
  }
}
