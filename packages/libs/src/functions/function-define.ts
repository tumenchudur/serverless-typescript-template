import type { ApiFuncParams, FuncParams } from './function.types';

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
 */
export function createUserAuthApiFunc(params: ApiFuncParams) {
  const { dir, fnName, http, other } = params;
  const { method, path, more } = http;

  return {
    handler: `${generatePathname(dir)}/handler.${fnName}`,
    events: [
      {
        http: {
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
        }
      }
    ],
    ...(other ?? {})
  };
}

/**
 * Returns an API Lambda function configuration with admin authentication headers.
 */
export function createAdminAuthApiFunc(params: ApiFuncParams) {
  const { dir, fnName, http, other } = params;
  const { method, path, more } = http;

  return {
    handler: `${generatePathname(dir)}/handler.${fnName}`,
    events: [
      {
        http: {
          method,
          path,
          request: {
            parameters: {
              headers: {
                Authorization: true,
                'X-Admin-Key': true
              }
            }
          },
          ...(more ?? {})
        }
      }
    ],
    ...(other ?? {})
  };
}
