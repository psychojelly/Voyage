import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/users — list users who consented to admin access
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify caller is admin (server-side check via env var)
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || session.user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      userSettings: { allowAdmin: true },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return NextResponse.json(users);
}
