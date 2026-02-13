import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit, getClientIp } from '@/lib/audit';
import { parseJsonBody, isErrorResponse } from '@/lib/api-utils';
import type { Settings } from '@/lib/types';
import type { Prisma } from '@prisma/client';

// GET /api/health/settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const row = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  if (!row) {
    return NextResponse.json({});
  }

  const settings: Settings = {
    bgEffect: row.bgEffect ?? undefined,
    allowAdmin: row.allowAdmin,
    allowArtist: row.allowArtist,
    ...((row.extraSettings as Record<string, unknown>) ?? {}),
  };

  return NextResponse.json(settings);
}

// PATCH /api/health/settings
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await parseJsonBody<Partial<Settings>>(request);
  if (isErrorResponse(body)) return body;
  const patch = body;

  // Separate known columns from extra settings
  const { bgEffect, allowAdmin, allowArtist, ...extra } = patch;

  const data: Prisma.UserSettingsUpdateInput = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createData: any = {
    userId: session.user.id,
    bgEffect: (bgEffect as string) ?? 'particles',
    extraSettings: (Object.keys(extra).length > 0 ? extra : {}) as Prisma.InputJsonValue,
  };

  if (bgEffect !== undefined) {
    data.bgEffect = bgEffect ?? null;
  }

  if (allowAdmin !== undefined) {
    data.allowAdmin = !!allowAdmin;
    createData.allowAdmin = !!allowAdmin;
  }
  if (allowArtist !== undefined) {
    data.allowArtist = !!allowArtist;
    createData.allowArtist = !!allowArtist;
  }

  // Audit consent changes
  if (allowAdmin !== undefined || allowArtist !== undefined) {
    const existing = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { allowAdmin: true, allowArtist: true },
    });
    const changes: Record<string, { from: boolean; to: boolean }> = {};
    if (allowAdmin !== undefined && existing?.allowAdmin !== !!allowAdmin) {
      changes.allowAdmin = { from: existing?.allowAdmin ?? false, to: !!allowAdmin };
    }
    if (allowArtist !== undefined && existing?.allowArtist !== !!allowArtist) {
      changes.allowArtist = { from: existing?.allowArtist ?? false, to: !!allowArtist };
    }
    if (Object.keys(changes).length > 0) {
      audit({
        userId: session.user.id,
        action: 'consent.change',
        resource: `user:${session.user.id}`,
        detail: changes,
        ip: getClientIp(request),
      });
    }
  }

  // Merge extra settings
  if (Object.keys(extra).length > 0) {
    const existing = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { extraSettings: true },
    });
    const merged = {
      ...((existing?.extraSettings as Record<string, unknown>) ?? {}),
      ...extra,
    };
    data.extraSettings = merged as Prisma.InputJsonValue;
  }

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    create: createData,
    update: data,
  });

  return NextResponse.json({ ok: true });
}
