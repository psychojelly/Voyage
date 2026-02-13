import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseJsonBody, isErrorResponse } from '@/lib/api-utils';

const VALID_SCOPES = ['sleep', 'heart', 'workout', 'stress'];

// GET /api/health/share — return current share key + scopes
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const row = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { shareKey: true, shareScopes: true },
  });

  return NextResponse.json({
    shareKey: row?.shareKey ?? null,
    shareScopes: row?.shareScopes ?? [],
  });
}

// POST /api/health/share — generate (or regenerate) share key with scopes
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await parseJsonBody<{ scopes?: string[] }>(request);
  if (isErrorResponse(body)) return body;
  const scopes: string[] = Array.isArray(body.scopes)
    ? body.scopes.filter((s: string) => VALID_SCOPES.includes(s))
    : [];

  const shareKey = crypto.randomUUID();

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      shareKey,
      shareScopes: scopes,
    },
    update: {
      shareKey,
      shareScopes: scopes,
    },
  });

  return NextResponse.json({ shareKey, shareScopes: scopes });
}

// DELETE /api/health/share — revoke share key
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, shareKey: null, shareScopes: [] },
    update: { shareKey: null, shareScopes: [] },
  });

  return NextResponse.json({ ok: true });
}
