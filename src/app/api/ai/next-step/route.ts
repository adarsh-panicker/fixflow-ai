// src/app/api/ai/next-step/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GeminiProviderAdapter } from '@/lib/ai/geminiAdapter';
import { DiagnosticEngine } from '@/lib/engine/diagnosticEngine';
import { AssetService } from '@/lib/services/assetService';
import { MonitoringService } from '@/lib/services/monitoringService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      incident,
      session,
      currentStepId,
      outcome,
      observedOutput = '',
      technicianNotes = '',
      targetAssetId,
      workspaceId = 'ws-default',
    } = body;

    if (!incident || !session || !currentStepId || !outcome) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: incident, session, currentStepId, outcome.' },
        { status: 400 }
      );
    }

    const targetAsset = targetAssetId
      ? ((await AssetService.getAssetById(targetAssetId, workspaceId)) as any)
      : null;

    const monitoringEvidence = targetAsset
      ? await MonitoringService.getMonitoringEvidenceContext(targetAsset.id, workspaceId)
      : null;

    // Fetch confirmed dependencies for target asset (context minimization)
    let dependencies: any[] = [];
    if (targetAsset) {
      const rels = await AssetService.getRelationships(workspaceId, targetAsset.id);
      dependencies = rels
        .filter(r => r.provenance === 'USER_CONFIRMED')
        .map(r => (r.sourceAssetId === targetAsset.id ? r.targetAsset : r.sourceAsset))
        .filter(Boolean);
    }

    const currentStep = session.steps.find((s: any) => s.id === currentStepId || s.stepId === currentStepId);
    if (!currentStep) {
      return NextResponse.json(
        { success: false, error: `Step '${currentStepId}' not found in session.` },
        { status: 404 }
      );
    }

    const adapter = new GeminiProviderAdapter();

    if (adapter.isAvailable()) {
      try {
        const proposal = await adapter.proposeNextStep({
          incident,
          session,
          lastExecutedStep: currentStep,
          outcome,
          observedOutput,
          technicianNotes,
          targetAsset,
          dependencies,
        });

        return NextResponse.json({
          success: true,
          mode: 'AI_REASONING',
          isAiGenerated: true,
          proposal,
          monitoringEvidence,
        });
      } catch (aiErr: any) {
        console.warn('Gemini next-step planning failed, falling back to deterministic engine:', aiErr.message);
      }
    }

    // Deterministic Fallback Engine
    const evalResult = DiagnosticEngine.recordStepResult(
      session,
      incident,
      currentStep.id,
      outcome,
      observedOutput,
      technicianNotes,
      targetAsset,
      dependencies,
      incident.isDemo || false
    );

    return NextResponse.json({
      success: true,
      mode: 'DETERMINISTIC_FALLBACK',
      isAiGenerated: false,
      monitoringEvidence,
      proposal: {
        observationInterpretation: evalResult.recordedEvidence.summary,
        interpretedOutcome: outcome,
        hypothesisUpdates: session.hypotheses.map((h: any) => ({
          hypothesisId: h.id,
          delta: outcome === 'PASSED' ? 0.20 : -0.20,
          rationale: `Updated based on ${outcome} observation on test '${currentStep.title}'.`,
        })),
        contradictionDetected: evalResult.hasContradiction,
        contradictionRationale: evalResult.contradictionMessage || null,
        isDiagnosisReached: evalResult.isFinished,
        proposedNextStep: evalResult.nextStep
          ? {
              title: evalResult.nextStep.title,
              toolName: evalResult.nextStep.toolName,
              command: evalResult.nextStep.command,
              purpose: evalResult.nextStep.purpose,
              expectedResult: evalResult.nextStep.expectedResult,
              safetyClassification: evalResult.nextStep.safetyClassification,
            }
          : null,
        terminalConclusion: evalResult.report
          ? {
              rootCause: evalResult.report.confirmedRootCause,
              recommendedFixes: evalResult.report.verifiedFixes.map(f => ({
                action: f.action,
                owner: f.owner,
                priority: f.priority,
                remediationType: f.remediationType,
              })),
            }
          : null,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/ai/next-step:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
