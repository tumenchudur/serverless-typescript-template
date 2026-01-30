import {
  SSMClient,
  GetParameterCommand,
  GetParametersCommand,
  PutParameterCommand,
  DeleteParameterCommand,
  DeleteParametersCommand,
  DescribeParametersCommand,
  GetParametersByPathCommand,
  type Tag,
  type ParameterStringFilter,
} from '@aws-sdk/client-ssm';
import { logger } from '../utils/logger';
import { CustomError } from '../errors/custom-error';
import * as ssmCache from './ssm-cache';
import type {
  SSMParameterOptions,
  SSMPutParameterOptions,
  SSMListParametersOptions,
  SSMGetParametersByPathOptions,
} from './ssm-types';

const ssmClient = new SSMClient({ region: process.env['AWS_REGION'] || 'ap-southeast-1' });

/**
 * Maximum number of parameters that can be retrieved in a single GetParameters call
 */
const MAX_BATCH_SIZE = 10;

/**
 * Retrieves a single SSM parameter with optional caching
 *
 * @param name - The parameter name
 * @param options - Options for retrieval and caching
 * @returns The parameter value
 *
 * @example
 * ```typescript
 * // Basic usage (backward compatible)
 * const apiKey = await getSSMParameter('/app/api-key', { withDecryption: true });
 *
 * // With caching (5 minutes)
 * const config = await getSSMParameter('/app/config', { withDecryption: false, cacheTTL: 300 });
 * ```
 */
export async function getSSMParameter(
  name: string,
  options: SSMParameterOptions | boolean = true
): Promise<string> {
  try {
    // Support backward compatibility with boolean parameter
    const opts: SSMParameterOptions =
      typeof options === 'boolean' ? { withDecryption: options } : options;

    const { withDecryption = true, cacheTTL = 0 } = opts;

    // Check cache if TTL is set
    if (cacheTTL > 0) {
      const cached = ssmCache.get(name);
      if (cached !== null) {
        return cached;
      }
    }

    logger.debug('Getting SSM parameter', { name, withDecryption });

    const result = await ssmClient.send(
      new GetParameterCommand({
        Name: name,
        WithDecryption: withDecryption,
      })
    );

    if (!result.Parameter?.Value) {
      throw new CustomError(
        `SSM parameter ${name} not found or has no value`,
        404,
        'SSM_PARAMETER_NOT_FOUND'
      );
    }

    const value = result.Parameter.Value;

    // Cache if TTL is set
    if (cacheTTL > 0) {
      ssmCache.set(name, value, cacheTTL);
    }

    logger.info('Retrieved SSM parameter', { name });
    return value;
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    logger.error('Error getting SSM parameter', { name, error });
    throw new CustomError(
      `Failed to retrieve SSM parameter: ${name}`,
      500,
      'SSM_GET_ERROR'
    );
  }
}

/**
 * Retrieves multiple SSM parameters in batch with automatic chunking
 *
 * @param names - Array of parameter names (automatically chunked if > 10)
 * @param options - Options for retrieval and caching
 * @returns Map of parameter names to values
 *
 * @example
 * ```typescript
 * const params = await getSSMParameters([
 *   '/app/db-host',
 *   '/app/db-port',
 *   '/app/api-key'
 * ], { withDecryption: true });
 *
 * console.log(params.get('/app/db-host'));
 * ```
 */
export async function getSSMParameters(
  names: string[],
  options: SSMParameterOptions = {}
): Promise<Map<string, string>> {
  try {
    const { withDecryption = true, cacheTTL = 0 } = options;
    const result = new Map<string, string>();
    const namesToFetch: string[] = [];

    // Check cache first if TTL is set
    if (cacheTTL > 0) {
      for (const name of names) {
        const cached = ssmCache.get(name);
        if (cached !== null) {
          result.set(name, cached);
        } else {
          namesToFetch.push(name);
        }
      }
    } else {
      namesToFetch.push(...names);
    }

    // If all parameters were cached, return early
    if (namesToFetch.length === 0) {
      logger.debug('All SSM parameters retrieved from cache', { count: names.length });
      return result;
    }

    // Chunk into batches of MAX_BATCH_SIZE
    const chunks: string[][] = [];
    for (let i = 0; i < namesToFetch.length; i += MAX_BATCH_SIZE) {
      chunks.push(namesToFetch.slice(i, i + MAX_BATCH_SIZE));
    }

    logger.debug('Getting SSM parameters in batches', {
      total: namesToFetch.length,
      chunks: chunks.length,
      withDecryption,
    });

    // Fetch each chunk
    for (const chunk of chunks) {
      const response = await ssmClient.send(
        new GetParametersCommand({
          Names: chunk,
          WithDecryption: withDecryption,
        })
      );

      // Process valid parameters
      if (response.Parameters) {
        for (const param of response.Parameters) {
          if (param.Name && param.Value) {
            result.set(param.Name, param.Value);

            // Cache if TTL is set
            if (cacheTTL > 0) {
              ssmCache.set(param.Name, param.Value, cacheTTL);
            }
          }
        }
      }

      // Log invalid parameters
      if (response.InvalidParameters && response.InvalidParameters.length > 0) {
        logger.warn('Invalid SSM parameters', { invalidParameters: response.InvalidParameters });
      }
    }

    logger.info('Retrieved SSM parameters', { count: result.size, requested: names.length });
    return result;
  } catch (error) {
    logger.error('Error getting SSM parameters', { names, error });
    throw new CustomError(
      'Failed to retrieve SSM parameters',
      500,
      'SSM_BATCH_GET_ERROR'
    );
  }
}

/**
 * Creates or updates an SSM parameter
 *
 * @param name - The parameter name
 * @param value - The parameter value
 * @param options - Options for creating/updating the parameter
 * @returns The parameter version
 *
 * @example
 * ```typescript
 * await putSSMParameter('/app/api-key', 'secret123', {
 *   type: 'SecureString',
 *   description: 'API key for external service',
 *   overwrite: true,
 *   tags: { Environment: 'production', Team: 'backend' }
 * });
 * ```
 */
export async function putSSMParameter(
  name: string,
  value: string,
  options: SSMPutParameterOptions = {}
): Promise<number> {
  try {
    const {
      description,
      type = 'String',
      overwrite = true,
      tags,
      tier = 'Standard',
    } = options;

    logger.debug('Putting SSM parameter', { name, type, overwrite, tier });

    const tagList: Tag[] | undefined = tags
      ? Object.entries(tags).map(([Key, Value]) => ({ Key, Value }))
      : undefined;

    const result = await ssmClient.send(
      new PutParameterCommand({
        Name: name,
        Value: value,
        Type: type,
        Description: description,
        Overwrite: overwrite,
        Tags: tagList,
        Tier: tier,
      })
    );

    // Clear cache for this parameter since it was updated
    ssmCache.clear(name);

    logger.info('Put SSM parameter', { name, version: result.Version });
    return result.Version || 1;
  } catch (error) {
    logger.error('Error putting SSM parameter', { name, error });
    throw new CustomError(
      `Failed to put SSM parameter: ${name}`,
      500,
      'SSM_PUT_ERROR'
    );
  }
}

/**
 * Deletes a single SSM parameter
 *
 * @param name - The parameter name
 *
 * @example
 * ```typescript
 * await deleteSSMParameter('/app/old-config');
 * ```
 */
export async function deleteSSMParameter(name: string): Promise<void> {
  try {
    logger.debug('Deleting SSM parameter', { name });

    await ssmClient.send(
      new DeleteParameterCommand({
        Name: name,
      })
    );

    // Clear cache for this parameter
    ssmCache.clear(name);

    logger.info('Deleted SSM parameter', { name });
  } catch (error) {
    logger.error('Error deleting SSM parameter', { name, error });
    throw new CustomError(
      `Failed to delete SSM parameter: ${name}`,
      500,
      'SSM_DELETE_ERROR'
    );
  }
}

/**
 * Deletes multiple SSM parameters in batch with automatic chunking
 *
 * @param names - Array of parameter names to delete (automatically chunked if > 10)
 *
 * @example
 * ```typescript
 * await deleteSSMParameters([
 *   '/app/temp-config-1',
 *   '/app/temp-config-2',
 *   '/app/old-api-key'
 * ]);
 * ```
 */
export async function deleteSSMParameters(names: string[]): Promise<void> {
  try {
    // Chunk into batches of MAX_BATCH_SIZE
    const chunks: string[][] = [];
    for (let i = 0; i < names.length; i += MAX_BATCH_SIZE) {
      chunks.push(names.slice(i, i + MAX_BATCH_SIZE));
    }

    logger.debug('Deleting SSM parameters in batches', {
      total: names.length,
      chunks: chunks.length,
    });

    // Delete each chunk
    for (const chunk of chunks) {
      const result = await ssmClient.send(
        new DeleteParametersCommand({
          Names: chunk,
        })
      );

      // Clear cache for deleted parameters
      if (result.DeletedParameters) {
        for (const name of result.DeletedParameters) {
          ssmCache.clear(name);
        }
      }

      // Log invalid parameters
      if (result.InvalidParameters && result.InvalidParameters.length > 0) {
        logger.warn('Invalid SSM parameters for deletion', {
          invalidParameters: result.InvalidParameters,
        });
      }
    }

    logger.info('Deleted SSM parameters', { count: names.length });
  } catch (error) {
    logger.error('Error deleting SSM parameters', { names, error });
    throw new CustomError(
      'Failed to delete SSM parameters',
      500,
      'SSM_BATCH_DELETE_ERROR'
    );
  }
}

/**
 * Lists SSM parameters with optional filters
 *
 * @param options - Options for listing parameters
 * @returns Array of parameter metadata
 *
 * @example
 * ```typescript
 * const params = await listSSMParameters({
 *   maxResults: 50,
 *   filters: [{
 *     key: 'Name',
 *     values: ['/app/']
 *   }]
 * });
 * ```
 */
export async function listSSMParameters(options: SSMListParametersOptions = {}): Promise<
  Array<{
    name: string;
    type: string;
    lastModifiedDate: Date | undefined;
    description: string | undefined;
  }>
> {
  try {
    const { maxResults = 50, nextToken, filters } = options;

    logger.debug('Listing SSM parameters', { maxResults, hasFilters: !!filters });

    const parameterFilters: ParameterStringFilter[] | undefined = filters?.map((f) => ({
      Key: f.key,
      Values: f.values,
    }));

    const result = await ssmClient.send(
      new DescribeParametersCommand({
        MaxResults: maxResults,
        NextToken: nextToken,
        ParameterFilters: parameterFilters,
      })
    );

    const parameters =
      result.Parameters?.map((p) => ({
        name: p.Name || '',
        type: p.Type || '',
        lastModifiedDate: p.LastModifiedDate,
        description: p.Description,
      })) || [];

    logger.info('Listed SSM parameters', { count: parameters.length });
    return parameters;
  } catch (error) {
    logger.error('Error listing SSM parameters', { error });
    throw new CustomError(
      'Failed to list SSM parameters',
      500,
      'SSM_LIST_ERROR'
    );
  }
}

/**
 * Retrieves all parameters under a hierarchical path
 *
 * @param path - The parameter path (e.g., '/app/production/')
 * @param options - Options for retrieval
 * @returns Map of parameter names to values
 *
 * @example
 * ```typescript
 * // Get all parameters under /app/production/ recursively
 * const params = await getSSMParametersByPath('/app/production/', {
 *   recursive: true,
 *   withDecryption: true
 * });
 * ```
 */
export async function getSSMParametersByPath(
  path: string,
  options: SSMGetParametersByPathOptions = {}
): Promise<Map<string, string>> {
  try {
    const {
      recursive = false,
      withDecryption = true,
      maxResults = 10,
      nextToken,
    } = options;

    logger.debug('Getting SSM parameters by path', { path, recursive, withDecryption });

    const result = await ssmClient.send(
      new GetParametersByPathCommand({
        Path: path,
        Recursive: recursive,
        WithDecryption: withDecryption,
        MaxResults: maxResults,
        NextToken: nextToken,
      })
    );

    const parameters = new Map<string, string>();

    if (result.Parameters) {
      for (const param of result.Parameters) {
        if (param.Name && param.Value) {
          parameters.set(param.Name, param.Value);
        }
      }
    }

    logger.info('Retrieved SSM parameters by path', {
      path,
      count: parameters.size,
      hasMore: !!result.NextToken,
    });

    return parameters;
  } catch (error) {
    logger.error('Error getting SSM parameters by path', { path, error });
    throw new CustomError(
      `Failed to retrieve SSM parameters by path: ${path}`,
      500,
      'SSM_GET_BY_PATH_ERROR'
    );
  }
}

/**
 * Clears the SSM parameter cache
 *
 * @param name - Optional parameter name to clear. If not provided, clears all cached parameters.
 *
 * @example
 * ```typescript
 * // Clear specific parameter
 * clearSSMCache('/app/config');
 *
 * // Clear all cached parameters
 * clearSSMCache();
 * ```
 */
export function clearSSMCache(name?: string): void {
  ssmCache.clear(name);
}
