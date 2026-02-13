'use client';

import { useState, useMemo } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { validatePassword } from '@/lib/password-validation';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordValidation = useMemo(
    () => (password ? validatePassword(password) : null),
    [password],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Signup failed');
        setLoading(false);
        return;
      }

      // Auto sign-in after signup
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Account created but sign-in failed. Please go to login.');
        setLoading(false);
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Start syncing your health data</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="name">Name (optional)</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 12 characters, mixed case, digit, special"
            required
            minLength={12}
            autoComplete="new-password"
          />
          {passwordValidation && !passwordValidation.valid && (
            <ul className="auth-password-errors">
              {passwordValidation.errors.map(err => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          className="btn btn-secondary auth-social"
          onClick={() => signIn('google', { callbackUrl: '/' })}
        >
          Continue with Google
        </button>

        <p className="auth-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
        <p className="auth-footer">
          <Link href="/">Continue without account</Link>
        </p>
        <p className="auth-footer" style={{ fontSize: '0.75rem' }}>
          <Link href="/privacy">Privacy Policy</Link> &middot; <Link href="/terms">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
