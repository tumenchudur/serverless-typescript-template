import { invokeLambda } from '../aws/lambda-client';
import { CustomError } from '../errors/custom-error';
import { logger } from '../utils/logger';

/**
 * Response from permission verification Lambda
 */
export interface PermissionVerificationResponse {
  isAuthorized: boolean;
  response: {
    message: string;
    statusCode: number;
  };
}

/**
 * Verifies if a permission token grants access to required permissions
 *
 * Invokes a dedicated permission verification Lambda function to check
 * if the provided token contains the required permissions.
 *
 * @param permissionToken - Permission token from the Permission header
 * @param requiredPermissions - Array of required permission strings (e.g., ['admin:users:write'])
 * @param functionName - Optional Lambda function name (defaults to PERMISSION_VERIFICATION_FUNCTION env var)
 * @throws CustomError if permissions are insufficient or verification fails
 *
 * @example
 * ```typescript
 * // In handler
 * const { permission } = extractMetadataAndAuthorizationForAdminFromEvent(event);
 * await verifyPermission(permission, ['admin:users:write', 'admin:users:delete']);
 * ```
 */
export async function verifyPermission(
  permissionToken: string,
  requiredPermissions: string[],
  functionName?: string
): Promise<void> {
  const lambdaFunctionName = functionName || process.env['PERMISSION_VERIFICATION_FUNCTION'];

  if (!lambdaFunctionName) {
    logger.error('Permission verification function name not configured');
    throw new CustomError(
      'Permission verification is not configured. Set PERMISSION_VERIFICATION_FUNCTION environment variable.',
      500
    );
  }

  try {
    logger.debug('Verifying permissions', {
      requiredPermissions,
      functionName: lambdaFunctionName
    });

    const result = await invokeLambda<PermissionVerificationResponse>(lambdaFunctionName, {
      body: {
        token: permissionToken,
        requiredPermission: requiredPermissions
      }
    });

    if (!result.isAuthorized) {
      logger.warn('Permission verification failed', {
        requiredPermissions,
        message: result.response.message
      });

      throw new CustomError(result.response.message || 'Insufficient permissions', result.response.statusCode || 403);
    }

    logger.debug('Permission verification successful', { requiredPermissions });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    logger.error('Permission verification error', { error, requiredPermissions });
    throw new CustomError('Failed to verify permissions', 500);
  }
}

/**
 * Silent permission verification that doesn't throw errors
 *
 * Returns true/false instead of throwing. Useful for optional permission checks.
 *
 * @param permissionToken - Permission token from the Permission header
 * @param requiredPermissions - Array of required permission strings
 * @param functionName - Optional Lambda function name
 * @returns True if authorized, false otherwise
 *
 * @example
 * ```typescript
 * const hasAccess = await verifyPermissionSilent(permission, ['admin:reports:read']);
 * if (hasAccess) {
 *   // Include additional data
 * }
 * ```
 */
export async function verifyPermissionSilent(
  permissionToken: string,
  requiredPermissions: string[],
  functionName?: string
): Promise<boolean> {
  try {
    await verifyPermission(permissionToken, requiredPermissions, functionName);
    return true;
  } catch (error) {
    logger.debug('Silent permission verification failed', { error, requiredPermissions });
    return false;
  }
}
