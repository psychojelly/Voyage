import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Human-friendly action labels
const ACTION_LABELS: Record<string, string> = {
  'consent.change': 'Consent changed',
  'data.access': 'Data accessed',
  'data.delete': 'Data deleted',
  'device.pair.start': 'Device pairing started',
  'device.pair.claim': 'Device paired',
  'device.assign': 'Device assigned',
  'device.remove': 'Device removed',
  'session.create': 'Installation check-in',
  'session.auto_checkout': 'Auto check-out',
  'installation.create': 'Installation created',
  'installation.update': 'Installation updated',
  'installation.delete': 'Installation deleted',
  'auth.login': 'Login',
  'auth.login_failed': 'Failed login attempt',
  'account.delete': 'Account deleted',
};

// GET /api/account/audit?page=1&limit=50
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({
      where: { userId: session.user.id },
    }),
  ]);

  const items = entries.map(e => ({
    id: e.id,
    action: e.action,
    label: ACTION_LABELS[e.action] || e.action,
    resource: e.resource,
    detail: e.detail,
    ip: e.ip,
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
