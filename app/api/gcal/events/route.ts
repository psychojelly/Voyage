import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidGcalToken } from '@/lib/gcal-token';
import type { HealthEvent } from '@/lib/types';

const EVENTS_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 });
  }

  const token = await getValidGcalToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 401 });
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { gcalCalendarIds: true },
  });

  const calendarIds = settings?.gcalCalendarIds || [];
  if (calendarIds.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // Build time range for the full day
  const timeMin = `${date}T00:00:00Z`;
  const timeMax = `${date}T23:59:59Z`;

  const events: HealthEvent[] = [];

  for (const calendarId of calendarIds) {
    try {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      const res = await fetch(
        `${EVENTS_BASE}/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) continue;

      const data = await res.json();

      for (const item of data.items || []) {
        // Skip all-day events (no dateTime, only date)
        if (!item.start?.dateTime) continue;

        const startDt = new Date(item.start.dateTime);
        const hours = String(startDt.getHours()).padStart(2, '0');
        const minutes = String(startDt.getMinutes()).padStart(2, '0');

        let endTime: string | undefined;
        let durationMin: number | undefined;
        if (item.end?.dateTime) {
          const endDt = new Date(item.end.dateTime);
          endTime = `${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`;
          durationMin = Math.round((endDt.getTime() - startDt.getTime()) / 60000);
        }

        events.push({
          id: `gcal-${item.id}`,
          time: `${hours}:${minutes}`,
          title: item.summary || '(No title)',
          category: 'custom',
          description: item.description ? item.description.slice(0, 200) : undefined,
          color: item.colorId ? undefined : data.summary?.backgroundColor,
          isAuto: true,
          endTime,
          durationMin,
        });
      }
    } catch (err) {
      console.error(`Error fetching calendar ${calendarId}:`, err);
    }
  }

  return NextResponse.json({ events });
}
