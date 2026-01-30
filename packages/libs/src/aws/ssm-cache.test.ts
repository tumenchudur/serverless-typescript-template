import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as ssmCache from './ssm-cache';

vi.mock('../logging/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ssm-cache', () => {
  beforeEach(() => {
    // Clear cache before each test
    ssmCache.clear();
    vi.clearAllMocks();
  });

  describe('set and get', () => {
    it('should store and retrieve a parameter', () => {
      ssmCache.set('/test/param', 'value123', 300);
      const result = ssmCache.get('/test/param');
      expect(result).toBe('value123');
    });

    it('should return null for non-existent parameter', () => {
      const result = ssmCache.get('/non/existent');
      expect(result).toBeNull();
    });

    it('should return null for expired parameter', () => {
      // Set with 0 second TTL (already expired)
      ssmCache.set('/test/param', 'value123', 0);

      // Wait a tiny bit to ensure expiration
      const result = ssmCache.get('/test/param');
      expect(result).toBeNull();
    });

    it('should not return expired parameter', async () => {
      // Set with very short TTL
      ssmCache.set('/test/param', 'value123', 0.001); // 1ms

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = ssmCache.get('/test/param');
      expect(result).toBeNull();
    });

    it('should store multiple parameters independently', () => {
      ssmCache.set('/param1', 'value1', 300);
      ssmCache.set('/param2', 'value2', 300);
      ssmCache.set('/param3', 'value3', 300);

      expect(ssmCache.get('/param1')).toBe('value1');
      expect(ssmCache.get('/param2')).toBe('value2');
      expect(ssmCache.get('/param3')).toBe('value3');
    });
  });

  describe('clear', () => {
    it('should clear a specific parameter', () => {
      ssmCache.set('/param1', 'value1', 300);
      ssmCache.set('/param2', 'value2', 300);

      ssmCache.clear('/param1');

      expect(ssmCache.get('/param1')).toBeNull();
      expect(ssmCache.get('/param2')).toBe('value2');
    });

    it('should clear all parameters when no name provided', () => {
      ssmCache.set('/param1', 'value1', 300);
      ssmCache.set('/param2', 'value2', 300);
      ssmCache.set('/param3', 'value3', 300);

      ssmCache.clear();

      expect(ssmCache.get('/param1')).toBeNull();
      expect(ssmCache.get('/param2')).toBeNull();
      expect(ssmCache.get('/param3')).toBeNull();
      expect(ssmCache.size()).toBe(0);
    });

    it('should handle clearing non-existent parameter', () => {
      ssmCache.clear('/non/existent');
      expect(ssmCache.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty cache', () => {
      expect(ssmCache.size()).toBe(0);
    });

    it('should return correct size', () => {
      ssmCache.set('/param1', 'value1', 300);
      expect(ssmCache.size()).toBe(1);

      ssmCache.set('/param2', 'value2', 300);
      expect(ssmCache.size()).toBe(2);

      ssmCache.set('/param3', 'value3', 300);
      expect(ssmCache.size()).toBe(3);
    });

    it('should decrease size when clearing parameter', () => {
      ssmCache.set('/param1', 'value1', 300);
      ssmCache.set('/param2', 'value2', 300);
      expect(ssmCache.size()).toBe(2);

      ssmCache.clear('/param1');
      expect(ssmCache.size()).toBe(1);
    });
  });

  describe('getAll', () => {
    it('should return all cached parameters', () => {
      ssmCache.set('/param1', 'value1', 300);
      ssmCache.set('/param2', 'value2', 300);

      const all = ssmCache.getAll();
      expect(all.size).toBe(2);
      expect(all.get('/param1')?.value).toBe('value1');
      expect(all.get('/param2')?.value).toBe('value2');
    });

    it('should return empty map for empty cache', () => {
      const all = ssmCache.getAll();
      expect(all.size).toBe(0);
    });

    it('should return a copy of the cache', () => {
      ssmCache.set('/param1', 'value1', 300);

      const all = ssmCache.getAll();
      all.clear(); // Modify the returned map

      // Original cache should still have the parameter
      expect(ssmCache.get('/param1')).toBe('value1');
    });
  });

  describe('TTL behavior', () => {
    it('should respect TTL for different parameters', async () => {
      ssmCache.set('/short-ttl', 'value1', 0.05); // 50ms
      ssmCache.set('/long-ttl', 'value2', 300); // 5 minutes

      // Wait for short TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(ssmCache.get('/short-ttl')).toBeNull();
      expect(ssmCache.get('/long-ttl')).toBe('value2');
    });

    it('should overwrite existing parameter with new TTL', async () => {
      ssmCache.set('/param', 'value1', 0.05); // 50ms

      // Immediately overwrite with longer TTL
      ssmCache.set('/param', 'value2', 300);

      // Wait for original TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be available with new value
      expect(ssmCache.get('/param')).toBe('value2');
    });
  });
});
