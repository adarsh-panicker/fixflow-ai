// src/app/api/agent/escalate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GuidedAdapter } from '@/lib/engine/guidedAdapter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session, reason = 'Operator requested escalation', notes = '' } = body;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session is required.' },
        { status: 400 }
      );
    }

    const result = GuidedAdapter.escalateSession(session, reason, notes);

    return NextResponse.json({
      success: true,
      session: result.session,
      auditEvent: result.auditEvent,
    });
  } catch (err: any) {
    console.error('Error in /api/agent/escalate:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
