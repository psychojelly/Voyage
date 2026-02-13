import { prisma } from '@/lib/prisma';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Returns a valid Google Calendar access token for the given user
 * by reading from the Auth.js Account table (provider: 'google').
 * Refreshes the token if expired.
 */
export async function getValidGcalToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!account?.access_token) return null;

  // Token still valid — expires_at is in seconds (epoch)
  if (account.expires_at && account.expires_at > Math.floor(Date.now() / 1000)) {
    return account.access_token;
  }

  // Token expired — try to refresh
  if (!account.refresh_token) return null;

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      console.error('Google token refresh failed:', await res.text());
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.access_token as string;
    const expiresIn = (data.expires_in as number) || 3600;

    // Update the Account record with new token
    await prisma.account.updateMany({
      where: { userId, provider: 'google' },
      data: {
        access_token: newAccessToken,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      },
    });

    return newAccessToken;
  } catch (err) {
    console.error('Google token refresh error:', err);
    return null;
  }
}
