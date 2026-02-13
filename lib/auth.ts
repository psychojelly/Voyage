import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const providers: Provider[] = [];

// Only add Google if credentials are configured
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  );
}

providers.push(
  Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limit by email to prevent brute-force attacks
        const rl = checkRateLimit(`login:${(credentials.email as string).toLowerCase()}`, RATE_LIMITS.auth);
        if (!rl.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        // Always run bcrypt.compare to prevent timing-based user enumeration.
        // If user doesn't exist, compare against a dummy hash so the
        // response time is indistinguishable from a real comparison.
        const DUMMY_HASH = '$2a$12$x00000000000000000000u0000000000000000000000000000000';
        const hashToCompare = user?.passwordHash || DUMMY_HASH;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          hashToCompare,
        );

        if (!isValid || !user) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: '/login',
  },
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;

        // Determine role: admin by env var, otherwise read from DB
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail && user.email === adminEmail) {
          token.role = 'admin';
        } else {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id as string },
            select: { role: true },
          });
          token.role = (dbUser?.role as 'user' | 'artist' | 'admin') || 'user';
        }
      }
      // When signing in with Google, update the Account record with fresh tokens
      // (Auth.js only writes tokens on first link, not on subsequent sign-ins)
      if (account?.provider === 'google' && user?.id) {
        await prisma.account.updateMany({
          where: { userId: user.id, provider: 'google' },
          data: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
          },
        });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as 'user' | 'artist' | 'admin') || 'user';
      }
      return session;
    },
  },
});
