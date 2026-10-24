// src/lib/auth/passwordService.ts
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Creates a single-use password reset token for the given email.
 * If the user does not exist, silently succeeds to prevent account enumeration.
 */
export async function requestPasswordReset(email: string): Promise<{ rawToken?: string; resetUrl?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.isActive) {
    // Return gracefully without revealing non-existence
    return {};
  }

  // Generate 256-bit secure token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  // Set 1-hour expiry
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Invalidate any existing unused reset tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
    data: {
      usedAt: new Date(), // Mark used/invalidated
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `/reset-password?token=${rawToken}`;
  return { rawToken, resetUrl };
}

/**
 * Validates a password reset token and updates the user's password.
 */
export async function resetPasswordWithToken(rawToken: string, newPassword: string): Promise<boolean> {
  if (!rawToken || rawToken.trim().length === 0) {
    throw new Error('Reset token is required');
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const tokenHash = hashToken(rawToken.trim());

  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetRecord) {
    throw new Error('Invalid or unrecognized password reset token.');
  }

  if (resetRecord.usedAt) {
    throw new Error('This password reset token has already been used.');
  }

  if (new Date() > resetRecord.expiresAt) {
    throw new Error('This password reset link has expired. Please request a new one.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.userProfile.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return true;
}
