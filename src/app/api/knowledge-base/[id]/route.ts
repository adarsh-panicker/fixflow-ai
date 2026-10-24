// src/app/api/knowledge-base/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '@/lib/services/knowledgeBaseService';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';

    const article = await KnowledgeBaseService.getArticleById(id, workspaceId);

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
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';
    const body = await request.json();

    const article = await KnowledgeBaseService.updateArticle(id, body, workspaceId);

    return NextResponse.json({
      success: true,
      article,
    });
  } catch (error: any) {
    console.error('Error updating knowledge article:', error);
    const status = error.name === 'ZodError' ? 400 : 422;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update article' },
      { status }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';

    const article = await KnowledgeBaseService.archiveArticle(id, workspaceId);

    return NextResponse.json({
      success: true,
      article,
      message: 'Article successfully archived',
    });
  } catch (error: any) {
    console.error('Error archiving knowledge article:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to archive article' },
      { status: 500 }
    );
  }
}
