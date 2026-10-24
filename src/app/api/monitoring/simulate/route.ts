// src/app/api/monitoring/simulate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SimulatedMonitoringProvider } from '@/lib/services/simulatedMonitoringProvider';
import { SimulationTriggerSchema } from '@/lib/validation/monitoringSchemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = SimulationTriggerSchema.parse(body);

    const result = await SimulatedMonitoringProvider.runSimulationCycle({
      workspaceId: data.workspaceId,
      assetIds: data.assetIds,
      mode: data.mode,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Error running monitoring simulation:', error);
    const status = error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Simulation execution failed' },
      { status }
    );
  }
}
