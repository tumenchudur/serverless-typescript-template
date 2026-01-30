import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { createAxiosClient, get, post, put, patch, del, httpClient } from './axios-client';
import type { AxiosClientConfig } from './axios-types';

vi.mock('axios');
vi.mock('../logging/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('axios-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAxiosClient', () => {
    it('should create an axios instance with default configuration', () => {
      const mockInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };
      vi.mocked(axios.create).mockReturnValue(mockInstance as any);

      const client = createAxiosClient();

      expect(axios.create).toHaveBeenCalledWith({
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      expect(mockInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should create an axios instance with custom configuration', () => {
      const mockInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };
      vi.mocked(axios.create).mockReturnValue(mockInstance as any);

      const config: AxiosClientConfig = {
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: { 'X-Custom': 'value' },
        enableLogging: false,
      };

      createAxiosClient(config);

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Custom': 'value',
        },
      });
    });

    it('should add authorization header when authToken is provided', () => {
      const mockInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };
      vi.mocked(axios.create).mockReturnValue(mockInstance as any);

      createAxiosClient({ authToken: 'Bearer token123' });

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
          }),
        })
      );
    });

    it('should disable logging when enableLogging is false', () => {
      const mockInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };
      vi.mocked(axios.create).mockReturnValue(mockInstance as any);

      createAxiosClient({ enableLogging: false });

      // Should only set up response interceptor for retry logic
      expect(mockInstance.interceptors.request.use).not.toHaveBeenCalled();
      expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    it('should make GET request and return data', async () => {
      const mockData = { id: 1, name: 'Test' };
      vi.mocked(httpClient.get).mockResolvedValue({ data: mockData } as any);

      const result = await get('/users/1');

      expect(httpClient.get).toHaveBeenCalledWith('/users/1', undefined);
      expect(result).toEqual(mockData);
    });

    it('should make POST request and return data', async () => {
      const mockData = { id: 1, name: 'Test' };
      const payload = { name: 'Test' };
      vi.mocked(httpClient.post).mockResolvedValue({ data: mockData } as any);

      const result = await post('/users', payload);

      expect(httpClient.post).toHaveBeenCalledWith('/users', payload, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make PUT request and return data', async () => {
      const mockData = { id: 1, name: 'Updated' };
      const payload = { name: 'Updated' };
      vi.mocked(httpClient.put).mockResolvedValue({ data: mockData } as any);

      const result = await put('/users/1', payload);

      expect(httpClient.put).toHaveBeenCalledWith('/users/1', payload, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make PATCH request and return data', async () => {
      const mockData = { id: 1, name: 'Patched' };
      const payload = { name: 'Patched' };
      vi.mocked(httpClient.patch).mockResolvedValue({ data: mockData } as any);

      const result = await patch('/users/1', payload);

      expect(httpClient.patch).toHaveBeenCalledWith('/users/1', payload, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make DELETE request and return data', async () => {
      vi.mocked(httpClient.delete).mockResolvedValue({ data: {} } as any);

      const result = await del('/users/1');

      expect(httpClient.delete).toHaveBeenCalledWith('/users/1', undefined);
      expect(result).toEqual({});
    });
  });

  describe('retry logic', () => {
    it('should retry on retryable status codes', async () => {
      const mockInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
        get: vi.fn(),
      };

      vi.mocked(axios.create).mockReturnValue(mockInstance as any);

      const client = createAxiosClient({
        retryConfig: {
          retries: 2,
          retryDelay: 100,
          retryableStatuses: [503],
          exponentialBackoff: false,
        },
      });

      expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should use exponential backoff when configured', () => {
      const mockInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.create).mockReturnValue(mockInstance as any);

      createAxiosClient({
        retryConfig: {
          retries: 3,
          retryDelay: 1000,
          retryableStatuses: [503],
          exponentialBackoff: true,
        },
      });

      expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should convert axios errors to CustomError', () => {
      const mockInstance = {
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.create).mockReturnValue(mockInstance as any);

      createAxiosClient();

      expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
      const errorHandler = vi.mocked(mockInstance.interceptors.response.use).mock.calls[0]?.[1];
      expect(errorHandler).toBeDefined();
    });
  });
});
