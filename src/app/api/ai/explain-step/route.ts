// src/app/api/ai/explain-step/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GeminiProviderAdapter } from '@/lib/ai/geminiAdapter';
import { AssetService } from '@/lib/services/assetService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { step, incident, targetAssetId, workspaceId = 'ws-default' } = body;

    if (!step || !incident) {
      return NextResponse.json(
        { success: false, error: 'Step and incident are required.' },
        { status: 400 }
      );
    }

    const targetAsset = targetAssetId
      ? ((await AssetService.getAssetById(targetAssetId, workspaceId)) as any)
      : null;

    const adapter = new GeminiProviderAdapter();

    if (adapter.isAvailable()) {
      try {
        const explanation = await adapter.explainDiagnosticStep({
          step,
          incident,
          targetAsset,
        });

        return NextResponse.json({
          success: true,
          mode: 'AI_REASONING',
          isAiGenerated: true,
          explanation,
        });
      } catch (aiErr: any) {
        console.warn('Gemini explanation failed, falling back to deterministic explanation:', aiErr.message);
      }
    }

    // Deterministic Fallback Explanation
    return NextResponse.json({
      success: true,
      mode: 'DETERMINISTIC_FALLBACK',
      isAiGenerated: false,
      explanation: {
        stepTitle: step.title,
        plainEnglishPurpose: `This diagnostic probe executes tool '${step.toolName}' to test ${step.purpose}.`,
        whyThisTestMatters: 'Verifying this component isolates whether the fault is at the network transport layer or application software layer.',
        whatToLookForInOutput: `Examine the terminal response to confirm whether it matches: "${step.expectedResult || step.expectedOutput || 'Success'}"`,
        safetyAssurance: 'This test is strictly read-only and will make zero configuration changes to the system.',
      },
    });
  } catch (err: any) {
    console.error('Error in /api/ai/explain-step:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
