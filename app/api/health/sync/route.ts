import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseJsonBody, isErrorResponse } from '@/lib/api-utils';
import { encryptJson, decryptJsonField } from '@/lib/crypto';
import type { DayRecord } from '@/lib/types';
import type { Prisma } from '@prisma/client';

function toEncrypted(val: unknown): Prisma.InputJsonValue | undefined {
  return encryptJson(val) as Prisma.InputJsonValue | undefined;
}

// POST /api/health/sync — bulk import localStorage data to cloud
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await parseJsonBody<{ records: DayRecord[] }>(request);
  if (isErrorResponse(body)) return body;
  const { records } = body;
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'records array required' }, { status: 400 });
  }
  if (records.length > 1000) {
    return NextResponse.json({ error: 'Too many records (max 1000)' }, { status: 400 });
  }

  let synced = 0;
  for (const day of records) {
    if (!day.date) continue;

    // Merge with existing cloud data if any
    const existing = await prisma.healthRecord.findUnique({
      where: { userId_date: { userId: session.user.id, date: day.date } },
    });

    if (existing) {
      // Merge: existing cloud data takes priority, local fills gaps
      // Decrypt existing data for comparison, then encrypt result
      const exSleep = decryptJsonField(existing.sleep);
      const exHeart = decryptJsonField(existing.heart);
      const exWorkout = decryptJsonField(existing.workout);
      const exStress = decryptJsonField(existing.stress);

      await prisma.healthRecord.update({
        where: { userId_date: { userId: session.user.id, date: day.date } },
        data: {
          source: existing.source ?? day.source ?? null,
          sleep: toEncrypted(exSleep ?? day.sleep),
          heart: toEncrypted(exHeart ?? day.heart),
          workout: toEncrypted(exWorkout ?? day.workout),
          stress: toEncrypted(exStress ?? day.stress),
        },
      });
    } else {
      await prisma.healthRecord.create({
        data: {
          userId: session.user.id,
          date: day.date,
          source: day.source ?? null,
          sleep: toEncrypted(day.sleep),
          heart: toEncrypted(day.heart),
          workout: toEncrypted(day.workout),
          stress: toEncrypted(day.stress),
        },
      });
    }
    synced++;
  }

  return NextResponse.json({ synced });
}
