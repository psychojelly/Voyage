import { NextResponse } from 'next/server';
import { hmacHash } from '@/lib/crypto';

/**
 * Safely parse the JSON body of a request.
 * Returns the parsed value or a 400 NextResponse on failure.
 */
export async function parseJsonBody<T>(request: Request): Promise<T | NextResponse> {
  try {
    return await request.json() as T;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

/**
 * Type guard to check if a parseJsonBody result is an error response.
 */
export function isErrorResponse(result: unknown): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Mask an API key, showing only the first 4 and last 4 characters.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

/**
 * Hash an API key for storage. Returns HMAC-SHA256 hex string.
 */
export function hashApiKey(key: string): string {
  return hmacHash(key);
}

/**
 * Verify an incoming API key against a stored value.
 * Handles both new (HMAC hash) and pre-migration (plaintext UUID) formats.
 * Returns true if valid.
 */
export function verifyApiKey(incoming: string, stored: string): boolean {
  const hash = hmacHash(incoming);
  // New format: stored value is the HMAC hash
  if (stored === hash) return true;
  // Pre-migration: stored value is the plaintext UUID
  if (stored === incoming) return true;
  return false;
}

/**
 * Return a generic error to the client while logging the real error server-side.
 */
export function safeErrorResponse(userMessage: string, status: number, internalError?: unknown): NextResponse {
  if (internalError) console.error(userMessage, internalError);
  return NextResponse.json({ error: userMessage }, { status });
}
