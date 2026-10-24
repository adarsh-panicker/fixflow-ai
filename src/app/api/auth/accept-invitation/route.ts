// src/app/api/auth/accept-invitation/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getInvitationByToken, acceptWorkspaceInvitation } from '@/lib/auth/invitationService';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { WorkspaceRole } from '@/types/auth';

const acceptSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters long').optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Invitation token is missing' }, { status: 400 });
    }

    const invite = await getInvitationByToken(token);

    return NextResponse.json({
      success: true,
      invitation: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        workspaceId: invite.workspaceId,
        workspaceName: invite.workspace.name,
        invitedByName: invite.invitedBy?.name || 'Workspace Administrator',
        expiresAt: invite.expiresAt.toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Invalid or expired invitation' },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    const result = await acceptWorkspaceInvitation({
      rawToken: parsed.data.token,
      name: parsed.data.name,
      password: parsed.data.password,
    });

    // Create session token and set cookie
    const token = await createSessionToken({
      userId: result.userId,
      email: result.email,
      name: result.name,
      activeWorkspaceId: result.workspaceId,
      role: result.role as WorkspaceRole,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully',
      user: result,
    });
  } catch (err: any) {
    console.error('Accept invitation error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to accept invitation' },
      { status: 400 }
    );
  }
}
