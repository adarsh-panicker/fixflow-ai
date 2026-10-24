// src/app/api/auth/forgot-password/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/lib/auth/passwordService';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
    }

    const { resetUrl } = await requestPasswordReset(parsed.data.email);

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email address, password reset instructions have been dispatched.',
      // In development / demo environment, return resetUrl to facilitate instant testing
      debugResetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
    });
  } catch (err: any) {
    console.error('Password reset request error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
