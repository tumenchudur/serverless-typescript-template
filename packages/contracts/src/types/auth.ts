import { z } from 'zod';

/**
 * Cognito ID Token Schema
 * Structure of JWT tokens issued by AWS Cognito User Pools
 */
export const CognitoIdTokenSchema = z.object({
  sub: z.string(),
  'cognito:username': z.string(),
  email: z.string().email(),
  email_verified: z.boolean(),
  iss: z.string(),
  aud: z.string(),
  token_use: z.string(),
  auth_time: z.number(),
  exp: z.number(),
  iat: z.number(),
  jti: z.string(),
  event_id: z.string().optional(),
  origin_jti: z.string().optional()
});

export type CognitoIdToken = z.infer<typeof CognitoIdTokenSchema>;

/**
 * HTTP Event Metadata (no authentication)
 */
export interface HttpEventMetadata {
  token: string | undefined;
  ipAddress: string | undefined;
  headers: Record<string, string | undefined> | undefined;
  queryParams: Record<string, string | undefined> | undefined;
  body: unknown | undefined;
}

/**
 * HTTP Event Metadata with User Authentication
 */
export interface HttpEventMetadataWithAuth {
  sub: string;
  email: string;
  ipAddress: string | undefined;
  headers: Record<string, string | undefined> | undefined;
  queryParams: Record<string, string | undefined> | undefined;
  body: unknown | undefined;
}

/**
 * HTTP Event Metadata with Admin Authentication
 * Includes permission header for fine-grained access control
 */
export interface HttpEventMetadataWithAdminAuth {
  sub: string;
  email: string;
  permission: string;
  ipAddress: string | undefined;
  headers: Record<string, string | undefined> | undefined;
  queryParams: Record<string, string | undefined> | undefined;
  body: unknown | undefined;
}

/**
 * Cognito User Pool Authorizer Configuration
 */
export interface CognitoAuthorizerConfig {
  name: string;
  arn: string;
  type: 'COGNITO_USER_POOLS';
}

/**
 * API Header Configuration with Cognito Authorizer
 */
export interface ApiHeaderConfig {
  authorizer: CognitoAuthorizerConfig;
  cors?: {
    origin?: string;
    headers?: string[];
    allowCredentials?: boolean;
  };
}
