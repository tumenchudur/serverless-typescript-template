/**
 * Options for retrieving SSM parameters
 */
export interface SSMParameterOptions {
  /** Whether to decrypt SecureString parameters */
  withDecryption?: boolean;
  /** Cache time-to-live in seconds (0 = no cache) */
  cacheTTL?: number;
}

/**
 * Options for creating or updating SSM parameters
 */
export interface SSMPutParameterOptions {
  /** Human-readable description of the parameter */
  description?: string;
  /** The type of parameter */
  type?: 'String' | 'StringList' | 'SecureString';
  /** Whether to overwrite an existing parameter */
  overwrite?: boolean;
  /** Tags to attach to the parameter */
  tags?: Record<string, string>;
  /** The parameter tier (affects cost and limits) */
  tier?: 'Standard' | 'Advanced' | 'Intelligent-Tiering';
}

/**
 * Cached parameter with expiration timestamp
 */
export interface CachedParameter {
  /** The parameter value */
  value: string;
  /** Unix timestamp (ms) when this cache entry expires */
  expires: number;
}

/**
 * Options for listing SSM parameters
 */
export interface SSMListParametersOptions {
  /** Maximum number of parameters to return */
  maxResults?: number;
  /** Token for pagination */
  nextToken?: string;
  /** Filters to apply when listing parameters */
  filters?: Array<{
    key: string;
    values: string[];
  }>;
}

/**
 * Options for retrieving parameters by path
 */
export interface SSMGetParametersByPathOptions {
  /** Whether to recursively retrieve all parameters under the path */
  recursive?: boolean;
  /** Whether to decrypt SecureString parameters */
  withDecryption?: boolean;
  /** Maximum number of parameters to return */
  maxResults?: number;
  /** Token for pagination */
  nextToken?: string;
}
