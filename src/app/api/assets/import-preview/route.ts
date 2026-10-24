// src/app/api/assets/import-preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CsvImportService } from '@/lib/services/csvImportService';
import { getAuthorizedWorkspaceContext } from '@/lib/auth/workspaceContext';

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedWorkspaceContext(request, 'assets:import');
    const { csvText, columnMapping } = await request.json();

    if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
      return NextResponse.json({ success: false, error: 'CSV text content is required' }, { status: 400 });
    }

    // Load existing assets in authorized workspace for duplicate detection
    const existingAssets = await prisma.asset.findMany({
      where: { workspaceId: context.workspaceId },
      select: { id: true, assetTag: true, hostname: true, ipAddress: true },
    });

    const preview = CsvImportService.previewImport(csvText, existingAssets, columnMapping);

    return NextResponse.json({ success: true, preview });
  } catch (error: any) {
    console.error('CSV preview error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process CSV preview' },
      { status: error.statusCode || 500 }
    );
  }
}
