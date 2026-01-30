import { describe, it, expect, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  extractMetadataFromEvent,
  extractMetadataAndAuthorizationFromEvent,
  extractMetadataAndAuthorizationForAdminFromEvent
} from './api-event';
import { CustomError } from '../errors/custom-error';

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

const createMockEvent = (overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 => ({
  version: '2.0',
  routeKey: 'POST /test',
  rawPath: '/test',
  rawQueryString: '',
  headers: {},
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    domainName: 'example.com',
    domainPrefix: 'api',
    http: {
      method: 'POST',
      path: '/test',
      protocol: 'HTTP/1.1',
      sourceIp: '192.168.1.1',
      userAgent: 'test-agent'
    },
    requestId: 'test-request-id',
    routeKey: 'POST /test',
    stage: 'test',
    time: '01/Jan/2024:00:00:00 +0000',
    timeEpoch: 1704067200000
  },
  isBase64Encoded: false,
  ...overrides
});

describe('api-event', () => {
  describe('extractMetadataFromEvent', () => {
    it('should extract basic metadata from event', () => {
      const event = createMockEvent({
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json'
        },
        queryStringParameters: {
          foo: 'bar'
        }
      });

      const metadata = extractMetadataFromEvent(event);

      expect(metadata.token).toBe('test-token');
      expect(metadata.ipAddress).toBe('192.168.1.1');
      expect(metadata.headers).toEqual(event.headers);
      expect(metadata.queryParams).toEqual({ foo: 'bar' });
    });

    it('should handle Authorization with capital A', () => {
      const event = createMockEvent({
        headers: {
          Authorization: 'Bearer test-token-2'
        }
      });

      const metadata = extractMetadataFromEvent(event);
      expect(metadata.token).toBe('test-token-2');
    });

    it('should handle missing authorization header', () => {
      const event = createMockEvent();
      const metadata = extractMetadataFromEvent(event);

      expect(metadata.token).toBeUndefined();
    });
  });

  describe('extractMetadataAndAuthorizationFromEvent', () => {
    const validToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImNvZ25pdG86dXNlcm5hbWUiOiJ0ZXN0dXNlciIsImlzcyI6Imh0dHBzOi8vY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb20vdXMtZWFzdC0xX3Rlc3QiLCJhdWQiOiJ0ZXN0LWNsaWVudC1pZCIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzA0MDY3MjAwLCJleHAiOjE3MDQwNzA4MDAsImlhdCI6MTcwNDA2NzIwMCwianRpIjoidGVzdC1qdGktaWQifQ.mockSignature';

    it('should extract metadata and authorization from valid token', () => {
      const event = createMockEvent({
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      const result = extractMetadataAndAuthorizationFromEvent(event);

      expect(result.sub).toBe('1234567890');
      expect(result.email).toBe('test@example.com');
      expect(result.ipAddress).toBe('192.168.1.1');
    });

    it('should throw error if Authorization header is missing', () => {
      const event = createMockEvent();

      expect(() => extractMetadataAndAuthorizationFromEvent(event)).toThrow(CustomError);
      expect(() => extractMetadataAndAuthorizationFromEvent(event)).toThrow('Authorization header is required');
    });

    it('should throw error for invalid token format', () => {
      const event = createMockEvent({
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect(() => extractMetadataAndAuthorizationFromEvent(event)).toThrow(CustomError);
    });
  });

  describe('extractMetadataAndAuthorizationForAdminFromEvent', () => {
    const validToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi0xMjM0NSIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiY29nbml0bzp1c2VybmFtZSI6ImFkbWludXNlciIsImlzcyI6Imh0dHBzOi8vY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb20vdXMtZWFzdC0xX2FkbWluIiwiYXVkIjoiYWRtaW4tY2xpZW50LWlkIiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE3MDQwNjcyMDAsImV4cCI6MTcwNDA3MDgwMCwiaWF0IjoxNzA0MDY3MjAwLCJqdGkiOiJhZG1pbi1qdGktaWQifQ.mockSignature';

    it('should extract admin metadata with permission token', () => {
      const event = createMockEvent({
        headers: {
          authorization: `Bearer ${validToken}`,
          permission: 'admin-permission-token'
        }
      });

      const result = extractMetadataAndAuthorizationForAdminFromEvent(event);

      expect(result.sub).toBe('admin-12345');
      expect(result.email).toBe('admin@example.com');
      expect(result.permission).toBe('admin-permission-token');
      expect(result.ipAddress).toBe('192.168.1.1');
    });

    it('should handle Permission with capital P', () => {
      const event = createMockEvent({
        headers: {
          Authorization: `Bearer ${validToken}`,
          Permission: 'admin-permission-token-2'
        }
      });

      const result = extractMetadataAndAuthorizationForAdminFromEvent(event);
      expect(result.permission).toBe('admin-permission-token-2');
    });

    it('should throw error if Permission header is missing', () => {
      const event = createMockEvent({
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(() => extractMetadataAndAuthorizationForAdminFromEvent(event)).toThrow(CustomError);
      expect(() => extractMetadataAndAuthorizationForAdminFromEvent(event)).toThrow('Permission header is required');
    });

    it('should throw error if Authorization header is missing', () => {
      const event = createMockEvent({
        headers: {
          permission: 'admin-permission-token'
        }
      });

      expect(() => extractMetadataAndAuthorizationForAdminFromEvent(event)).toThrow(CustomError);
      expect(() => extractMetadataAndAuthorizationForAdminFromEvent(event)).toThrow('Authorization header is required');
    });
  });
});
