// src/app/api/agent/step-result/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AgentEngine } from '@/lib/engine/agentEngine';
import { AssetService } from '@/lib/services/assetService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      session,
      incident,
      stepId,
      outcome,
      observedOutput = '',
      technicianNotes = '',
      targetAssetId,
      workspaceId = 'ws-default',
    } = body;

    if (!session || !incident || !stepId || !outcome) {
      return NextResponse.json(
        { success: false, error: 'Session, incident, stepId, and outcome are required.' },
        { status: 400 }
      );
    }

    const targetAsset = targetAssetId
      ? ((await AssetService.getAssetById(targetAssetId, workspaceId)) as any)
      : null;

    let dependencies: any[] = [];
    if (targetAsset) {
      const rels = await AssetService.getRelationships(workspaceId, targetAsset.id);
      dependencies = rels
        .filter(r => r.provenance === 'USER_CONFIRMED')
        .map(r => (r.sourceAssetId === targetAsset.id ? r.targetAsset : r.sourceAsset))
        .filter(Boolean);
    }

    const result = AgentEngine.executeStepAndRevisePlan(
      session,
      incident,
      stepId,
      outcome,
      observedOutput,
      technicianNotes,
      targetAsset,
      dependencies,
      incident.isDemo || false
    );

    return NextResponse.json({
      success: true,
      session: result.session,
      executedStep: result.executedStep,
      currentStep: result.currentStep,
      planRevision: result.planRevision || null,
      isFinished: result.isFinished,
      stopReason: result.stopReason || null,
      report: result.report || null,
    });
  } catch (err: any) {
    console.error('Error in /api/agent/step-result:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
