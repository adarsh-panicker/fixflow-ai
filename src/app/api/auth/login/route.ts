// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/auth/workspaceContext';
import { WorkspaceRole } from '@/types/auth';

const loginSchema = z.object({
  usernameOrEmail: z.string().optional(),
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid username/email or password format' },
        { status: 400 }
      );
    }

    const identifier = (parsed.data.usernameOrEmail || parsed.data.username || parsed.data.email || '').trim();
    const { password, rememberMe } = parsed.data;

    if (!identifier) {
      return NextResponse.json(
        { success: false, error: 'Username or email is required' },
        { status: 400 }
      );
    }

    // 1. Find user by username or email in local SQLite database
    const user = await prisma.userProfile.findFirst({
      where: {
        OR: [
          { username: identifier },
          { username: identifier.toLowerCase() },
          { email: identifier.toLowerCase() },
        ],
      },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'This user account has been disabled by an administrator' },
        { status: 403 }
      );
    }

    // 2. Verify password with constant-time comparison
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 3. Resolve active workspace
    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      return NextResponse.json(
        {
          success: false,
          error: 'Your account does not belong to any active workspace. Please contact your administrator or accept an invitation.',
        },
        { status: 403 }
      );
    }

    // 4. Create and set signed session token
    const token = await createSessionToken(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        activeWorkspaceId: primaryMembership.workspaceId,
        role: primaryMembership.role as WorkspaceRole,
        avatarUrl: user.avatarUrl,
      },
      rememberMe
    );

    await setSessionCookie(token, rememberMe);

    // 5. Record audit event
    await recordAuditEvent(primaryMembership.workspaceId, user.email, 'AUTH_LOGIN', {
      actorId: user.id,
      targetType: 'USER',
      targetId: user.id,
      metadata: { rememberMe: !!rememberMe, username: user.username },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        activeWorkspaceId: primaryMembership.workspaceId,
        activeWorkspaceName: primaryMembership.workspace.name,
        activeRole: primaryMembership.role,
        availableWorkspaces: user.memberships.map((m) => ({
          id: m.workspaceId,
          name: m.workspace.name,
          role: m.role,
        })),
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'An error occurred during authentication' },
      { status: 500 }
    );
  }
}
