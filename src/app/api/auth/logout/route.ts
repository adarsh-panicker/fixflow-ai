// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/auth/workspaceContext';

export async function POST(req: Request) {
  try {
    const session = await getSession(req);

    if (session) {
      await recordAuditEvent(session.activeWorkspaceId, session.email, 'AUTH_LOGOUT', {
        actorId: session.userId,
        targetType: 'USER',
        targetId: session.userId,
      });
    }

    await clearSessionCookie();

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    console.error('Logout error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Logout failed' },
      { status: 500 }
    );
  }
}
