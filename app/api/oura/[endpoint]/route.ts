import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { tryDecrypt } from '@/lib/crypto';

const BASE_URL = 'https://api.ouraring.com';

const ENDPOINT_MAP: Record<string, string> = {
  daily_sleep: '/v2/usercollection/daily_sleep',
  sleep_periods: '/v2/usercollection/sleep',
  heartrate: '/v2/usercollection/heartrate',
  daily_activity: '/v2/usercollection/daily_activity',
  daily_stress: '/v2/usercollection/daily_stress',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ endpoint: string }> },
) {
  const { endpoint } = await params;
  const path = ENDPOINT_MAP[endpoint];
  if (!path) {
    return NextResponse.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 404 });
  }

  // Try DB token first (for authenticated users), then cookie fallback
  let token: string | null = null;

  const session = await auth();
  if (session?.user?.id) {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { ouraAccessToken: true, ouraTokenExpiry: true },
    });
    if (settings?.ouraAccessToken) {
      if (!settings.ouraTokenExpiry || settings.ouraTokenExpiry > new Date()) {
        // Try to decrypt (encrypted tokens) or use as-is (pre-migration plaintext)
        token = tryDecrypt(settings.ouraAccessToken) ?? settings.ouraAccessToken;
      }
    }
  }

  // Fallback to cookie
  if (!token) {
    const cookies = request.headers.get('cookie') || '';
    token = parseCookie(cookies, 'oura_token');
  }

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  try {
    // Oura heartrate endpoint uses start_datetime/end_datetime and has
    // a max 30-day range per request. Split into chunks automatically.
    if (endpoint === 'heartrate' && startDate && endDate) {
      const allData: unknown[] = [];
      for (const [chunkStart, chunkEnd] of chunkDateRange(startDate, endDate, 30)) {
        const chunkParams = new URLSearchParams();
        chunkParams.set('start_datetime', `${chunkStart}T00:00:00+00:00`);
        chunkParams.set('end_datetime', `${chunkEnd}T23:59:59+00:00`);
        const result = await fetchAllPages(path, chunkParams, token);
        if ('error' in result) {
          return NextResponse.json({ error: result.error }, { status: result.status });
        }
        allData.push(...result.data);
      }
      return NextResponse.json({ data: allData });
    }

    // All other endpoints: standard start_date/end_date params
    const apiParams = new URLSearchParams();
    if (startDate) apiParams.set('start_date', startDate);
    if (endDate) apiParams.set('end_date', endDate);

    const result = await fetchAllPages(path, apiParams, token);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error('Oura proxy error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch data from Oura' },
      { status: 502 },
    );
  }
}

/** Fetch all pages from an Oura API endpoint (handles next_token pagination). */
async function fetchAllPages(
  path: string,
  baseParams: URLSearchParams,
  token: string,
): Promise<{ data: unknown[] } | { error: string; status: number }> {
  const allData: unknown[] = [];
  let nextToken: string | null = null;

  do {
    const pageParams = new URLSearchParams(baseParams);
    if (nextToken) pageParams.set('next_token', nextToken);

    const apiUrl = `${BASE_URL}${path}?${pageParams}`;
    const apiRes = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (apiRes.status === 401) {
      return { error: `Oura returned 401`, status: 401 };
    }
    if (!apiRes.ok) {
      const text = await apiRes.text();
      console.error(`Oura API error ${apiRes.status}:`, text);
      return { error: 'Oura API request failed', status: apiRes.status };
    }

    const page = await apiRes.json();
    if (page.data && Array.isArray(page.data)) {
      allData.push(...page.data);
    }
    nextToken = page.next_token || null;
  } while (nextToken);

  return { data: allData };
}

/** Split a date range into chunks of maxDays each. Returns [start, end] pairs (YYYY-MM-DD). */
function chunkDateRange(start: string, end: string, maxDays: number): [string, string][] {
  const chunks: [string, string][] = [];
  const endDate = new Date(end + 'T00:00:00');
  let cursor = new Date(start + 'T00:00:00');

  while (cursor <= endDate) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays - 1);
    if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime());

    chunks.push([fmt(cursor), fmt(chunkEnd)]);
    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return chunks;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
