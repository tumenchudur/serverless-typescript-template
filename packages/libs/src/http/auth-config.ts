import type { ApiHeaderConfig, CognitoAuthorizerConfig } from '@template/contracts';

/**
 * Creates a Cognito User Pool authorizer configuration
 *
 * @param name - Authorizer name (e.g., 'my-app-users')
 * @param userPoolArn - ARN of the Cognito User Pool
 * @returns Cognito authorizer configuration object
 *
 * @example
 * ```typescript
 * const authorizer = createCognitoAuthorizer(
 *   'my-app-users',
 *   'arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_ABC123'
 * );
 * ```
 */
export function createCognitoAuthorizer(name: string, userPoolArn: string): CognitoAuthorizerConfig {
  return {
    name,
    arn: userPoolArn,
    type: 'COGNITO_USER_POOLS'
  };
}

/**
 * Creates an API header configuration with Cognito User Pool authorizer
 * for user-authenticated endpoints
 *
 * @param userPoolArn - ARN of the Cognito User Pool
 * @param options - Optional CORS configuration
 * @returns API header configuration with user authorizer
 *
 * @example
 * ```typescript
 * export const userAuthConfig = createUserAuthConfig(
 *   'arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_ABC123',
 *   {
 *     origin: 'https://app.example.com',
 *     headers: ['Content-Type', 'Authorization']
 *   }
 * );
 * ```
 */
export function createUserAuthConfig(
  userPoolArn: string,
  options?: {
    authorizerName?: string;
    cors?: {
      origin?: string;
      headers?: string[];
      allowCredentials?: boolean;
    };
  }
): ApiHeaderConfig {
  const authorizerName = options?.authorizerName || 'user-authorizer';

  return {
    authorizer: createCognitoAuthorizer(authorizerName, userPoolArn),
    cors: options?.cors || {
      origin: '*',
      headers: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token']
    }
  };
}

/**
 * Creates an API header configuration with Cognito User Pool authorizer
 * for admin-authenticated endpoints with permission support
 *
 * @param adminPoolArn - ARN of the Cognito Admin User Pool
 * @param options - Optional CORS configuration
 * @returns API header configuration with admin authorizer and Permission header support
 *
 * @example
 * ```typescript
 * export const adminAuthConfig = createAdminAuthConfig(
 *   'arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_XYZ789',
 *   {
 *     origin: 'https://admin.example.com',
 *     headers: ['Content-Type', 'Authorization', 'Permission']
 *   }
 * );
 * ```
 */
export function createAdminAuthConfig(
  adminPoolArn: string,
  options?: {
    authorizerName?: string;
    cors?: {
      origin?: string;
      headers?: string[];
      allowCredentials?: boolean;
    };
  }
): ApiHeaderConfig {
  const authorizerName = options?.authorizerName || 'admin-authorizer';

  return {
    authorizer: createCognitoAuthorizer(authorizerName, adminPoolArn),
    cors: options?.cors || {
      origin: '*',
      headers: ['Content-Type', 'Authorization', 'Permission', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token']
    }
  };
}
