// src/app/api/reset-demo/route.ts
import { NextResponse } from 'next/server';
import { seedDatabase } from '@/../prisma/seed';

export async function POST() {
  try {
    await seedDatabase();
    return NextResponse.json({
      success: true,
      message: 'Demo assets, topologies, and baseline incidents reset successfully in SQLite database.',
    });
  } catch (error: any) {
    console.error('Reset demo error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset demo data' },
      { status: 500 }
    );
  }
}
