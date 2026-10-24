// src/app/api/assets/import-commit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/lib/services/assetService';

export async function POST(request: NextRequest) {
  try {
    const { rows, workspaceId = 'ws-default', onDuplicate = 'skip' } = await request.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Rows array is required' }, { status: 400 });
    }

    const result = await AssetService.commitCsvImport(workspaceId, rows, { onDuplicate });

    return NextResponse.json({
      success: true,
      ...result,
      message: `Import complete: ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount} skipped.`,
    });
  } catch (error: any) {
    console.error('CSV commit error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to commit import' },
      { status: 500 }
    );
  }
}
