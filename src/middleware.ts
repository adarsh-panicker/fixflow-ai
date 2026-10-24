// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'fixflow_session';
const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'fixflow-ai-development-jwt-secret-key-32-chars-long-minimum-2026'
);

const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invitation',
  '/register',
  '/unauthorized',
  '/api/auth',
  '/api/monitoring/agent', // Monitoring agents authenticate via cryptographic agentKey
  '/api/reset-demo',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // file extensions like .png, .ico, .css, .js
  ) {
    return NextResponse.next();
  }

  // 2. Extract session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    // If API request, return 401 Unauthorized
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid session required' },
        { status: 401 }
      );
    }

    // Redirect browser to login with return url
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Verify cryptographic token signature
  try {
    const { payload } = await jwtVerify(sessionCookie, SECRET_KEY, {
      issuer: 'fixflow-ai',
    });

    // Pass active workspace ID in request header down to route handlers
    const requestHeaders = new Headers(request.headers);
    if (payload.activeWorkspaceId) {
      requestHeaders.set('x-workspace-id', payload.activeWorkspaceId as string);
    }
    if (payload.userId) {
      requestHeaders.set('x-user-id', payload.userId as string);
    }
    if (payload.role) {
      requestHeaders.set('x-user-role', payload.role as string);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    // Token expired or invalid
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { success: false, error: 'Session expired. Please log in again.' },
        { status: 401 }
      );
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo.png, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
