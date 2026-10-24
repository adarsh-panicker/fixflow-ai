// src/app/api/relationships/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/lib/services/assetService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'assets:read');
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;

    const relationships = await AssetService.getRelationships(context.workspaceId, type);

    return NextResponse.json({ success: true, count: relationships.length, relationships });
  } catch (error: any) {
    console.error('Error fetching relationships:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch relationships' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'assets:write');
    const body = await request.json();

    const relationship = await AssetService.createRelationship(body, context.workspaceId);

    return NextResponse.json({ success: true, relationship }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating relationship:', error);
    const status = error.statusCode || (error.name === 'ZodError' ? 400 : 422);
    return NextResponse.json(
      { success: false, error: error.message || 'Validation failed' },
      { status }
    );
  }
}
