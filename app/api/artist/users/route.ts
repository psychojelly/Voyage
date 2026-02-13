import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/artist/users — anonymized list of users who consented to artist access
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify caller is artist or admin
  const adminEmail = process.env.ADMIN_EMAIL;
  const isAdmin = adminEmail && session.user.email === adminEmail;

  if (!isAdmin) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser?.role !== 'artist' && dbUser?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      userSettings: { allowArtist: true },
    },
    select: { id: true },
  });

  // Return anonymized list — no name or email
  const anonymized = users.map((u, i) => ({
    id: u.id,
    label: `User #${i + 1}`,
  }));

  return NextResponse.json(anonymized);
}
