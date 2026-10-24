// src/app/api/knowledge-base/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '@/lib/services/knowledgeBaseService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'knowledge:read');
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const assetType = searchParams.get('assetType') || undefined;
    const confidenceBasis = searchParams.get('confidenceBasis') || undefined;

    const articles = await KnowledgeBaseService.getArticles(context.workspaceId, {
      search,
      category,
      status,
      assetType,
      confidenceBasis,
    });

    return NextResponse.json({
      success: true,
      count: articles.length,
      articles,
      workspaceId: context.workspaceId,
    });
  } catch (error: any) {
    console.error('Error fetching knowledge articles:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch knowledge articles' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'knowledge:write');
    const body = await request.json();

    const article = await KnowledgeBaseService.createArticle(body, context.workspaceId);

    return NextResponse.json({
      success: true,
      article,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating knowledge article:', error);
    const status = error.statusCode || (error.name === 'ZodError' ? 400 : 422);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create knowledge article' },
      { status }
    );
  }
}
