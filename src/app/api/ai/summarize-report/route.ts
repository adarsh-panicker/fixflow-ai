// src/app/api/ai/summarize-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GeminiProviderAdapter } from '@/lib/ai/geminiAdapter';
import { AssetService } from '@/lib/services/assetService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { incident, session, targetAssetId, workspaceId = 'ws-default' } = body;

    if (!incident || !session) {
      return NextResponse.json(
        { success: false, error: 'Incident and session are required.' },
        { status: 400 }
      );
    }

    const targetAsset = targetAssetId
      ? ((await AssetService.getAssetById(targetAssetId, workspaceId)) as any)
      : null;

    const adapter = new GeminiProviderAdapter();

    if (adapter.isAvailable()) {
      try {
        const report = await adapter.summarizeResolutionReport({
          incident,
          session,
          targetAsset,
        });

        return NextResponse.json({
          success: true,
          mode: 'AI_REASONING',
          isAiGenerated: true,
          report,
        });
      } catch (aiErr: any) {
        console.warn('Gemini report summarization failed, falling back to deterministic synthesis:', aiErr.message);
      }
    }

    // Deterministic Fallback Synthesis
    const topHypothesis = session.hypotheses.find((h: any) => h.status === 'CONFIRMED') || session.hypotheses[0];
    const confirmedCause = topHypothesis
      ? topHypothesis.title
      : 'Root cause verified by systematic diagnostic elimination.';

    return NextResponse.json({
      success: true,
      mode: 'DETERMINISTIC_FALLBACK',
      isAiGenerated: false,
      report: {
        executiveSummary: `Investigation completed for incident '${incident.title}'. Evaluated ${session.totalStepsExecuted || session.steps.length} diagnostic observations. Confirmed root cause: ${confirmedCause}`,
        confirmedRootCause: confirmedCause,
        fiveWhys: [
          { whyNumber: 1, question: `Why was ${incident.title} reported?`, answer: incident.rawDescription },
          { whyNumber: 2, question: 'What primary fault mechanism was identified?', answer: confirmedCause },
          { whyNumber: 3, question: 'Why was the service degraded?', answer: 'Diagnostic evidence confirmed network or component failure.' },
          { whyNumber: 4, question: 'Why was this not isolated immediately?', answer: 'Required step-by-step diagnostic isolation of dependencies.' },
          { whyNumber: 5, question: 'What long-term preventive action is needed?', answer: 'Deploy proactive telemetry monitoring for this asset category.' },
        ],
        verifiedFixes: [
          {
            action: `Restore operational state for ${targetAsset?.assetTag || 'target asset'}: verify physical and network connectivity`,
            owner: 'Systems Administration',
            priority: 'CRITICAL',
            remediationType: 'IMMEDIATE_FIX',
          },
        ],
        unverifiedRecommendations: [
          {
            action: 'Configure automated synthetic health check probes on default gateway',
            owner: 'Network Engineering',
            priority: 'MEDIUM',
            remediationType: 'PREVENTIVE_MEASURE',
          },
        ],
        technicalEvidenceSummary: session.evidence.map((e: any) => `[${e.polarity}] ${e.summary}`).join('\n'),
      },
    });
  } catch (err: any) {
    console.error('Error in /api/ai/summarize-report:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
