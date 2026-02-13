import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit, getClientIp } from '@/lib/audit';
import { parseJsonBody, isErrorResponse, maskApiKey, hashApiKey } from '@/lib/api-utils';

const VALID_ROOMS = ['room-1', 'room-2', 'room-3', 'room-4'];
const VALID_SCOPES = ['sleep', 'heart', 'workout', 'stress'];

// GET /api/installation — list artist's installations
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

  const installations = await prisma.installation.findMany({
    where: { artistId: session.user.id },
    include: {
      _count: {
        select: {
          sessions: { where: { checkoutAt: null } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = installations.map(inst => ({
    id: inst.id,
    artistId: inst.artistId,
    name: inst.name,
    room: inst.room,
    apiKey: maskApiKey(inst.apiKey),
    dataScopes: inst.dataScopes,
    active: inst.active,
    timeoutMin: inst.timeoutMin,
    activeSessions: inst._count.sessions,
    createdAt: inst.createdAt.toISOString(),
  }));

  return NextResponse.json(result);
}

// POST /api/installation — create a new installation
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
    name: string;
    room: string;
    dataScopes: string[];
    timeoutMin?: number;
  }>(request);
  if (isErrorResponse(body)) return body;

  const { name, room, dataScopes, timeoutMin } = body;

  // Validate name
  if (!name || typeof name !== 'string' || name.length > 100) {
    return NextResponse.json({ error: 'name is required (max 100 chars)' }, { status: 400 });
  }

  // Validate room
  if (!room || !VALID_ROOMS.includes(room)) {
    return NextResponse.json({ error: `room must be one of: ${VALID_ROOMS.join(', ')}` }, { status: 400 });
  }

  // Validate scopes
  if (!Array.isArray(dataScopes) || dataScopes.some(s => !VALID_SCOPES.includes(s))) {
    return NextResponse.json({ error: `dataScopes must be an array of: ${VALID_SCOPES.join(', ')}` }, { status: 400 });
  }

  // Validate timeoutMin
  const timeout = timeoutMin ?? 120;
  if (typeof timeout !== 'number' || timeout < 1 || timeout > 1440) {
    return NextResponse.json({ error: 'timeoutMin must be between 1 and 1440' }, { status: 400 });
  }

  // Generate API key, store only the hash
  const plaintextKey = randomUUID();
  const keyHash = hashApiKey(plaintextKey);

  const installation = await prisma.installation.create({
    data: {
      artistId: session.user.id,
      name,
      room,
      apiKey: keyHash,
      dataScopes,
      timeoutMin: timeout,
    },
  });

  audit({
    userId: session.user.id,
    action: 'installation.create',
    resource: `installation:${installation.id}`,
    detail: { name, room, dataScopes, timeoutMin: timeout },
    ip: getClientIp(request),
  });

  // Return the plaintext key — this is the only time it's shown
  return NextResponse.json({
    id: installation.id,
    artistId: installation.artistId,
    name: installation.name,
    room: installation.room,
    apiKey: plaintextKey,
    dataScopes: installation.dataScopes,
    active: installation.active,
    timeoutMin: installation.timeoutMin,
    createdAt: installation.createdAt.toISOString(),
  }, { status: 201 });
}
