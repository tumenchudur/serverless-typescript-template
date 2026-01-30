/**
 * Lambda invocation types
 */
export type InvocationType = 'RequestResponse' | 'Event' | 'DryRun';

/**
 * Options for invoking Lambda functions
 */
export interface LambdaInvokeOptions {
  /** The invocation type */
  invocationType?: InvocationType;
  /** Whether to include execution logs in the response */
  logType?: 'None' | 'Tail';
  /** Client context to pass to the function */
  clientContext?: string;
  /** Version or alias to invoke */
  qualifier?: string;
  /** Retry configuration for failed invocations */
  retryConfig?: LambdaRetryConfig;
}

/**
 * Retry configuration for Lambda invocations
 */
export interface LambdaRetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay between retries in milliseconds */
  retryDelay: number;
  /** Whether to use exponential backoff for retry delays */
  exponentialBackoff: boolean;
  /** Error types that should trigger a retry */
  retryableErrors: string[];
}

/**
 * Result from a Lambda invocation with details
 */
export interface LambdaInvokeResult<T> {
  /** The parsed response payload */
  payload: T;
  /** HTTP status code of the invocation */
  statusCode: number | undefined;
  /** Base64-encoded execution logs (if logType was 'Tail') */
  logResult: string | undefined;
  /** Version of the function that was executed */
  executedVersion: string | undefined;
  /** Error type if the function failed */
  functionError: string | undefined;
}

/**
 * Request for batch Lambda invocation
 */
export interface BatchInvokeRequest {
  /** Name of the Lambda function */
  functionName: string;
  /** Payload to pass to the function */
  payload: unknown;
}

/**
 * Result from a single invocation in a batch
 */
export interface BatchInvokeResult<T> {
  /** Name of the Lambda function */
  functionName: string;
  /** Whether the invocation was successful */
  success: boolean;
  /** The result if successful */
  result?: T;
  /** The error if failed */
  error?: Error;
}
