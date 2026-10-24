// src/app/api/ai/intake/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GeminiProviderAdapter } from '@/lib/ai/geminiAdapter';
import { AssetService } from '@/lib/services/assetService';
import { DiagnosticEngine } from '@/lib/engine/diagnosticEngine';
import { MonitoringService } from '@/lib/services/monitoringService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, rawDescription, targetAssetId, workspaceId = 'ws-default' } = body;

    if (!title || !rawDescription) {
      return NextResponse.json(
        { success: false, error: 'Title and rawDescription are required.' },
        { status: 400 }
      );
    }

    // Context Minimization: Search relevant candidate assets only (up to 12)
    const searchTerms = `${title} ${rawDescription}`.slice(0, 100);
    const candidateAssets = await AssetService.getAssets(workspaceId, {
      search: searchTerms,
    });

    const targetAsset = targetAssetId
      ? ((await AssetService.getAssetById(targetAssetId, workspaceId)) as any)
      : null;

    const monitoringEvidence = targetAssetId
      ? await MonitoringService.getMonitoringEvidenceContext(targetAssetId, workspaceId)
      : null;

    const adapter = new GeminiProviderAdapter();

    if (adapter.isAvailable()) {
      try {
        const analysis = await adapter.analyzeIncidentIntake({
          title,
          rawDescription,
          targetAsset,
          candidateAssets: candidateAssets.slice(0, 12) as any,
        });

        return NextResponse.json({
          success: true,
          mode: 'AI_REASONING',
          isAiGenerated: true,
          analysis,
          monitoringEvidence,
        });
      } catch (aiError: any) {
        console.warn('Gemini intake failed, falling back to deterministic engine:', aiError.message);
      }
    }

    // Deterministic Fallback Engine
    const matchedScenario = DiagnosticEngine.matchScenario(
      { title, rawDescription, targetAsset },
      candidateAssets as any
    );
    const missingInfo = DiagnosticEngine.detectMissingInformation(
      { title, rawDescription, targetAssetId },
      targetAsset
    );

    return NextResponse.json({
      success: true,
      mode: 'DETERMINISTIC_FALLBACK',
      isAiGenerated: false,
      monitoringEvidence,
      analysis: {
        problemSummary: title,
        category: matchedScenario?.category || 'INFRASTRUCTURE',
        severity: 'P2_HIGH',
        needsClarification: missingInfo.isMissing,
        clarifyingQuestion: missingInfo.reason || null,
        suggestedAssetTags: targetAsset ? [targetAsset.assetTag] : candidateAssets.slice(0, 2).map(a => a.assetTag),
        suspectedFailureDomain: matchedScenario?.title || 'General IT Infrastructure',
        initialHypotheses: matchedScenario?.initialHypotheses.map(h => ({
          title: h.title,
          description: h.description,
          initialConfidence: h.initialConfidence,
        })) || [
          {
            title: 'Infrastructure Unavailability',
            description: 'Target component is unresponsive or network link dropped.',
            initialConfidence: 0.5,
          },
        ],
      },
    });
  } catch (err: any) {
    console.error('Error in /api/ai/intake:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
