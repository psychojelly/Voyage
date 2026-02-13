import { NextResponse } from 'next/server';

const OAUTH_AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
const SCOPES = 'daily sleep heartrate workout session personal';

export async function GET(request: Request) {
  const clientId = process.env.OURA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Oura integration is not available' }, { status: 503 });
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/oura/callback`;

  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });

  // Store state in a cookie for verification on callback
  const response = NextResponse.redirect(`${OAUTH_AUTHORIZE_URL}?${params}`);
  response.cookies.set('oura_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return response;
}
