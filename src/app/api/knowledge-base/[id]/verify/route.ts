// src/app/api/knowledge-base/[id]/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '@/lib/services/knowledgeBaseService';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';
    
    let verifiedBy = 'Senior Systems Administrator';
    try {
      const body = await request.json();
      if (body.verifiedBy) {
        verifiedBy = body.verifiedBy;
      }
    } catch {
      // Body may be empty, use default verifiedBy
    }

    const article = await KnowledgeBaseService.verifyArticle(id, verifiedBy, workspaceId);

    return NextResponse.json({
      success: true,
      article,
      message: 'Article successfully verified and promoted to active recommendations',
    });
  } catch (error: any) {
    console.error('Error verifying knowledge article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify article' },
      { status: 500 }
    );
  }
}
