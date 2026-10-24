// src/app/api/knowledge-base/[id]/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '@/lib/services/knowledgeBaseService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const context = await getAuthorizedWorkspaceContext(request, 'knowledge:verify');
    
    let verifiedBy = context.user.name || 'Senior Systems Administrator';
    try {
      const body = await request.json();
      if (body.verifiedBy) {
        verifiedBy = body.verifiedBy;
      }
    } catch {
      // Body may be empty, use context.user.name
    }

    const article = await KnowledgeBaseService.verifyArticle(id, verifiedBy, context.workspaceId);

    return NextResponse.json({
      success: true,
      article,
      message: 'Article successfully verified and promoted to active recommendations',
    });
  } catch (error: any) {
    console.error('Error verifying knowledge article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify article' },
      { status: error.statusCode || 500 }
    );
  }
}
