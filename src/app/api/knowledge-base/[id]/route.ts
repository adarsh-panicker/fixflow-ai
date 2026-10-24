// src/app/api/knowledge-base/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '@/lib/services/knowledgeBaseService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const context = await getAuthorizedWorkspaceContext(request, 'knowledge:read');

    const article = await KnowledgeBaseService.getArticleById(id, context.workspaceId);

    if (!article) {
      return NextResponse.json(
        { success: false, error: `Knowledge article '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      article,
    });
  } catch (error: any) {
    console.error('Error fetching knowledge article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch article' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const context = await getAuthorizedWorkspaceContext(request, 'knowledge:write');
    const body = await request.json();

    const article = await KnowledgeBaseService.updateArticle(id, body, context.workspaceId);

    return NextResponse.json({
      success: true,
      article,
    });
  } catch (error: any) {
    console.error('Error updating knowledge article:', error);
    const status = error.statusCode || (error.name === 'ZodError' ? 400 : 422);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update article' },
      { status }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const context = await getAuthorizedWorkspaceContext(request, 'knowledge:archive');

    const article = await KnowledgeBaseService.archiveArticle(id, context.workspaceId);

    return NextResponse.json({
      success: true,
      article,
      message: 'Article successfully archived',
    });
  } catch (error: any) {
    console.error('Error archiving knowledge article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to archive article' },
      { status: error.statusCode || 500 }
    );
  }
}
