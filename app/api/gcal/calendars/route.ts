import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidGcalToken } from '@/lib/gcal-token';

const CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const token = await getValidGcalToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 401 });
  }

  try {
    const res = await fetch(CALENDAR_LIST_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Google Calendar list failed:', text);
      return NextResponse.json({ error: 'Failed to fetch calendars' }, { status: res.status });
    }

    const data = await res.json();
    const calendars = (data.items || []).map((item: { id: string; summary: string; backgroundColor?: string }) => ({
      id: item.id,
      summary: item.summary,
      backgroundColor: item.backgroundColor,
    }));

    // Also return currently selected IDs
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { gcalCalendarIds: true },
    });

    return NextResponse.json({
      calendars,
      selectedIds: settings?.gcalCalendarIds || [],
    });
  } catch (err) {
    console.error('Google Calendar list error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const calendarIds = body.calendarIds;

    if (!Array.isArray(calendarIds)) {
      return NextResponse.json({ error: 'calendarIds must be an array' }, { status: 400 });
    }

    await prisma.userSettings.update({
      where: { userId: session.user.id },
      data: { gcalCalendarIds: calendarIds },
    });

    return NextResponse.json({ ok: true, calendarIds });
  } catch (err) {
    console.error('Google Calendar save selection error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
