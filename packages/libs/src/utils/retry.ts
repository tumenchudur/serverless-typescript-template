import { logger } from './logger';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in milliseconds before first retry (default: 100) */
  initialDelay: number;
  /** Maximum delay in milliseconds between retries (default: 10000) */
  maxDelay: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  jitter: boolean;
  /** Function to determine if an error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 100,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);

  if (options.jitter) {
    // Add random jitter between 0-30% of the delay
    const jitterFactor = 1 + Math.random() * 0.3;
    return Math.floor(cappedDelay * jitterFactor);
  }

  return cappedDelay;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default retryable error checker
 * Retries on network errors, 5xx responses, and rate limits
 */
function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket hang up') ||
      message.includes('network')
    ) {
      return true;
    }

    // Check for status code in error
    const errorWithStatus = error as { statusCode?: number; status?: number; code?: string };

    if (errorWithStatus.statusCode || errorWithStatus.status) {
      const statusCode = errorWithStatus.statusCode || errorWithStatus.status || 0;
      // Retry on 429 (rate limit) and 5xx (server errors)
      return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
    }

    // AWS SDK throttling
    if (
      errorWithStatus.code === 'ThrottlingException' ||
      errorWithStatus.code === 'ProvisionedThroughputExceededException'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withRetry(() => fetchData(url));
 *
 * // With custom options
 * const result = await withRetry(
 *   () => callExternalApi(),
 *   {
 *     maxRetries: 5,
 *     initialDelay: 200,
 *     isRetryable: (error) => error.statusCode === 503,
 *     onRetry: (error, attempt) => logger.warn(`Retry attempt ${attempt}`)
 *   }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: Partial<RetryOptions> = {}): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  const isRetryable = opts.isRetryable || defaultIsRetryable;

  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we've exhausted all retries
      if (attempt > opts.maxRetries) {
        logger.error('All retry attempts exhausted', {
          attempt,
          maxRetries: opts.maxRetries,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }

      // Check if error is retryable
      if (!isRetryable(error)) {
        logger.debug('Error is not retryable, throwing immediately', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }

      const delay = calculateDelay(attempt, opts);

      logger.warn(`Retry attempt ${attempt}/${opts.maxRetries} after ${delay}ms`, {
        attempt,
        maxRetries: opts.maxRetries,
        delay,
        error: error instanceof Error ? error.message : String(error)
      });

      if (opts.onRetry) {
        opts.onRetry(error, attempt, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a retryable version of a function
 *
 * @param fn - The async function to wrap
 * @param options - Retry configuration options
 * @returns A new function that automatically retries on failure
 *
 * @example
 * ```typescript
 * const retryableFetch = createRetryable(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 3 }
 * );
 *
 * const data = await retryableFetch('https://api.example.com/data');
 * ```
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: Partial<RetryOptions> = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Retry configuration presets for common use cases
 */
export const RetryPresets = {
  /** Fast retries for internal services (3 retries, 50ms initial delay) */
  fast: {
    maxRetries: 3,
    initialDelay: 50,
    maxDelay: 1000,
    backoffMultiplier: 2,
    jitter: true
  } as Partial<RetryOptions>,

  /** Standard retries for external APIs (3 retries, 200ms initial delay) */
  standard: {
    maxRetries: 3,
    initialDelay: 200,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true
  } as Partial<RetryOptions>,

  /** Aggressive retries for critical operations (5 retries, 500ms initial delay) */
  aggressive: {
    maxRetries: 5,
    initialDelay: 500,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true
  } as Partial<RetryOptions>,

  /** Database retries with longer delays (3 retries, 100ms initial delay) */
  database: {
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 3000,
    backoffMultiplier: 2,
    jitter: true,
    isRetryable: (error: unknown) => {
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
          message.includes('connection') ||
          message.includes('timeout') ||
          message.includes('deadlock') ||
          message.includes('too many connections')
        );
      }
      return false;
    }
  } as Partial<RetryOptions>
};
