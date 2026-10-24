// src/app/api/knowledge-base/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '@/lib/services/knowledgeBaseService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const assetType = searchParams.get('assetType') || undefined;
    const confidenceBasis = searchParams.get('confidenceBasis') || undefined;

    const articles = await KnowledgeBaseService.getArticles(workspaceId, {
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
    });
  } catch (error: any) {
    console.error('Error fetching knowledge articles:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch knowledge articles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || body.workspaceId || 'ws-default';

    const article = await KnowledgeBaseService.createArticle(body, workspaceId);

    return NextResponse.json({
      success: true,
      article,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating knowledge article:', error);
    const status = error.name === 'ZodError' ? 400 : 422;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create knowledge article' },
      { status }
    );
  }
}
