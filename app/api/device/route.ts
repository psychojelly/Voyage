import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit, getClientIp } from '@/lib/audit';
import { parseJsonBody, isErrorResponse } from '@/lib/api-utils';

// GET /api/device — list user's devices
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const devices = await prisma.deviceToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  const result = devices.map(d => ({
    id: d.id,
    label: d.label,
    type: d.type,
    hashPreview: d.identifierHash.slice(0, 8) + '...',
    createdAt: d.createdAt.toISOString(),
  }));

  return NextResponse.json(result);
}

// DELETE /api/device — remove a device
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await parseJsonBody<{ deviceId: string }>(request);
  if (isErrorResponse(body)) return body;

  const { deviceId } = body;

  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
  }

  // Verify the device belongs to the user
  const device = await prisma.deviceToken.findUnique({
    where: { id: deviceId },
  });

  if (!device || device.userId !== session.user.id) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  await prisma.deviceToken.delete({ where: { id: deviceId } });

  audit({
    userId: session.user.id,
    action: 'device.remove',
    resource: `device:${deviceId}`,
    detail: { label: device.label, type: device.type },
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
