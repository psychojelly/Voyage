import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit, getClientIp } from '@/lib/audit';
import { decryptJsonField } from '@/lib/crypto';
import type { DayRecord } from '@/lib/types';

// GET /api/health/export — export all user data (GDPR right to portability)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Fetch all user data in parallel
  const [user, settings, healthRecords, deviceTokens, installationSessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.userSettings.findUnique({
      where: { userId },
      select: {
        bgEffect: true,
        gcalCalendarIds: true,
        shareScopes: true,
        allowAdmin: true,
        allowArtist: true,
        createdAt: true,
        // Exclude: ouraAccessToken, ouraRefreshToken, shareKey (sensitive)
      },
    }),
    prisma.healthRecord.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    }),
    prisma.deviceToken.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        type: true,
        createdAt: true,
        // Exclude: identifierHash (security)
      },
    }),
    prisma.installationSession.findMany({
      where: { participantId: userId },
      select: {
        id: true,
        checkinAt: true,
        checkoutAt: true,
        eventId: true,
        installation: {
          select: { name: true, room: true },
        },
      },
      orderBy: { checkinAt: 'desc' },
    }),
  ]);

  const healthData: DayRecord[] = healthRecords.map(r => ({
    date: r.date,
    source: r.source ?? undefined,
    sleep: decryptJsonField<DayRecord['sleep']>(r.sleep),
    heart: decryptJsonField<DayRecord['heart']>(r.heart),
    workout: decryptJsonField<DayRecord['workout']>(r.workout),
    stress: decryptJsonField<DayRecord['stress']>(r.stress),
    events: decryptJsonField<DayRecord['events']>(r.events),
  }));

  audit({
    userId,
    action: 'data.access',
    resource: `user:${userId}`,
    detail: { type: 'full_export', recordCount: healthRecords.length },
    ip: getClientIp(request),
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    format: 'health-analytics-dashboard-v0.7.0',
    account: user,
    settings,
    healthData,
    devices: deviceTokens,
    installationSessions: installationSessions.map(s => ({
      id: s.id,
      installation: s.installation.name,
      room: s.installation.room,
      checkinAt: s.checkinAt.toISOString(),
      checkoutAt: s.checkoutAt?.toISOString() ?? null,
      eventId: s.eventId,
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="health-data-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}
