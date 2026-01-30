import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { logger } from '../utils/logger';
import { CustomError } from '../errors/custom-error';
import type { AxiosClientConfig, RetryConfig } from './axios-types';

/**
 * Default retry configuration for HTTP requests
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  retries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  exponentialBackoff: true,
};

/**
 * Default timeout for HTTP requests (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Calculates the delay before the next retry attempt
 */
function calculateRetryDelay(
  retryCount: number,
  baseDelay: number,
  exponentialBackoff: boolean
): number {
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
 * Creates a configured Axios instance with retry logic, logging, and error handling
 *
 * @param config - Configuration options for the Axios client
 * @returns Configured Axios instance
 *
 * @example
 * ```typescript
 * const client = createAxiosClient({
 *   baseURL: 'https://api.example.com',
 *   timeout: 5000,
 *   authToken: 'Bearer token123',
 *   retryConfig: {
 *     retries: 5,
 *     retryDelay: 2000,
 *     retryableStatuses: [429, 503],
 *     exponentialBackoff: true
 *   }
 * });
 * ```
 */
export function createAxiosClient(config?: AxiosClientConfig): AxiosInstance {
  const {
    baseURL,
    timeout = DEFAULT_TIMEOUT,
    headers = {},
    retryConfig = DEFAULT_RETRY_CONFIG,
    enableLogging = true,
    authToken,
    axiosConfig = {},
  } = config || {};

  // Merge default headers with custom headers
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...headers,
  };

  // Add authorization header if token is provided
  if (authToken) {
    defaultHeaders.Authorization = authToken;
  }

  // Create axios instance
  const axiosDefaults: any = {
    timeout,
    headers: defaultHeaders,
    ...axiosConfig,
  };

  if (baseURL) {
    axiosDefaults.baseURL = baseURL;
  }

  const instance = axios.create(axiosDefaults);

  // Request interceptor for logging
  if (enableLogging) {
    instance.interceptors.request.use(
      (request: InternalAxiosRequestConfig) => {
        logger.debug('HTTP Request', {
          method: request.method?.toUpperCase(),
          url: request.url,
          baseURL: request.baseURL,
          headers: request.headers,
          params: request.params,
        });
        return request;
      },
      (error: AxiosError) => {
        logger.error('HTTP Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );
  }

  // Response interceptor for logging and retry logic
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      if (enableLogging) {
        logger.debug('HTTP Response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          headers: response.headers,
        });
      }
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retryCount?: number;
      };

      // Log error
      if (enableLogging) {
        logger.error('HTTP Response Error', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: originalRequest?.url,
          data: error.response?.data,
        });
      }

      // Check if we should retry
      const shouldRetry =
        originalRequest &&
        error.response &&
        retryConfig.retryableStatuses.includes(error.response.status) &&
        (originalRequest._retryCount || 0) < retryConfig.retries;

      if (shouldRetry) {
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

        const delay = calculateRetryDelay(
          originalRequest._retryCount - 1,
          retryConfig.retryDelay,
          retryConfig.exponentialBackoff
        );

        if (enableLogging) {
          logger.info('Retrying HTTP request', {
            attempt: originalRequest._retryCount,
            maxRetries: retryConfig.retries,
            delayMs: delay,
            url: originalRequest.url,
          });
        }

        await sleep(delay);
        return instance(originalRequest);
      }

      // Convert AxiosError to CustomError
      const customError = new CustomError(
        error.message || 'HTTP request failed',
        error.response?.status || 500,
        'HTTP_ERROR'
      );

      return Promise.reject(customError);
    }
  );

  return instance;
}

/**
 * Default HTTP client instance with standard configuration
 */
export const httpClient = createAxiosClient();

/**
 * Convenience method for GET requests
 *
 * @param url - Request URL
 * @param config - Optional Axios configuration
 * @returns Response data
 *
 * @example
 * ```typescript
 * const user = await get<User>('https://api.example.com/users/1');
 * ```
 */
export async function get<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await httpClient.get<T>(url, config);
  return response.data;
}

/**
 * Convenience method for POST requests
 *
 * @param url - Request URL
 * @param data - Request body
 * @param config - Optional Axios configuration
 * @returns Response data
 *
 * @example
 * ```typescript
 * const newUser = await post<User>('https://api.example.com/users', {
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * });
 * ```
 */
export async function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await httpClient.post<T>(url, data, config);
  return response.data;
}

/**
 * Convenience method for PUT requests
 *
 * @param url - Request URL
 * @param data - Request body
 * @param config - Optional Axios configuration
 * @returns Response data
 *
 * @example
 * ```typescript
 * const updatedUser = await put<User>('https://api.example.com/users/1', {
 *   name: 'Jane Doe'
 * });
 * ```
 */
export async function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await httpClient.put<T>(url, data, config);
  return response.data;
}

/**
 * Convenience method for PATCH requests
 *
 * @param url - Request URL
 * @param data - Request body
 * @param config - Optional Axios configuration
 * @returns Response data
 *
 * @example
 * ```typescript
 * const user = await patch<User>('https://api.example.com/users/1', {
 *   email: 'newemail@example.com'
 * });
 * ```
 */
export async function patch<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await httpClient.patch<T>(url, data, config);
  return response.data;
}

/**
 * Convenience method for DELETE requests
 *
 * @param url - Request URL
 * @param config - Optional Axios configuration
 * @returns Response data
 *
 * @example
 * ```typescript
 * await del('https://api.example.com/users/1');
 * ```
 */
export async function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await httpClient.delete<T>(url, config);
  return response.data;
}
