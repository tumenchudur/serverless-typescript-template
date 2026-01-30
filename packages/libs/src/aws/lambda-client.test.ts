import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LambdaClient } from '@aws-sdk/client-lambda';
import {
  invokeLambda,
  invokeLambdaWithDetails,
  invokeLambdaAsync,
  validateLambdaInvocation,
  batchInvokeLambda,
  invokeLambdaWithStreaming,
} from './lambda-client';

vi.mock('@aws-sdk/client-lambda');
vi.mock('../logging/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('lambda-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invokeLambda', () => {
    it('should invoke a Lambda function successfully (backward compatible)', async () => {
      const mockResponse = { statusCode: 200, body: 'success' };
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 200,
        Payload: new TextEncoder().encode(JSON.stringify(mockResponse)),
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      const result = await invokeLambda('test-function', { test: true });

      expect(result).toEqual(mockResponse);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should invoke with RequestResponse by default', async () => {
      const mockResponse = { data: 'test' };
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 200,
        Payload: new TextEncoder().encode(JSON.stringify(mockResponse)),
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      await invokeLambda('test-function', { test: true });

      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle async invocation (Event type)', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 202,
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      const result = await invokeLambda('test-function', { test: true }, {
        invocationType: 'Event',
      });

      expect(result).toEqual({});
      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle DryRun invocation', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 204,
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      const result = await invokeLambda('test-function', { test: true }, {
        invocationType: 'DryRun',
      });

      expect(result).toEqual({});
      expect(mockSend).toHaveBeenCalled();
    });

    it('should throw CustomError when function returns error', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 200,
        FunctionError: 'Unhandled',
        Payload: new TextEncoder().encode(JSON.stringify({ errorMessage: 'Test error' })),
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      await expect(invokeLambda('test-function', { test: true })).rejects.toThrow();
    });

    it('should throw CustomError when no payload returned', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 200,
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      await expect(invokeLambda('test-function', { test: true })).rejects.toThrow();
    });

    it('should retry on retryable errors', async () => {
      const error = new Error('ServiceException');
      error.name = 'ServiceException';

      const mockSend = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          StatusCode: 200,
          Payload: new TextEncoder().encode(JSON.stringify({ success: true })),
        });

      vi.mocked(LambdaClient).prototype.send = mockSend;

      const result = await invokeLambda('test-function', { test: true }, {
        retryConfig: {
          maxRetries: 2,
          retryDelay: 10,
          exponentialBackoff: false,
          retryableErrors: ['ServiceException'],
        },
      });

      expect(result).toEqual({ success: true });
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('ValidationException');
      error.name = 'ValidationException';

      const mockSend = vi.fn().mockRejectedValue(error);
      vi.mocked(LambdaClient).prototype.send = mockSend;

      await expect(
        invokeLambda('test-function', { test: true }, {
          retryConfig: {
            maxRetries: 2,
            retryDelay: 10,
            exponentialBackoff: false,
            retryableErrors: ['ServiceException'],
          },
        })
      ).rejects.toThrow();

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('invokeLambdaWithDetails', () => {
    it('should return detailed invocation result', async () => {
      const mockPayload = { data: 'test' };
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 200,
        Payload: new TextEncoder().encode(JSON.stringify(mockPayload)),
        LogResult: 'base64encodedlogs',
        ExecutedVersion: '$LATEST',
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      const result = await invokeLambdaWithDetails('test-function', { test: true });

      expect(result.payload).toEqual(mockPayload);
      expect(result.statusCode).toBe(200);
      expect(result.logResult).toBe('base64encodedlogs');
      expect(result.executedVersion).toBe('$LATEST');
    });

    it('should include function error in result', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 200,
        FunctionError: 'Unhandled',
        Payload: new TextEncoder().encode(JSON.stringify({ errorMessage: 'Test error' })),
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      const result = await invokeLambdaWithDetails('test-function', { test: true });

      expect(result.functionError).toBe('Unhandled');
    });
  });

  describe('invokeLambdaAsync', () => {
    it('should invoke Lambda asynchronously', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 202,
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      await invokeLambdaAsync('test-function', { test: true });

      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('validateLambdaInvocation', () => {
    it('should return true for valid invocation', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        StatusCode: 204,
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      const result = await validateLambdaInvocation('test-function', { test: true });

      expect(result).toBe(true);
    });

    it('should return false for invalid invocation', async () => {
      const mockSend = vi.fn().mockRejectedValue(new Error('Invalid'));
      vi.mocked(LambdaClient).prototype.send = mockSend;

      const result = await validateLambdaInvocation('test-function', { test: true });

      expect(result).toBe(false);
    });
  });

  describe('batchInvokeLambda', () => {
    it('should invoke multiple functions in parallel', async () => {
      const mockSend = vi.fn().mockImplementation((command) => {
        const payload = JSON.parse(
          new TextDecoder().decode(command.input.Payload)
        );
        return Promise.resolve({
          StatusCode: 200,
          Payload: new TextEncoder().encode(JSON.stringify({ result: payload.id })),
        });
      });
      vi.mocked(LambdaClient).prototype.send = mockSend;

      const requests = [
        { functionName: 'function-1', payload: { id: 1 } },
        { functionName: 'function-2', payload: { id: 2 } },
        { functionName: 'function-3', payload: { id: 3 } },
      ];

      const results = await batchInvokeLambda(requests);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should handle mixed success and failure', async () => {
      const mockSend = vi
        .fn()
        .mockResolvedValueOnce({
          StatusCode: 200,
          Payload: new TextEncoder().encode(JSON.stringify({ success: true })),
        })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          StatusCode: 200,
          Payload: new TextEncoder().encode(JSON.stringify({ success: true })),
        });

      vi.mocked(LambdaClient).prototype.send = mockSend;

      const requests = [
        { functionName: 'function-1', payload: {} },
        { functionName: 'function-2', payload: {} },
        { functionName: 'function-3', payload: {} },
      ];

      const results = await batchInvokeLambda(requests);

      expect(results).toHaveLength(3);
      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(false);
      expect(results[2]?.success).toBe(true);
    });

    it('should return error details for failed invocations', async () => {
      const mockError = new Error('Test error');
      const mockSend = vi.fn().mockRejectedValue(mockError);
      vi.mocked(LambdaClient).prototype.send = mockSend;

      const requests = [{ functionName: 'test-function', payload: {} }];

      const results = await batchInvokeLambda(requests);

      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toBeDefined();
      expect(results[0]?.error?.message).toContain('Test error');
    });
  });

  describe('invokeLambdaWithStreaming', () => {
    it('should handle streaming response', async () => {
      const mockPayload = { data: 'streamed-data' };
      const mockEventStream = [
        {
          PayloadChunk: {
            Payload: new TextEncoder().encode(JSON.stringify(mockPayload)),
          },
        },
        {
          InvokeComplete: {},
        },
      ];

      const mockSend = vi.fn().mockResolvedValue({
        EventStream: {
          [Symbol.asyncIterator]: async function* () {
            for (const event of mockEventStream) {
              yield event;
            }
          },
        },
      });

      vi.mocked(LambdaClient).prototype.send = mockSend;

      const result = await invokeLambdaWithStreaming('test-function', { test: true });

      expect(result).toEqual(mockPayload);
    });

    it('should handle streaming error', async () => {
      const mockEventStream = [
        {
          InvokeComplete: {
            ErrorCode: 'FunctionError',
          },
        },
      ];

      const mockSend = vi.fn().mockResolvedValue({
        EventStream: {
          [Symbol.asyncIterator]: async function* () {
            for (const event of mockEventStream) {
              yield event;
            }
          },
        },
      });

      vi.mocked(LambdaClient).prototype.send = mockSend;

      await expect(
        invokeLambdaWithStreaming('test-function', { test: true })
      ).rejects.toThrow();
    });

    it('should throw error when no event stream returned', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      vi.mocked(LambdaClient).prototype.send = mockSend;

      await expect(
        invokeLambdaWithStreaming('test-function', { test: true })
      ).rejects.toThrow();
    });
  });
});
