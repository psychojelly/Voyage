import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit, getClientIp } from '@/lib/audit';
import { hashApiKey } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };

// POST /api/installation/[id]/rotate-key — generate a new API key
export async function POST(request: Request, { params }: Params) {
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

  const newApiKey = randomUUID();
  const keyHash = hashApiKey(newApiKey);

  await prisma.installation.update({
    where: { id },
    data: { apiKey: keyHash },
  });

  audit({
    userId: session.user.id,
    action: 'installation.update',
    resource: `installation:${id}`,
    detail: { rotatedApiKey: true },
    ip: getClientIp(request),
  });

  // Return the new key in full — this is the only time it's shown
  return NextResponse.json({ apiKey: newApiKey });
}
