// src/app/api/agent/plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AgentEngine } from '@/lib/engine/agentEngine';
import { AssetService } from '@/lib/services/assetService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { incident, targetAssetId, workspaceId = 'ws-default' } = body;

    if (!incident) {
      return NextResponse.json(
        { success: false, error: 'Incident is required.' },
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

    const planResult = AgentEngine.generateInitialPlan(incident, targetAsset, dependencies);

    return NextResponse.json({
      success: true,
      session: planResult.session,
      proposedPlan: planResult.proposedPlan,
      reasoning: planResult.reasoning,
    });
  } catch (err: any) {
    console.error('Error in /api/agent/plan:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
