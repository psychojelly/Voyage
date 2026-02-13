import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type AuditAction =
  | 'consent.change'
  | 'data.access'
  | 'data.delete'
  | 'device.pair.start'
  | 'device.pair.claim'
  | 'device.assign'
  | 'device.remove'
  | 'session.create'
  | 'session.auto_checkout'
  | 'installation.create'
  | 'installation.update'
  | 'installation.delete'
  | 'auth.login'
  | 'auth.login_failed'
  | 'account.delete';

export interface AuditEntry {
  userId?: string;
  action: AuditAction;
  resource?: string;
  detail?: Record<string, unknown>;
  ip?: string;
}

/**
 * Fire-and-forget audit log entry.
 * Errors are caught and logged to console to avoid breaking the caller.
 */
export function audit(entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        resource: entry.resource ?? null,
        detail: (entry.detail as Prisma.InputJsonValue) ?? undefined,
        ip: entry.ip ?? null,
      },
    })
    .catch((err: unknown) => {
      console.error('Audit log failed:', err);
    });
}

/**
 * Awaitable version of audit logging.
 */
export async function auditAsync(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      resource: entry.resource ?? null,
      detail: (entry.detail as Prisma.InputJsonValue) ?? undefined,
      ip: entry.ip ?? null,
    },
  });
}

/**
 * Extract client IP from request headers.
 * Falls back to 'unknown' if no forwarding headers present.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}
