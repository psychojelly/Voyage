import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

// Proxy runs on Node.js runtime (no Edge size limit), so we can use the full auth config
const authHandler = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', req.url));
  }
});

function addSecurityHeaders(response: NextResponse): NextResponse {
  // HTTPS enforcement
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Prevent MIME-type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent XSS (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Permissions policy — restrict sensitive APIs
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // Cross-origin isolation
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  // Content Security Policy
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://api.ouraring.com https://www.googleapis.com https://accounts.google.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

function getAppOrigin(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth redirects for login/signup pages
  if (pathname === '/login' || pathname === '/signup') {
    return authHandler(request, {} as never);
  }

  // CORS: handle preflight for API routes
  if (pathname.startsWith('/api/') && request.method === 'OPTIONS') {
    const appOrigin = getAppOrigin(request);
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': appOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // All other routes: add security headers + CORS
  const response = NextResponse.next();
  addSecurityHeaders(response);

  // CORS enforcement for API routes
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const appOrigin = getAppOrigin(request);
    if (origin && origin !== appOrigin) {
      response.headers.set('Access-Control-Allow-Origin', appOrigin);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|data/).*)',
  ],
};
