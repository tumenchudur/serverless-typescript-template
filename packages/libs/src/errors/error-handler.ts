import { ZodError } from 'zod';
import { CustomError } from './custom-error';
import { logger } from '../utils/logger';
import { formatApiResponse } from '../http/response-format';

export function handleApiFuncError(error: unknown) {
  if (error instanceof CustomError) {
    logger.warn(`CustomError: ${error.message} (${error.statusCode})`);
    return formatApiResponse({ message: error.message }, error.statusCode);
  }

  if (error instanceof ZodError) {
    const fields = error.issues.map((err) => err.path.join('.'));
    logger.warn(`Validation error: ${fields.join(', ')}`);
    return formatApiResponse({ message: `Invalid fields: ${fields.join(', ')}` }, 400);
  }

  if (error instanceof Error) {
    logger.error(`Unhandled error: ${error.message}`, error);
    return formatApiResponse({ message: 'Internal server error' }, 500);
  }

  logger.error('Unknown error:', error);
  return formatApiResponse({ message: 'Unexpected error' }, 500);
}
