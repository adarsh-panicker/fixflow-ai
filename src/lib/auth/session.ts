// src/lib/auth/session.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { UserSession, WorkspaceRole } from '@/types/auth';

const SESSION_COOKIE_NAME = 'fixflow_session';
const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'fixflow-ai-development-jwt-secret-key-32-chars-long-minimum-2026'
);

export interface SessionPayload {
  userId: string;
  username?: string | null;
  email: string;
  name: string;
  activeWorkspaceId: string;
  role: WorkspaceRole;
  avatarUrl?: string | null;
}

/**
 * Creates a signed JWT session token.
 */
export async function createSessionToken(
  payload: SessionPayload,
  rememberMe: boolean = false
): Promise<string> {
  const expiry = rememberMe ? '30d' : '24h';

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setIssuer('fixflow-ai')
    .sign(SECRET_KEY);
}

/**
 * Verifies and decodes a JWT session token.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      issuer: 'fixflow-ai',
    });

    return {
      userId: payload.userId as string,
      username: (payload.username as string) || null,
      email: payload.email as string,
      name: payload.name as string,
      activeWorkspaceId: payload.activeWorkspaceId as string,
      role: payload.role as WorkspaceRole,
      avatarUrl: (payload.avatarUrl as string) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Sets the secure HTTP-only session cookie in the Next.js response context.
 */
export async function setSessionCookie(
  token: string,
  rememberMe: boolean = false
): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 24 hours

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

/**
 * Clears the session cookie on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Retrieves and validates the current active session from cookies.
 * Supports extracting from request headers when called in middleware or custom route handlers.
 */
export async function getSession(req?: Request): Promise<UserSession | null> {
  let token: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) {
      token = match.substring(SESSION_COOKIE_NAME.length + 1);
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // In non-Next request context (e.g., pure unit tests without mock headers)
      return null;
    }
  }

  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  return {
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    activeWorkspaceId: payload.activeWorkspaceId,
    activeRole: payload.role,
    avatarUrl: payload.avatarUrl,
  };
}

/**
 * Enforces that a valid session exists, throwing an unauthorized error if not.
 */
export async function requireSession(req?: Request): Promise<UserSession> {
  const session = await getSession(req);
  if (!session) {
    throw new Error('UNAUTHORIZED: Valid session required');
  }
  return session;
}
