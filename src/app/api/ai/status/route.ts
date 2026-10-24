// src/app/api/ai/status/route.ts
import { NextResponse } from 'next/server';
import { getAiPublicStatus } from '@/lib/ai/config';

export async function GET() {
  const status = getAiPublicStatus();
  return NextResponse.json({
    success: true,
    ...status,
  });
}
