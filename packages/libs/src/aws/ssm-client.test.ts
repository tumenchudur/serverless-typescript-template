import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSMClient } from '@aws-sdk/client-ssm';
import {
  getSSMParameter,
  getSSMParameters,
  putSSMParameter,
  deleteSSMParameter,
  deleteSSMParameters,
  listSSMParameters,
  getSSMParametersByPath,
  clearSSMCache
} from './ssm-client';
import * as ssmCache from './ssm-cache';

vi.mock('@aws-sdk/client-ssm');
vi.mock('../logging/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('ssm-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSSMCache();
  });

  describe('getSSMParameter', () => {
    it('should retrieve a parameter (backward compatible with boolean)', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameter: { Value: 'test-value' }
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      const result = await getSSMParameter('/test/param', true);

      expect(result).toBe('test-value');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should retrieve a parameter with options object', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameter: { Value: 'test-value' }
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      const result = await getSSMParameter('/test/param', { withDecryption: true });

      expect(result).toBe('test-value');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should cache parameter with TTL', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameter: { Value: 'test-value' }
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      // First call - should hit AWS
      const result1 = await getSSMParameter('/test/param', { withDecryption: true, cacheTTL: 300 });
      expect(result1).toBe('test-value');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      const result2 = await getSSMParameter('/test/param', { withDecryption: true, cacheTTL: 300 });
      expect(result2).toBe('test-value');
      expect(mockSend).toHaveBeenCalledTimes(1); // Should not call AWS again
    });

    it('should throw CustomError when parameter not found', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameter: {}
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      await expect(getSSMParameter('/test/param', true)).rejects.toThrow();
    });
  });

  describe('getSSMParameters', () => {
    it('should retrieve multiple parameters', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameters: [
          { Name: '/param1', Value: 'value1' },
          { Name: '/param2', Value: 'value2' }
        ],
        InvalidParameters: []
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      const result = await getSSMParameters(['/param1', '/param2']);

      expect(result.size).toBe(2);
      expect(result.get('/param1')).toBe('value1');
      expect(result.get('/param2')).toBe('value2');
    });

    it('should chunk requests for more than 10 parameters', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameters: Array.from({ length: 10 }, (_, i) => ({
          Name: `/param${i}`,
          Value: `value${i}`
        })),
        InvalidParameters: []
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      const names = Array.from({ length: 25 }, (_, i) => `/param${i}`);
      await getSSMParameters(names);

      // Should make 3 calls (10, 10, 5)
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('should use cache when TTL is set', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameters: [
          { Name: '/param1', Value: 'value1' },
          { Name: '/param2', Value: 'value2' }
        ],
        InvalidParameters: []
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      // First call
      await getSSMParameters(['/param1', '/param2'], { cacheTTL: 300 });
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await getSSMParameters(['/param1', '/param2'], { cacheTTL: 300 });
      expect(mockSend).toHaveBeenCalledTimes(1); // No additional call
      expect(result.size).toBe(2);
    });
  });

  describe('putSSMParameter', () => {
    it('should create/update a parameter', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Version: 1
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      const version = await putSSMParameter('/test/param', 'new-value', {
        type: 'String',
        description: 'Test parameter',
        overwrite: true
      });

      expect(version).toBe(1);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should clear cache after update', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameter: { Value: 'old-value' }
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      // Cache a parameter
      await getSSMParameter('/test/param', { cacheTTL: 300 });

      // Update it
      mockSend.mockResolvedValue({ Version: 2 });
      await putSSMParameter('/test/param', 'new-value');

      // Cache should be cleared
      expect(ssmCache.get('/test/param')).toBeNull();
    });

    it('should convert tags object to tag array', async () => {
      const mockSend = vi.fn().mockResolvedValue({ Version: 1 });
      vi.mocked(SSMClient).prototype.send = mockSend;

      await putSSMParameter('/test/param', 'value', {
        tags: { Environment: 'production', Team: 'backend' }
      });

      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('deleteSSMParameter', () => {
    it('should delete a parameter', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      vi.mocked(SSMClient).prototype.send = mockSend;

      await deleteSSMParameter('/test/param');

      expect(mockSend).toHaveBeenCalled();
    });

    it('should clear cache after deletion', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameter: { Value: 'test-value' }
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      // Cache a parameter
      await getSSMParameter('/test/param', { cacheTTL: 300 });

      // Delete it
      mockSend.mockResolvedValue({});
      await deleteSSMParameter('/test/param');

      // Cache should be cleared
      expect(ssmCache.get('/test/param')).toBeNull();
    });
  });

  describe('deleteSSMParameters', () => {
    it('should delete multiple parameters', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        DeletedParameters: ['/param1', '/param2'],
        InvalidParameters: []
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      await deleteSSMParameters(['/param1', '/param2']);

      expect(mockSend).toHaveBeenCalled();
    });

    it('should chunk deletion requests for more than 10 parameters', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        DeletedParameters: Array.from({ length: 10 }, (_, i) => `/param${i}`),
        InvalidParameters: []
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      const names = Array.from({ length: 25 }, (_, i) => `/param${i}`);
      await deleteSSMParameters(names);

      // Should make 3 calls (10, 10, 5)
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });

  describe('listSSMParameters', () => {
    it('should list parameters', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameters: [
          {
            Name: '/param1',
            Type: 'String',
            Description: 'Test param 1'
          },
          {
            Name: '/param2',
            Type: 'SecureString',
            Description: 'Test param 2'
          }
        ]
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      const result = await listSSMParameters();

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('/param1');
      expect(result[1]?.name).toBe('/param2');
    });

    it('should list parameters with filters', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameters: [{ Name: '/app/param1', Type: 'String' }]
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      await listSSMParameters({
        filters: [{ key: 'Name', values: ['/app/'] }]
      });

      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('getSSMParametersByPath', () => {
    it('should retrieve parameters by path', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameters: [
          { Name: '/app/db/host', Value: 'localhost' },
          { Name: '/app/db/port', Value: '5432' }
        ]
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      const result = await getSSMParametersByPath('/app/db/');

      expect(result.size).toBe(2);
      expect(result.get('/app/db/host')).toBe('localhost');
      expect(result.get('/app/db/port')).toBe('5432');
    });

    it('should retrieve parameters recursively', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        Parameters: [
          { Name: '/app/db/host', Value: 'localhost' },
          { Name: '/app/cache/host', Value: 'redis' }
        ]
      });
      vi.mocked(SSMClient).prototype.send = mockSend;

      await getSSMParametersByPath('/app/', { recursive: true });

      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('clearSSMCache', () => {
    it('should clear specific parameter from cache', () => {
      ssmCache.set('/param1', 'value1', 300);
      ssmCache.set('/param2', 'value2', 300);

      clearSSMCache('/param1');

      expect(ssmCache.get('/param1')).toBeNull();
      expect(ssmCache.get('/param2')).toBe('value2');
    });

    it('should clear all parameters from cache', () => {
      ssmCache.set('/param1', 'value1', 300);
      ssmCache.set('/param2', 'value2', 300);

      clearSSMCache();

      expect(ssmCache.get('/param1')).toBeNull();
      expect(ssmCache.get('/param2')).toBeNull();
    });
  });
});
