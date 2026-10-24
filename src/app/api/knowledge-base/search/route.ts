// src/app/api/knowledge-base/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeSearchService } from '@/lib/services/knowledgeSearchService';
import { KnowledgeSearchQuerySchema } from '@/lib/validation/knowledgeBaseSchemas';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validated = KnowledgeSearchQuerySchema.parse(rawBody);

    const queryText = validated.query || validated.errorInput || '';

    const result = await KnowledgeSearchService.searchLocalKnowledge({
      query: queryText,
      assetType: validated.assetType,
      operatingSystem: validated.operatingSystem,
      errorCode: validated.errorCode,
      category: validated.category,
      workspaceId: validated.workspaceId || 'ws-default',
      minThreshold: validated.minThreshold,
      verifiedOnly: validated.verifiedOnly,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Error during local knowledge base search:', error);
    const status = error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Search execution failed' },
      { status }
    );
  }
}
