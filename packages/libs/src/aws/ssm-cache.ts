import { logger } from '../utils/logger';
import type { CachedParameter } from './ssm-types';

/**
 * In-memory cache for SSM parameters
 * Persists across Lambda invocations in the same execution environment
 */
const cache = new Map<string, CachedParameter>();

/**
 * Retrieves a cached parameter value if it exists and hasn't expired
 *
 * @param name - The parameter name
 * @returns The cached value or null if not found or expired
 */
export function get(name: string): string | null {
  const cached = cache.get(name);

  if (!cached) {
    logger.debug('SSM cache miss', { name });
    return null;
  }

  const now = Date.now();
  if (now >= cached.expires) {
    logger.debug('SSM cache expired', { name, expiresAt: new Date(cached.expires).toISOString() });
    cache.delete(name);
    return null;
  }

  logger.debug('SSM cache hit', { name, expiresAt: new Date(cached.expires).toISOString() });
  return cached.value;
}

/**
 * Stores a parameter value in the cache with a TTL
 *
 * @param name - The parameter name
 * @param value - The parameter value
 * @param ttlSeconds - Time-to-live in seconds
 */
export function set(name: string, value: string, ttlSeconds: number): void {
  const expires = Date.now() + ttlSeconds * 1000;
  cache.set(name, { value, expires });
  logger.debug('SSM cache set', {
    name,
    ttlSeconds,
    expiresAt: new Date(expires).toISOString(),
  });
}

/**
 * Clears cached parameters
 *
 * @param name - Optional parameter name to clear. If not provided, clears all cached parameters.
 */
export function clear(name?: string): void {
  if (name) {
    const deleted = cache.delete(name);
    logger.debug('SSM cache clear single', { name, deleted });
  } else {
    const size = cache.size;
    cache.clear();
    logger.debug('SSM cache clear all', { clearedCount: size });
  }
}

/**
 * Returns the number of cached parameters
 *
 * @returns The number of entries in the cache
 */
export function size(): number {
  return cache.size;
}

/**
 * Returns all cache entries (useful for debugging)
 *
 * @returns Map of all cached parameters
 */
export function getAll(): Map<string, CachedParameter> {
  return new Map(cache);
}
