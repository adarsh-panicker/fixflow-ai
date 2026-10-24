// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  workspaceName: z.string().min(2, 'Workspace name is required').optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    const { email, name, password, workspaceName } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existing = await prisma.userProfile.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email address already exists. Please log in or reset your password.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const targetWorkspaceName = workspaceName?.trim() || `${name.trim()}'s Team Workspace`;

    // Execute within transaction: create user, new workspace, and OWNER membership
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.userProfile.create({
        data: {
          email: normalizedEmail,
          name: name.trim(),
          passwordHash,
          emailVerified: new Date(),
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: targetWorkspaceName,
          description: `Isolated organization workspace created by ${user.name}`,
        },
      });

      const membership = await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      await tx.workspaceAuditEvent.create({
        data: {
          workspaceId: workspace.id,
          actorId: user.id,
          actorEmail: user.email,
          eventType: 'WORKSPACE_CREATED',
          targetType: 'WORKSPACE',
          targetId: workspace.id,
          metadata: JSON.stringify({ name: targetWorkspaceName }),
        },
      });

      return { user, workspace, membership };
    });

    // Generate session token
    const token = await createSessionToken({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      activeWorkspaceId: result.workspace.id,
      role: 'OWNER',
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      message: 'Account and workspace created successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        activeWorkspaceId: result.workspace.id,
        activeWorkspaceName: result.workspace.name,
        activeRole: 'OWNER',
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
