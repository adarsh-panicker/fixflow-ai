// src/app/api/knowledge-base/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '@/lib/services/knowledgeBaseService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || 'ws-default';

    const stats = await KnowledgeBaseService.getKnowledgeStats(workspaceId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching knowledge base stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch knowledge base statistics' },
      { status: 500 }
    );
  }
}
