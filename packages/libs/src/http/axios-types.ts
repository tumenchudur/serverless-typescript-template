import type { AxiosRequestConfig } from 'axios';

/**
 * Configuration for retry logic in HTTP requests
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  retries: number;
  /** Initial delay between retries in milliseconds */
  retryDelay: number;
  /** HTTP status codes that should trigger a retry */
  retryableStatuses: number[];
  /** Whether to use exponential backoff for retry delays */
  exponentialBackoff: boolean;
}

/**
 * Configuration options for creating an Axios client instance
 */
export interface AxiosClientConfig {
  /** Base URL for all requests */
  baseURL?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Default headers to include in all requests */
  headers?: Record<string, string>;
  /** Retry configuration for failed requests */
  retryConfig?: RetryConfig;
  /** Enable request/response logging via Winston */
  enableLogging?: boolean;
  /** Authentication token to include in Authorization header */
  authToken?: string;
  /** Additional Axios configuration options */
  axiosConfig?: AxiosRequestConfig;
}
