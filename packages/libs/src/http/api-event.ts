import jwt from 'jsonwebtoken';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  CognitoIdTokenSchema,
  type HttpEventMetadata,
  type HttpEventMetadataWithAuth,
  type HttpEventMetadataWithAdminAuth
} from '@template/contracts';
import { CustomError } from '../errors/custom-error';
import { logger } from '../utils/logger';

/**
 * Extracts basic metadata from API Gateway event (no authentication)
 *
 * @param event - API Gateway proxy event
 * @returns Event metadata including IP, token, headers, query params, and body
 *
 * @example
 * ```typescript
 * const metadata = extractMetadataFromEvent(event);
 * console.log(metadata.ipAddress, metadata.headers);
 * ```
 */
export function extractMetadataFromEvent(event: APIGatewayProxyEventV2): HttpEventMetadata {
  const token = event.headers.authorization?.replace('Bearer ', '') || event.headers.Authorization?.replace('Bearer ', '');
  const ipAddress = event.requestContext?.http?.sourceIp;

  return {
    token,
    ipAddress,
    headers: event.headers,
    queryParams: event.queryStringParameters || undefined,
    body: event.body
  };
}

/**
 * Extracts metadata and validates user authentication from API Gateway event
 *
 * Decodes the JWT token (without verification - API Gateway Cognito authorizer already validated it)
 * and extracts user identity (sub, email) from the token claims.
 *
 * @param event - API Gateway proxy event with Authorization header
 * @returns Event metadata with authenticated user information
 * @throws CustomError if Authorization header is missing or token is invalid
 *
 * @example
 * ```typescript
 * const { sub, email, ipAddress } = extractMetadataAndAuthorizationFromEvent(event);
 * await createUserProfile(sub, email);
 * ```
 */
export function extractMetadataAndAuthorizationFromEvent(event: APIGatewayProxyEventV2): HttpEventMetadataWithAuth {
  const token = event.headers.authorization?.replace('Bearer ', '') || event.headers.Authorization?.replace('Bearer ', '');

  if (!token) {
    logger.warn('Missing Authorization header');
    throw new CustomError('Authorization header is required', 401);
  }

  try {
    // Decode token without verification (API Gateway Cognito authorizer already verified signature)
    const decoded = jwt.decode(token, { json: true });

    if (!decoded) {
      throw new CustomError('Invalid token format', 401);
    }

    // Validate token structure matches Cognito ID token schema
    const { sub, email } = CognitoIdTokenSchema.parse(decoded);

    const ipAddress = event.requestContext?.http?.sourceIp;

    return {
      sub,
      email,
      ipAddress,
      headers: event.headers,
      queryParams: event.queryStringParameters || undefined,
      body: event.body
    };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    logger.error('Failed to decode authorization token', { error });
    throw new CustomError('Invalid authorization token', 401);
  }
}

/**
 * Extracts metadata and validates admin authentication from API Gateway event
 *
 * Similar to extractMetadataAndAuthorizationFromEvent but also extracts the Permission header
 * for fine-grained access control. Used in admin endpoints that require specific permissions.
 *
 * @param event - API Gateway proxy event with Authorization and Permission headers
 * @returns Event metadata with authenticated admin information and permission token
 * @throws CustomError if Authorization or Permission headers are missing or invalid
 *
 * @example
 * ```typescript
 * const { sub, email, permission } = extractMetadataAndAuthorizationForAdminFromEvent(event);
 * await verifyPermission(permission, ['admin:users:write']);
 * ```
 */
export function extractMetadataAndAuthorizationForAdminFromEvent(
  event: APIGatewayProxyEventV2
): HttpEventMetadataWithAdminAuth {
  const token = event.headers.authorization?.replace('Bearer ', '') || event.headers.Authorization?.replace('Bearer ', '');
  const permission = event.headers.permission || event.headers.Permission;

  if (!token) {
    logger.warn('Missing Authorization header');
    throw new CustomError('Authorization header is required', 401);
  }

  if (!permission) {
    logger.warn('Missing Permission header');
    throw new CustomError('Permission header is required', 401);
  }

  try {
    // Decode token without verification (API Gateway Cognito authorizer already verified signature)
    const decoded = jwt.decode(token, { json: true });

    if (!decoded) {
      throw new CustomError('Invalid token format', 401);
    }

    // Validate token structure matches Cognito ID token schema
    const { sub, email } = CognitoIdTokenSchema.parse(decoded);

    const ipAddress = event.requestContext?.http?.sourceIp;

    return {
      sub,
      email,
      permission,
      ipAddress,
      headers: event.headers,
      queryParams: event.queryStringParameters || undefined,
      body: event.body
    };
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    logger.error('Failed to decode authorization token', { error });
    throw new CustomError('Invalid authorization token', 401);
  }
}
