import {
  LambdaClient,
  InvokeCommand,
  InvokeWithResponseStreamCommand,
  type InvokeCommandInput
} from '@aws-sdk/client-lambda';
import { logger } from '../utils/logger';
import { CustomError } from '../errors/custom-error';
import type {
  LambdaInvokeOptions,
  LambdaRetryConfig,
  LambdaInvokeResult,
  BatchInvokeRequest,
  BatchInvokeResult
} from './lambda-types';

const lambdaClient = new LambdaClient({ region: process.env['AWS_REGION'] || 'ap-southeast-1' });

/**
 * Default retry configuration for Lambda invocations
 */
const DEFAULT_RETRY_CONFIG: LambdaRetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
  retryableErrors: ['ServiceException', 'TooManyRequestsException', 'ResourceNotReadyException']
};

/**
 * Calculates the delay before the next retry attempt
 */
function calculateRetryDelay(retryCount: number, baseDelay: number, exponentialBackoff: boolean): number {
  if (exponentialBackoff) {
    return baseDelay * Math.pow(2, retryCount);
  }
  return baseDelay;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if an error is retryable based on error name
 */
function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  if (error && typeof error === 'object' && 'name' in error) {
    return retryableErrors.includes(error.name as string);
  }
  return false;
}

/**
 * Invokes a Lambda function with automatic retry logic
 *
 * @param functionName - The name of the Lambda function
 * @param payload - The payload to pass to the function
 * @param options - Optional invocation configuration
 * @returns The parsed response from the Lambda function
 *
 * @example
 * ```typescript
 * // Basic usage (backward compatible)
 * const result = await invokeLambda<ResponseType>('my-function', { key: 'value' });
 *
 * // With async invocation (fire and forget)
 * await invokeLambda('my-function', { data: 'test' }, { invocationType: 'Event' });
 *
 * // With retry configuration
 * const result = await invokeLambda('my-function', { data: 'test' }, {
 *   retryConfig: {
 *     maxRetries: 5,
 *     retryDelay: 2000,
 *     exponentialBackoff: true,
 *     retryableErrors: ['ServiceException']
 *   }
 * });
 * ```
 */
export async function invokeLambda<T>(
  functionName: string,
  payload: unknown,
  options?: LambdaInvokeOptions
): Promise<T> {
  const {
    invocationType = 'RequestResponse',
    logType = 'None',
    clientContext,
    qualifier,
    retryConfig = DEFAULT_RETRY_CONFIG
  } = options || {};

  let retryCount = 0;

  while (true) {
    try {
      logger.debug('Invoking Lambda function', {
        functionName,
        invocationType,
        qualifier,
        retryCount
      });

      const command: InvokeCommandInput = {
        FunctionName: functionName,
        Payload: JSON.stringify(payload),
        InvocationType: invocationType,
        LogType: logType,
        ClientContext: clientContext,
        Qualifier: qualifier
      };

      const result = await lambdaClient.send(new InvokeCommand(command));

      // For Event and DryRun invocations, there's no payload to parse
      if (invocationType === 'Event') {
        logger.info('Lambda function invoked asynchronously', { functionName });
        return {} as T;
      }

      if (invocationType === 'DryRun') {
        logger.info('Lambda function validated successfully', { functionName });
        return {} as T;
      }

      // Parse response for RequestResponse invocations
      if (!result.Payload) {
        throw new CustomError('Lambda invocation returned no payload', 500, 'LAMBDA_NO_PAYLOAD');
      }

      const response = JSON.parse(new TextDecoder().decode(result.Payload));

      if (result.FunctionError) {
        logger.error('Lambda function error', {
          functionName,
          functionError: result.FunctionError,
          response
        });
        throw new CustomError(
          `Lambda invocation failed: ${response.errorMessage || 'Unknown error'}`,
          500,
          'LAMBDA_FUNCTION_ERROR'
        );
      }

      logger.info('Lambda function invoked successfully', {
        functionName,
        statusCode: result.StatusCode
      });

      return response as T;
    } catch (error) {
      // Check if we should retry
      const shouldRetry = retryCount < retryConfig.maxRetries && isRetryableError(error, retryConfig.retryableErrors);

      if (!shouldRetry) {
        if (error instanceof CustomError) {
          throw error;
        }

        logger.error('Error invoking Lambda', { functionName, error });
        throw new CustomError(`Failed to invoke Lambda function: ${functionName}`, 500, 'LAMBDA_INVOKE_ERROR');
      }

      retryCount++;
      const delay = calculateRetryDelay(retryCount - 1, retryConfig.retryDelay, retryConfig.exponentialBackoff);

      logger.info('Retrying Lambda invocation', {
        functionName,
        attempt: retryCount,
        maxRetries: retryConfig.maxRetries,
        delayMs: delay
      });

      await sleep(delay);
    }
  }
}

/**
 * Invokes a Lambda function and returns detailed result information
 *
 * @param functionName - The name of the Lambda function
 * @param payload - The payload to pass to the function
 * @param options - Optional invocation configuration
 * @returns Detailed invocation result including status, logs, and version
 *
 * @example
 * ```typescript
 * const result = await invokeLambdaWithDetails<ResponseType>('my-function', { key: 'value' }, {
 *   logType: 'Tail'
 * });
 *
 * console.log('Status:', result.statusCode);
 * console.log('Version:', result.executedVersion);
 * console.log('Logs:', Buffer.from(result.logResult || '', 'base64').toString());
 * ```
 */
export async function invokeLambdaWithDetails<T>(
  functionName: string,
  payload: unknown,
  options?: LambdaInvokeOptions
): Promise<LambdaInvokeResult<T>> {
  try {
    const { invocationType = 'RequestResponse', logType = 'Tail', clientContext, qualifier } = options || {};

    logger.debug('Invoking Lambda function with details', {
      functionName,
      invocationType,
      qualifier
    });

    const command: InvokeCommandInput = {
      FunctionName: functionName,
      Payload: JSON.stringify(payload),
      InvocationType: invocationType,
      LogType: logType,
      ClientContext: clientContext,
      Qualifier: qualifier
    };

    const result = await lambdaClient.send(new InvokeCommand(command));

    const payloadData = result.Payload ? JSON.parse(new TextDecoder().decode(result.Payload)) : {};

    return {
      payload: payloadData as T,
      statusCode: result.StatusCode,
      logResult: result.LogResult,
      executedVersion: result.ExecutedVersion,
      functionError: result.FunctionError
    };
  } catch (error) {
    logger.error('Error invoking Lambda with details', { functionName, error });
    throw new CustomError(
      `Failed to invoke Lambda function with details: ${functionName}`,
      500,
      'LAMBDA_INVOKE_DETAILS_ERROR'
    );
  }
}

/**
 * Invokes a Lambda function asynchronously (fire and forget)
 *
 * @param functionName - The name of the Lambda function
 * @param payload - The payload to pass to the function
 *
 * @example
 * ```typescript
 * // Fire and forget - doesn't wait for response
 * await invokeLambdaAsync('process-data', { userId: '123' });
 * ```
 */
export async function invokeLambdaAsync(functionName: string, payload: unknown): Promise<void> {
  await invokeLambda(functionName, payload, { invocationType: 'Event' });
}

/**
 * Validates that a Lambda function can be invoked without actually executing it
 *
 * @param functionName - The name of the Lambda function
 * @param payload - The payload to validate
 * @returns True if validation succeeds
 *
 * @example
 * ```typescript
 * const isValid = await validateLambdaInvocation('my-function', { test: true });
 * if (isValid) {
 *   console.log('Function invocation is valid');
 * }
 * ```
 */
export async function validateLambdaInvocation(functionName: string, payload: unknown): Promise<boolean> {
  try {
    await invokeLambda(functionName, payload, { invocationType: 'DryRun' });
    return true;
  } catch (error) {
    logger.warn('Lambda validation failed', { functionName, error });
    return false;
  }
}

/**
 * Invokes multiple Lambda functions in parallel
 *
 * @param requests - Array of function invocation requests
 * @param options - Optional invocation configuration applied to all requests
 * @returns Array of results with success/failure status for each invocation
 *
 * @example
 * ```typescript
 * const results = await batchInvokeLambda<ResponseType>([
 *   { functionName: 'function-1', payload: { id: 1 } },
 *   { functionName: 'function-2', payload: { id: 2 } },
 *   { functionName: 'function-3', payload: { id: 3 } }
 * ]);
 *
 * for (const result of results) {
 *   if (result.success) {
 *     console.log(`${result.functionName} succeeded:`, result.result);
 *   } else {
 *     console.log(`${result.functionName} failed:`, result.error);
 *   }
 * }
 * ```
 */
export async function batchInvokeLambda<T>(
  requests: BatchInvokeRequest[],
  options?: LambdaInvokeOptions
): Promise<BatchInvokeResult<T>[]> {
  logger.debug('Batch invoking Lambda functions', { count: requests.length });

  const promises = requests.map(async (request): Promise<BatchInvokeResult<T>> => {
    try {
      const result = await invokeLambda<T>(request.functionName, request.payload, options);
      return {
        functionName: request.functionName,
        success: true,
        result
      };
    } catch (error) {
      return {
        functionName: request.functionName,
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  });

  const results = await Promise.all(promises);

  const successCount = results.filter((r) => r.success).length;
  logger.info('Batch Lambda invocation completed', {
    total: results.length,
    successful: successCount,
    failed: results.length - successCount
  });

  return results;
}

/**
 * Invokes a Lambda function with streaming response
 *
 * @param functionName - The name of the Lambda function
 * @param payload - The payload to pass to the function
 * @returns The streamed response data
 *
 * @example
 * ```typescript
 * const streamData = await invokeLambdaWithStreaming<ResponseType>(
 *   'streaming-function',
 *   { query: 'large-dataset' }
 * );
 * ```
 */
export async function invokeLambdaWithStreaming<T>(functionName: string, payload: unknown): Promise<T> {
  try {
    logger.debug('Invoking Lambda function with streaming', { functionName });

    const result = await lambdaClient.send(
      new InvokeWithResponseStreamCommand({
        FunctionName: functionName,
        Payload: JSON.stringify(payload)
      })
    );

    if (!result.EventStream) {
      throw new CustomError('Lambda streaming invocation returned no event stream', 500, 'LAMBDA_NO_STREAM');
    }

    // Collect all chunks from the stream
    const chunks: Uint8Array[] = [];
    for await (const event of result.EventStream) {
      if (event.PayloadChunk?.Payload) {
        chunks.push(event.PayloadChunk.Payload);
      }
      if (event.InvokeComplete) {
        logger.debug('Lambda streaming completed', {
          functionName,
          error: event.InvokeComplete.ErrorCode
        });
        if (event.InvokeComplete.ErrorCode) {
          throw new CustomError(
            `Lambda streaming failed: ${event.InvokeComplete.ErrorCode}`,
            500,
            'LAMBDA_STREAM_ERROR'
          );
        }
      }
    }

    // Combine all chunks and parse
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const response = JSON.parse(new TextDecoder().decode(combined));
    logger.info('Lambda streaming invocation completed', { functionName });

    return response as T;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    logger.error('Error invoking Lambda with streaming', { functionName, error });
    throw new CustomError(
      `Failed to invoke Lambda function with streaming: ${functionName}`,
      500,
      'LAMBDA_STREAMING_ERROR'
    );
  }
}
