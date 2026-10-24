// src/app/api/auth/reset-password/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resetPasswordWithToken } from '@/lib/auth/passwordService';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    await resetPasswordWithToken(parsed.data.token, parsed.data.password);

    return NextResponse.json({
      success: true,
      message: 'Password has been successfully updated. You may now log in with your new credentials.',
    });
  } catch (err: any) {
    console.error('Password reset execution error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to reset password' },
      { status: 400 }
    );
  }
}
