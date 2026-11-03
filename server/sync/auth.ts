// Shared-secret check (docs/api/sync-v1.md §3): constant-time comparison of SHA-256 digests.
import { createHash, timingSafeEqual } from 'node:crypto';
import { MIN_SECRET_LENGTH } from '../../src/domain/sync/contract';

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/** True if the configured secret exists and is long enough. */
export function isSecretConfigured(secret: string | undefined): secret is string {
  return secret !== undefined && secret.length >= MIN_SECRET_LENGTH;
}

/** The key from `Authorization: Bearer <key>`, or null. */
export function bearerToken(header: string | null): string | null {
  const match = header === null ? null : /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * Compares the provided key with the secret in constant time. Hashing first makes both inputs
 * the same length, so neither the content nor the length leaks through timing.
 */
export function keyMatches(provided: string | null, secret: string): boolean {
  return timingSafeEqual(digest(provided ?? ''), digest(secret)) && provided !== null;
}
