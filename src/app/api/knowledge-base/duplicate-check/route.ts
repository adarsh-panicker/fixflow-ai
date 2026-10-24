// src/app/api/knowledge-base/duplicate-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeSearchService } from '@/lib/services/knowledgeSearchService';
import { DuplicateDetectionQuerySchema } from '@/lib/validation/knowledgeBaseSchemas';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validated = DuplicateDetectionQuerySchema.parse(rawBody);

    const result = await KnowledgeSearchService.detectDuplicates({
      title: validated.title,
      originalErrorDescription: validated.originalErrorDescription,
      errorCode: validated.errorCode,
      symptoms: validated.symptoms,
      workspaceId: validated.workspaceId || 'ws-default',
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Error checking article duplicates:', error);
    const status = error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Duplicate check failed' },
      { status }
    );
  }
}
