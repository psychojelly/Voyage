import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hmacHash } from '@/lib/crypto';
import { audit, getClientIp } from '@/lib/audit';
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit';
import { parseJsonBody, isErrorResponse } from '@/lib/api-utils';

function generatePairingCode(): string {
  // Generate 6-char uppercase alphanumeric code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// POST /api/device/pair — kiosk starts pairing (API key auth)
export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
  }

  // Verify API key belongs to any installation
  const installation = await prisma.installation.findFirst({
    where: { apiKey },
  });

  if (!installation) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
  }

  const body = await parseJsonBody<{ identifier: string }>(request);
  if (isErrorResponse(body)) return body;

  const { identifier } = body;

  if (!identifier || typeof identifier !== 'string' || identifier.length > 256) {
    return NextResponse.json({ error: 'identifier is required (max 256 chars)' }, { status: 400 });
  }

  const identifierHash = hmacHash(identifier);
  const pairingCode = generatePairingCode();
  const pairingExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.deviceToken.upsert({
    where: { identifierHash },
    create: {
      identifierHash,
      pairingCode,
      pairingExpiresAt,
    },
    update: {
      pairingCode,
      pairingExpiresAt,
    },
  });

  audit({
    action: 'device.pair.start',
    resource: `device:${identifierHash.slice(0, 8)}`,
    detail: { installationId: installation.id },
    ip: getClientIp(request),
  });

  return NextResponse.json({ pairingCode });
}

// PUT /api/device/pair — user claims a pairing code (session auth)
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(rateLimitKey(request, 'pairing'), RATE_LIMITS.pairing);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await parseJsonBody<{ pairingCode: string }>(request);
  if (isErrorResponse(body)) return body;

  const { pairingCode } = body;

  if (!pairingCode || typeof pairingCode !== 'string') {
    return NextResponse.json({ error: 'pairingCode is required' }, { status: 400 });
  }

  // Find device with valid pairing code
  const device = await prisma.deviceToken.findFirst({
    where: {
      pairingCode: pairingCode.toUpperCase(),
      pairingExpiresAt: { gt: new Date() },
    },
  });

  if (!device) {
    return NextResponse.json({ error: 'Invalid or expired pairing code' }, { status: 404 });
  }

  // Link device to user and clear pairing data
  const updated = await prisma.deviceToken.update({
    where: { id: device.id },
    data: {
      userId: session.user.id,
      pairingCode: null,
      pairingExpiresAt: null,
    },
  });

  audit({
    userId: session.user.id,
    action: 'device.pair.claim',
    resource: `device:${device.id}`,
    detail: { deviceId: device.id },
    ip: getClientIp(request),
  });

  return NextResponse.json({
    deviceId: updated.id,
    label: updated.label,
  });
}
