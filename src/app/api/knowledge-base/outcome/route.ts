// src/app/api/knowledge-base/outcome/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '@/lib/services/knowledgeBaseService';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const result = await KnowledgeBaseService.recordOutcome(rawBody);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error recording knowledge article outcome:', error);
    const status = error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record outcome' },
      { status }
    );
  }
}
