import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { audit, getClientIp } from '@/lib/audit';
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit';
import { decryptJsonField, encryptJson } from '@/lib/crypto';
import { verifyApiKey } from '@/lib/api-utils';
import type { DayRecord, HealthEvent } from '@/lib/types';
import type { Prisma } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// GET /api/installation/[id]/data — hardware reads participant data
// Auth: X-API-Key header
export async function GET(request: Request, { params }: Params) {
  const rl = checkRateLimit(rateLimitKey(request, 'data'), RATE_LIMITS.hardware);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id } = await params;
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
  }

  const installation = await prisma.installation.findUnique({ where: { id } });

  if (!installation || !verifyApiKey(apiKey, installation.apiKey)) {
    return NextResponse.json({ error: 'Invalid API key or installation' }, { status: 403 });
  }

  // Find all active sessions
  const activeSessions = await prisma.installationSession.findMany({
    where: { installationId: id, checkoutAt: null },
    include: { participant: { select: { id: true } } },
  });

  const now = new Date();
  const timeoutMs = installation.timeoutMin * 60 * 1000;
  const today = todayStr();

  // Separate expired vs active
  const expired: typeof activeSessions = [];
  const current: typeof activeSessions = [];

  for (const s of activeSessions) {
    if (now.getTime() - s.checkinAt.getTime() > timeoutMs) {
      expired.push(s);
    } else {
      current.push(s);
    }
  }

  // Auto-checkout expired sessions and update their events
  for (const s of expired) {
    const checkoutAt = new Date(s.checkinAt.getTime() + timeoutMs);
    const durationMin = installation.timeoutMin;
    const endH = String(checkoutAt.getHours()).padStart(2, '0');
    const endM = String(checkoutAt.getMinutes()).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    await prisma.installationSession.update({
      where: { id: s.id },
      data: { checkoutAt },
    });

    // Update the experience event with endTime + duration
    if (s.eventId) {
      const record = await prisma.healthRecord.findUnique({
        where: { userId_date: { userId: s.participantId, date: today } },
      });
      if (record?.events) {
        const events = decryptJsonField<HealthEvent[]>(record.events) ?? [];
        const updated = events.map(e =>
          e.id === s.eventId ? { ...e, endTime, durationMin } : e
        );
        await prisma.healthRecord.update({
          where: { id: record.id },
          data: { events: encryptJson(updated) as Prisma.InputJsonValue },
        });
      }
    }
  }

  // Re-check consent for each active participant
  const participantIds = current.map(s => s.participantId);
  const settingsMap = new Map<string, boolean>();

  if (participantIds.length > 0) {
    const allSettings = await prisma.userSettings.findMany({
      where: { userId: { in: participantIds } },
      select: { userId: true, allowArtist: true },
    });
    for (const s of allSettings) {
      settingsMap.set(s.userId, s.allowArtist);
    }
  }

  // Fetch today's health records for consenting participants
  const consentedIds = participantIds.filter(uid => settingsMap.get(uid) === true);

  const records = consentedIds.length > 0
    ? await prisma.healthRecord.findMany({
        where: { userId: { in: consentedIds }, date: today },
      })
    : [];

  const recordMap = new Map(records.map(r => [r.userId, r]));

  // Build anonymized response with randomized labels
  // (prevents sequential re-identification across polls)
  const consentedSessions = current.filter(s => settingsMap.get(s.participantId) === true);

  // Shuffle order using Fisher-Yates with crypto randomness
  const shuffled = [...consentedSessions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomBytes(4).readUInt32BE(0) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const participants = shuffled.map((s, idx) => {
      const r = recordMap.get(s.participantId);
      const data: Partial<DayRecord> = {};

      if (r) {
        for (const scope of installation.dataScopes) {
          if (scope === 'sleep' && r.sleep) data.sleep = decryptJsonField<DayRecord['sleep']>(r.sleep);
          if (scope === 'heart' && r.heart) data.heart = decryptJsonField<DayRecord['heart']>(r.heart);
          if (scope === 'workout' && r.workout) data.workout = decryptJsonField<DayRecord['workout']>(r.workout);
          if (scope === 'stress' && r.stress) data.stress = decryptJsonField<DayRecord['stress']>(r.stress);
        }
      }

      return {
        label: `Participant ${String.fromCharCode(65 + (idx % 26))}`,
        checkinAt: s.checkinAt.toISOString(),
        data,
      };
    });

  // Audit data access
  audit({
    action: 'data.access',
    resource: `installation:${id}`,
    detail: {
      participantCount: participants.length,
      scopes: installation.dataScopes,
      expiredCount: expired.length,
    },
    ip: getClientIp(request),
  });

  // Audit auto-checkouts
  for (const s of expired) {
    audit({
      userId: s.participantId,
      action: 'session.auto_checkout',
      resource: `installation:${id}`,
      detail: { sessionId: s.id, timeoutMin: installation.timeoutMin },
    });
  }

  return NextResponse.json({
    installation: {
      id: installation.id,
      name: installation.name,
      room: installation.room,
      timeoutMin: installation.timeoutMin,
    },
    timestamp: now.toISOString(),
    currentTime: nowHHMM(),
    participants,
    expiredCount: expired.length,
  });
}
