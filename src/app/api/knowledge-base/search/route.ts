// src/app/api/knowledge-base/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeSearchService } from '@/lib/services/knowledgeSearchService';
import { KnowledgeSearchQuerySchema } from '@/lib/validation/knowledgeBaseSchemas';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'knowledge:read');
    const rawBody = await request.json();
    const validated = KnowledgeSearchQuerySchema.parse(rawBody);

    const queryText = validated.query || validated.errorInput || '';

    // Enforce workspaceId from authenticated server context - ignore client-supplied workspaceId
    const result = await KnowledgeSearchService.searchLocalKnowledge({
      query: queryText,
      assetType: validated.assetType,
      operatingSystem: validated.operatingSystem,
      errorCode: validated.errorCode,
      category: validated.category,
      workspaceId: context.workspaceId,
      minThreshold: validated.minThreshold,
      verifiedOnly: validated.verifiedOnly,
    });

    return NextResponse.json({
      success: true,
      result,
      workspaceId: context.workspaceId,
    });
  } catch (error: any) {
    console.error('Error during local knowledge base search:', error);
    const status = error.statusCode || (error.name === 'ZodError' ? 400 : 500);
    return NextResponse.json(
      { success: false, error: error.message || 'Search execution failed' },
      { status }
    );
  }
}
