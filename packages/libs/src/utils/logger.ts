import * as winston from 'winston';
import { randomUUID } from 'crypto';

const logLevel = process.env['LOG_LEVEL'] || 'info';
const isProduction = process.env['STAGE'] === 'prod' || process.env['NODE_ENV'] === 'production';

/**
 * Correlation ID storage for request tracing
 * Uses AsyncLocalStorage pattern for Lambda context
 */
let currentCorrelationId: string | null = null;
let currentRequestContext: Record<string, unknown> = {};

/**
 * Set the correlation ID for the current request
 * Call this at the start of each Lambda invocation
 */
export function setCorrelationId(id?: string): string {
  currentCorrelationId = id || randomUUID();
  return currentCorrelationId;
}

/**
 * Get the current correlation ID
 */
export function getCorrelationId(): string | null {
  return currentCorrelationId;
}

/**
 * Set additional context for all logs in the current request
 */
export function setRequestContext(context: Record<string, unknown>): void {
  currentRequestContext = { ...currentRequestContext, ...context };
}

/**
 * Clear the request context (call at end of request)
 */
export function clearRequestContext(): void {
  currentCorrelationId = null;
  currentRequestContext = {};
}

/**
 * Custom format for adding correlation ID and context
 */
const correlationFormat = winston.format((info) => {
  if (currentCorrelationId) {
    info.correlationId = currentCorrelationId;
  }
  if (Object.keys(currentRequestContext).length > 0) {
    info.context = currentRequestContext;
  }
  return info;
});

/**
 * JSON format for production (CloudWatch-friendly)
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  correlationFormat(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Human-readable format for development
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  correlationFormat(),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { level, message, timestamp, correlationId, context, stack, ...meta } = info;
    const corrId = typeof correlationId === 'string' ? `[${correlationId.slice(0, 8)}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const contextStr = context ? ` ctx=${JSON.stringify(context)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} ${corrId} ${level}: ${message}${metaStr}${contextStr}${stackStr}`;
  })
);

/**
 * Logger instance with JSON format in production, readable format in development
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: isProduction ? jsonFormat : devFormat,
  defaultMeta: {
    service: process.env['SERVICE_NAME'] || 'template'
  },
  transports: [new winston.transports.Console()]
});

/**
 * Create a child logger with additional default metadata
 */
export function createLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}

/**
 * Log with structured data
 */
export const log = {
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),

  /**
   * Log API request start
   */
  requestStart: (method: string, path: string, meta?: Record<string, unknown>) => {
    logger.info(`${method} ${path} - started`, { type: 'request_start', method, path, ...meta });
  },

  /**
   * Log API request completion
   */
  requestEnd: (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    meta?: Record<string, unknown>
  ) => {
    logger.info(`${method} ${path} - ${statusCode} (${durationMs}ms)`, {
      type: 'request_end',
      method,
      path,
      statusCode,
      durationMs,
      ...meta
    });
  },

  /**
   * Log database query
   */
  dbQuery: (operation: string, table: string, durationMs: number, meta?: Record<string, unknown>) => {
    logger.debug(`DB ${operation} on ${table} (${durationMs}ms)`, {
      type: 'db_query',
      operation,
      table,
      durationMs,
      ...meta
    });
  },

  /**
   * Log external API call
   */
  externalCall: (
    service: string,
    endpoint: string,
    statusCode: number,
    durationMs: number,
    meta?: Record<string, unknown>
  ) => {
    logger.info(`External call to ${service} ${endpoint} - ${statusCode} (${durationMs}ms)`, {
      type: 'external_call',
      service,
      endpoint,
      statusCode,
      durationMs,
      ...meta
    });
  }
};
