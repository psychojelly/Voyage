import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptJsonField } from '@/lib/crypto';
import type { DayRecord } from '@/lib/types';

// GET /api/public/health?key=<shareKey>&start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Missing share key' }, { status: 400 });
  }

  // Look up settings by share key
  const settings = await prisma.userSettings.findUnique({
    where: { shareKey: key },
    select: { userId: true, shareScopes: true },
  });

  if (!settings) {
    return NextResponse.json({ error: 'Invalid or revoked share key' }, { status: 404 });
  }

  const { userId, shareScopes } = settings;

  // Build date range filter
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  const where: { userId: string; date?: { gte?: string; lte?: string } } = { userId };
  if (start || end) {
    where.date = {};
    if (start) where.date.gte = start;
    if (end) where.date.lte = end;
  }

  const records = await prisma.healthRecord.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  // Filter to only include allowed scopes, decrypt on read
  const days: Partial<DayRecord>[] = records.map(r => {
    const day: Partial<DayRecord> = { date: r.date };
    if (shareScopes.includes('sleep') && r.sleep) {
      day.sleep = decryptJsonField<DayRecord['sleep']>(r.sleep);
    }
    if (shareScopes.includes('heart') && r.heart) {
      day.heart = decryptJsonField<DayRecord['heart']>(r.heart);
    }
    if (shareScopes.includes('workout') && r.workout) {
      day.workout = decryptJsonField<DayRecord['workout']>(r.workout);
    }
    if (shareScopes.includes('stress') && r.stress) {
      day.stress = decryptJsonField<DayRecord['stress']>(r.stress);
    }
    return day;
  });

  return NextResponse.json(days);
}
