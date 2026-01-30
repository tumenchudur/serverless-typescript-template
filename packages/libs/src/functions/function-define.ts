import type { ApiFuncParams, ApiFuncWithAuthParams, FuncParams } from './function.types';

/**
 * Generates a normalized pathname relative to the project root.
 * Optimized to avoid multiple string operations.
 */
export function generatePathname(context: string): string {
  const cwd = process.cwd();
  return context.startsWith(cwd) ? context.slice(cwd.length + 1).replace(/\\/g, '/') : context.replace(/\\/g, '/');
}

/**
 * Returns a default Lambda function configuration.
 *
 * @param dir - Directory path containing the handler
 * @param fnName - Name of the handler function
 * @param other - Additional Lambda configuration options
 * @returns Lambda function configuration object
 */
export function createDefaultFunction(params: FuncParams) {
  const { dir, fnName, other } = params;
  return {
    handler: `${generatePathname(dir)}/handler.${fnName}`,
    ...(other ?? {})
  };
}

/**
 * Returns a default API Lambda function configuration with HTTP event.
 *
 * @param dir - Directory path containing the handler
 * @param fnName - Name of the handler function
 * @param http - HTTP event configuration
 * @param other - Additional Lambda configuration options
 * @returns Lambda function configuration with HTTP event
 */
export function createDefaultApiFunc(params: ApiFuncParams) {
  const { dir, fnName, http, other } = params;
  const { method, path, more } = http;

  return {
    handler: `${generatePathname(dir)}/handler.${fnName}`,
    events: [
      {
        http: {
          method,
          path,
          ...(more ?? {})
        }
      }
    ],
    ...(other ?? {})
  };
}

/**
 * Returns an API Lambda function configuration with user authentication headers.
 *
 * @param params - Function parameters including optional Cognito authorizer config
 * @returns Lambda function configuration with user authentication
 *
 * @example
 * ```typescript
 * // Without Cognito authorizer (just requires header)
 * createUserAuthApiFunc({
 *   dir: __dirname,
 *   fnName: 'handler.getUser',
 *   http: { method: 'get', path: '/users/{id}' }
 * });
 *
 * // With Cognito authorizer
 * createUserAuthApiFunc({
 *   dir: __dirname,
 *   fnName: 'handler.getUser',
 *   http: { method: 'get', path: '/users/{id}' },
 *   authConfig: userAuthConfig  // from auth-config.ts
 * });
 * ```
 */
export function createUserAuthApiFunc(params: ApiFuncWithAuthParams) {
  const { dir, fnName, http, other, authConfig } = params;
  const { method, path, more } = http;

  const httpConfig: any = {
    method,
    path,
    request: {
      parameters: {
        headers: {
          Authorization: true
        }
      }
    },
    ...(more ?? {})
  };

  // Add Cognito authorizer if provided
  if (authConfig) {
    httpConfig.authorizer = authConfig.authorizer;
    if (authConfig.cors) {
      httpConfig.cors = authConfig.cors;
    }
  }

  return {
    handler: `${generatePathname(dir)}/handler.${fnName}`,
    events: [{ http: httpConfig }],
    ...(other ?? {})
  };
}

/**
 * Returns an API Lambda function configuration with admin authentication headers.
 *
 * @param params - Function parameters including optional Cognito authorizer config
 * @returns Lambda function configuration with admin authentication and Permission header support
 *
 * @example
 * ```typescript
 * // Without Cognito authorizer (just requires headers)
 * createAdminAuthApiFunc({
 *   dir: __dirname,
 *   fnName: 'handler.deleteUser',
 *   http: { method: 'delete', path: '/admin/users/{id}' }
 * });
 *
 * // With Cognito authorizer
 * createAdminAuthApiFunc({
 *   dir: __dirname,
 *   fnName: 'handler.deleteUser',
 *   http: { method: 'delete', path: '/admin/users/{id}' },
 *   authConfig: adminAuthConfig  // from auth-config.ts
 * });
 * ```
 */
export function createAdminAuthApiFunc(params: ApiFuncWithAuthParams) {
  const { dir, fnName, http, other, authConfig } = params;
  const { method, path, more } = http;

  const httpConfig: any = {
    method,
    path,
    request: {
      parameters: {
        headers: {
          Authorization: true,
          Permission: true
        }
      }
    },
    ...(more ?? {})
  };

  // Add Cognito authorizer if provided
  if (authConfig) {
    httpConfig.authorizer = authConfig.authorizer;
    if (authConfig.cors) {
      httpConfig.cors = authConfig.cors;
    }
  }

  return {
    handler: `${generatePathname(dir)}/handler.${fnName}`,
    events: [{ http: httpConfig }],
    ...(other ?? {})
  };
}
