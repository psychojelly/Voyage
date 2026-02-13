import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit, getClientIp } from '@/lib/audit';
import { parseJsonBody, isErrorResponse, maskApiKey } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

const VALID_ROOMS = ['room-1', 'room-2', 'room-3', 'room-4'];
const VALID_SCOPES = ['sleep', 'heart', 'workout', 'stress'];

// GET /api/installation/[id] — get a single installation
export async function GET(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const installation = await prisma.installation.findUnique({ where: { id } });
  if (!installation) {
    return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
  }

  // Verify ownership or admin role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (installation.artistId !== session.user.id && user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    id: installation.id,
    artistId: installation.artistId,
    name: installation.name,
    room: installation.room,
    apiKey: maskApiKey(installation.apiKey),
    dataScopes: installation.dataScopes,
    active: installation.active,
    timeoutMin: installation.timeoutMin,
    createdAt: installation.createdAt.toISOString(),
  });
}

// PATCH /api/installation/[id] — update installation
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const installation = await prisma.installation.findUnique({ where: { id } });
  if (!installation) {
    return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
  }

  // Verify ownership or admin role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (installation.artistId !== session.user.id && user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await parseJsonBody<{
    name?: string;
    room?: string;
    dataScopes?: string[];
    active?: boolean;
    timeoutMin?: number;
  }>(request);
  if (isErrorResponse(body)) return body;

  const { name, room, dataScopes, active, timeoutMin } = body;

  // Validate fields if provided
  if (name !== undefined && (typeof name !== 'string' || name.length > 100)) {
    return NextResponse.json({ error: 'name must be a string (max 100 chars)' }, { status: 400 });
  }

  if (room !== undefined && !VALID_ROOMS.includes(room)) {
    return NextResponse.json({ error: `room must be one of: ${VALID_ROOMS.join(', ')}` }, { status: 400 });
  }

  if (dataScopes !== undefined) {
    if (!Array.isArray(dataScopes) || dataScopes.some(s => !VALID_SCOPES.includes(s))) {
      return NextResponse.json({ error: `dataScopes must be an array of: ${VALID_SCOPES.join(', ')}` }, { status: 400 });
    }
  }

  if (timeoutMin !== undefined && (typeof timeoutMin !== 'number' || timeoutMin < 1 || timeoutMin > 1440)) {
    return NextResponse.json({ error: 'timeoutMin must be between 1 and 1440' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (room !== undefined) data.room = room;
  if (dataScopes !== undefined) data.dataScopes = dataScopes;
  if (active !== undefined) data.active = !!active;
  if (timeoutMin !== undefined) data.timeoutMin = timeoutMin;

  const updated = await prisma.installation.update({
    where: { id },
    data,
  });

  audit({
    userId: session.user.id,
    action: 'installation.update',
    resource: `installation:${id}`,
    detail: data,
    ip: getClientIp(request),
  });

  return NextResponse.json({
    id: updated.id,
    artistId: updated.artistId,
    name: updated.name,
    room: updated.room,
    apiKey: maskApiKey(updated.apiKey),
    dataScopes: updated.dataScopes,
    active: updated.active,
    timeoutMin: updated.timeoutMin,
    createdAt: updated.createdAt.toISOString(),
  });
}

// DELETE /api/installation/[id] — delete installation (cascades sessions)
export async function DELETE(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const installation = await prisma.installation.findUnique({ where: { id } });
  if (!installation) {
    return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
  }

  // Verify ownership or admin role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (installation.artistId !== session.user.id && user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.installation.delete({ where: { id } });

  audit({
    userId: session.user.id,
    action: 'installation.delete',
    resource: `installation:${id}`,
    detail: { name: installation.name, room: installation.room },
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
