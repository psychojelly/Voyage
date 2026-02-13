import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hmacHash } from '@/lib/crypto';
import { audit, getClientIp } from '@/lib/audit';
import { parseJsonBody, isErrorResponse } from '@/lib/api-utils';

const VALID_TYPES = ['nfc', 'rfid', 'ble', 'other'];

// GET /api/device/assign — list users with allowArtist=true (anonymized)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== 'artist' && user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: artist or admin role required' }, { status: 403 });
  }

  const consentingSettings = await prisma.userSettings.findMany({
    where: { allowArtist: true },
    select: { userId: true },
    orderBy: { createdAt: 'asc' },
  });

  const users = consentingSettings.map((s, idx) => ({
    id: s.userId,
    label: `User #${idx + 1}`,
  }));

  return NextResponse.json({ users });
}

// POST /api/device/assign — artist assigns device to user
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== 'artist' && user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: artist or admin role required' }, { status: 403 });
  }

  const body = await parseJsonBody<{
    identifier: string;
    userId: string;
    type?: string;
    label?: string;
  }>(request);
  if (isErrorResponse(body)) return body;

  const { identifier, userId, type, label } = body;

  if (!identifier || typeof identifier !== 'string') {
    return NextResponse.json({ error: 'identifier is required' }, { status: 400 });
  }

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (type !== undefined && !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }

  // Verify target user has allowArtist consent
  const targetSettings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { allowArtist: true },
  });

  if (!targetSettings?.allowArtist) {
    return NextResponse.json({ error: 'User has not consented to artist access' }, { status: 403 });
  }

  const identifierHash = hmacHash(identifier);

  const device = await prisma.deviceToken.upsert({
    where: { identifierHash },
    create: {
      identifierHash,
      userId,
      type: type ?? 'nfc',
      label: label ?? null,
    },
    update: {
      userId,
      ...(type !== undefined ? { type } : {}),
      ...(label !== undefined ? { label } : {}),
    },
  });

  audit({
    userId: session.user.id,
    action: 'device.assign',
    resource: `device:${device.id}`,
    detail: { targetUserId: userId, type: device.type, label: device.label },
    ip: getClientIp(request),
  });

  return NextResponse.json({
    id: device.id,
    userId: device.userId,
    type: device.type,
    label: device.label,
    hashPreview: device.identifierHash.slice(0, 8) + '...',
    createdAt: device.createdAt.toISOString(),
  });
}
