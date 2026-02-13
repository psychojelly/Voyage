import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hmacHash, decryptJsonField, encryptJson } from '@/lib/crypto';
import { audit, getClientIp } from '@/lib/audit';
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyApiKey } from '@/lib/api-utils';
import type { HealthEvent } from '@/lib/types';
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

// POST /api/installation/[id]/detect — hardware device detection endpoint
// Auth: X-API-Key header (not session auth)
export async function POST(request: Request, { params }: Params) {
  const rl = checkRateLimit(rateLimitKey(request, 'detect'), RATE_LIMITS.hardware);
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

  let body: { identifier: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { identifier } = body;

  if (!identifier || typeof identifier !== 'string' || identifier.length > 256) {
    return NextResponse.json({ error: 'identifier is required (max 256 chars)' }, { status: 400 });
  }

  // Hash the identifier
  const identifierHash = hmacHash(identifier);

  // Look up device token
  const deviceToken = await prisma.deviceToken.findUnique({
    where: { identifierHash },
  });

  if (!deviceToken) {
    return NextResponse.json({ status: 'unknown_device' });
  }

  if (!deviceToken.userId) {
    return NextResponse.json({ status: 'unlinked_device' });
  }

  // Check user's allowArtist consent
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: deviceToken.userId },
    select: { allowArtist: true },
  });

  if (!userSettings?.allowArtist) {
    return NextResponse.json({ status: 'no_consent' });
  }

  // Check for existing active session
  const existingSession = await prisma.installationSession.findFirst({
    where: {
      installationId: id,
      participantId: deviceToken.userId,
      checkoutAt: null,
    },
  });

  if (existingSession) {
    return NextResponse.json({
      status: 'already_checked_in',
      sessionId: existingSession.id,
    });
  }

  // Create a HealthEvent for the check-in
  const eventId = `checkin-${crypto.randomUUID()}`;
  const today = todayStr();
  const time = nowHHMM();

  const event: HealthEvent = {
    id: eventId,
    time,
    title: installation.name,
    category: 'experience',
    room: installation.room,
    description: `Checked in to ${installation.name}`,
  };

  // Upsert HealthRecord for today: append event to events array
  const existingRecord = await prisma.healthRecord.findUnique({
    where: { userId_date: { userId: deviceToken.userId, date: today } },
  });

  const existingEvents = existingRecord?.events
    ? (decryptJsonField<HealthEvent[]>(existingRecord.events) ?? [])
    : [];

  const updatedEvents = [...existingEvents, event];
  const encryptedEvents = encryptJson(updatedEvents) as Prisma.InputJsonValue;

  await prisma.healthRecord.upsert({
    where: { userId_date: { userId: deviceToken.userId, date: today } },
    create: {
      userId: deviceToken.userId,
      date: today,
      events: encryptedEvents,
    },
    update: {
      events: encryptedEvents,
    },
  });

  // Create InstallationSession
  const session = await prisma.installationSession.create({
    data: {
      installationId: id,
      participantId: deviceToken.userId,
      deviceTokenId: deviceToken.id,
      eventId,
    },
  });

  // Audit session creation
  audit({
    userId: deviceToken.userId,
    action: 'session.create',
    resource: `installation:${id}`,
    detail: { sessionId: session.id, eventId, deviceTokenId: deviceToken.id },
    ip: getClientIp(request),
  });

  return NextResponse.json({
    status: 'checked_in',
    sessionId: session.id,
    eventId,
  });
}
