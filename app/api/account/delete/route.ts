import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditAsync, getClientIp } from '@/lib/audit';
import { parseJsonBody, isErrorResponse } from '@/lib/api-utils';

// POST /api/account/delete — permanently delete user account and all data
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await parseJsonBody<{
    password?: string;
    confirmation: string;
  }>(request);
  if (isErrorResponse(body)) return body;

  const { password, confirmation } = body;

  if (confirmation !== 'DELETE MY ACCOUNT') {
    return NextResponse.json(
      { error: 'Please type "DELETE MY ACCOUNT" to confirm' },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // If user has a password, require it for confirmation
  if (user.passwordHash) {
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to confirm account deletion' },
        { status: 400 },
      );
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
    }
  }

  // Audit BEFORE deleting (preserves userId reference; AuditLog has no FK cascade)
  await auditAsync({
    userId: user.id,
    action: 'account.delete',
    resource: `user:${user.id}`,
    detail: { email: user.email },
    ip: getClientIp(request),
  });

  // Delete user — cascades handle: Account, Session, HealthRecord,
  // UserSettings, Installation→InstallationSession, DeviceToken
  await prisma.user.delete({ where: { id: user.id } });

  return NextResponse.json({ ok: true });
}
