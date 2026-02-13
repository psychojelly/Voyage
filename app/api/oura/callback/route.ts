import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';

const TOKEN_URL = 'https://api.ouraring.com/oauth/token';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${url.origin}?oura_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${url.origin}?oura_error=no_code`);
  }

  // Verify state
  const cookies = request.headers.get('cookie') || '';
  const stateCookie = parseCookie(cookies, 'oura_oauth_state');
  if (stateCookie && state !== stateCookie) {
    return NextResponse.redirect(`${url.origin}?oura_error=state_mismatch`);
  }

  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${url.origin}?oura_error=server_config`);
  }

  const redirectUri = `${url.origin}/api/oura/callback`;

  // Exchange code for token
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error('Token exchange failed:', text);
      return NextResponse.redirect(`${url.origin}?oura_error=token_exchange`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token ?? null;
    const expiresIn = tokenData.expires_in || 86400;

    // Store tokens encrypted in DB for authenticated users
    const session = await auth();
    if (session?.user?.id) {
      const encryptedAccess = encrypt(accessToken);
      const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;

      await prisma.userSettings.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          ouraAccessToken: encryptedAccess,
          ouraRefreshToken: encryptedRefresh,
          ouraTokenExpiry: new Date(Date.now() + expiresIn * 1000),
        },
        update: {
          ouraAccessToken: encryptedAccess,
          ouraRefreshToken: encryptedRefresh,
          ouraTokenExpiry: new Date(Date.now() + expiresIn * 1000),
        },
      });
    }

    // Always set httpOnly cookie (works for both auth and anon users)
    const response = NextResponse.redirect(`${url.origin}?oura_connected=true`);
    response.cookies.set('oura_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    });
    response.cookies.delete('oura_oauth_state');

    return response;
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(`${url.origin}?oura_error=server_error`);
  }
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
