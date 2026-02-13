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

// GET /api/health/records?start=YYYY-MM-DD&end=YYYY-MM-DD
// GET /api/health/records?dates_only=true
// GET /api/health/records?userId=xxx&start=...&end=... (admin/artist viewing)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get('userId');

  // Determine target user
  let targetUserId = session.user.id;

  if (requestedUserId && requestedUserId !== session.user.id) {
    // Verify caller has permission and target user consented
    const adminEmail = process.env.ADMIN_EMAIL;
    const isAdmin = adminEmail && session.user.email === adminEmail;

    let isArtist = false;
    if (!isAdmin) {
      const callerUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      isArtist = callerUser?.role === 'artist';
    }

    if (!isAdmin && !isArtist) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify target user consented
    const targetSettings = await prisma.userSettings.findUnique({
      where: { userId: requestedUserId },
      select: { allowAdmin: true, allowArtist: true },
    });

    if (!targetSettings) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (isAdmin && !targetSettings.allowAdmin) {
      return NextResponse.json({ error: 'User has not consented to admin access' }, { status: 403 });
    }

    if (isArtist && !isAdmin && !targetSettings.allowArtist) {
      return NextResponse.json({ error: 'User has not consented to artist access' }, { status: 403 });
    }

    targetUserId = requestedUserId;
  }

  const datesOnly = url.searchParams.get('dates_only') === 'true';

  if (datesOnly) {
    const records = await prisma.healthRecord.findMany({
      where: { userId: targetUserId },
      select: { date: true },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json(records.map(r => r.date));
  }

  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  const where: { userId: string; date?: { gte?: string; lte?: string } } = {
    userId: targetUserId,
  };
  if (start || end) {
    where.date = {};
    if (start) where.date.gte = start;
    if (end) where.date.lte = end;
  }

  const records = await prisma.healthRecord.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  const days: DayRecord[] = records.map(r => ({
    date: r.date,
    source: r.source ?? undefined,
    sleep: decryptJsonField<DayRecord['sleep']>(r.sleep),
    heart: decryptJsonField<DayRecord['heart']>(r.heart),
    workout: decryptJsonField<DayRecord['workout']>(r.workout),
    stress: decryptJsonField<DayRecord['stress']>(r.stress),
    events: decryptJsonField<DayRecord['events']>(r.events),
  }));

  return NextResponse.json(days);
}

// Shallow-merge two plain objects: incoming fields overwrite existing,
// but existing fields not present in incoming are preserved.
// Both values should be decrypted before merging.
function mergePlain(
  existing: unknown,
  incoming: unknown,
): unknown | undefined {
  if (!incoming) return existing ?? undefined;
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return incoming;
  }
  const ex = existing as Record<string, unknown>;
  const inc = incoming as Record<string, unknown>;
  const result = { ...ex };
  for (const key of Object.keys(inc)) {
    const val = inc[key];
    if (val || !(key in ex) || !ex[key]) {
      result[key] = val;
    }
  }
  return result;
}

// Merge incoming data with existing record so we never overwrite
// one category's data when saving another.
// Decrypts existing → merges → encrypts result.
async function mergedUpsert(userId: string, day: DayRecord) {
  const existing = await prisma.healthRecord.findUnique({
    where: { userId_date: { userId, date: day.date } },
  });

  // Decrypt existing fields for merging
  const exSleep = decryptJsonField(existing?.sleep);
  const exHeart = decryptJsonField(existing?.heart);
  const exWorkout = decryptJsonField(existing?.workout);
  const exStress = decryptJsonField(existing?.stress);

  // Merge then encrypt
  const merged = {
    sleep: toEncrypted(mergePlain(exSleep, day.sleep)),
    heart: toEncrypted(mergePlain(exHeart, day.heart)),
    workout: toEncrypted(mergePlain(exWorkout, day.workout)),
    stress: toEncrypted(mergePlain(exStress, day.stress)),
  };

  // Events use replace strategy (full array from client), encrypt
  const events = day.events !== undefined
    ? toEncrypted(day.events)
    : existing?.events
      ? (encryptJson(decryptJsonField(existing.events)) as Prisma.InputJsonValue | undefined)
      : undefined;

  await prisma.healthRecord.upsert({
    where: { userId_date: { userId, date: day.date } },
    create: {
      userId,
      date: day.date,
      source: day.source ?? null,
      sleep: merged.sleep,
      heart: merged.heart,
      workout: merged.workout,
      stress: merged.stress,
      events,
    },
    update: {
      source: day.source ?? undefined,
      sleep: merged.sleep,
      heart: merged.heart,
      workout: merged.workout,
      stress: merged.stress,
      events,
    },
  });
}

// POST /api/health/records — upsert a single day
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await parseJsonBody<DayRecord>(request);
  if (isErrorResponse(body)) return body;
  const day = body;
  if (!day.date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 });
  }

  await mergedUpsert(session.user.id, day);

  return NextResponse.json({ ok: true });
}

// PUT /api/health/records — bulk upsert
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const putBody = await parseJsonBody<{ records: DayRecord[] }>(request);
  if (isErrorResponse(putBody)) return putBody;
  const { records } = putBody;
  if (!Array.isArray(records)) {
    return NextResponse.json({ error: 'records array required' }, { status: 400 });
  }
  if (records.length > 1000) {
    return NextResponse.json({ error: 'Too many records (max 1000)' }, { status: 400 });
  }

  let count = 0;
  for (const day of records) {
    if (!day.date) continue;
    await mergedUpsert(session.user.id, day);
    count++;
  }

  return NextResponse.json({ ok: true, count });
}

// DELETE /api/health/records — clear all user data (comprehensive right-to-erasure)
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const full = url.searchParams.get('full') === 'true';

  const { count } = await prisma.healthRecord.deleteMany({
    where: { userId: session.user.id },
  });

  const result: Record<string, number> = { healthRecords: count };

  // Full erasure: also delete installation sessions, device tokens, and audit logs
  if (full) {
    const sessions = await prisma.installationSession.deleteMany({
      where: { participantId: session.user.id },
    });
    result.installationSessions = sessions.count;

    const devices = await prisma.deviceToken.deleteMany({
      where: { userId: session.user.id },
    });
    result.deviceTokens = devices.count;

    const audits = await prisma.auditLog.deleteMany({
      where: { userId: session.user.id },
    });
    result.auditLogs = audits.count;
  }

  return NextResponse.json({ ok: true, deleted: result });
}
