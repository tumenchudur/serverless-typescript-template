import * as winston from 'winston';

const logLevel = process.env['LOG_LEVEL'] || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.label({ label: 'TEMPLATE' }),
    winston.format.timestamp(),
    winston.format.printf(
      ({ level, message, label, timestamp }) =>
        `${label} | ${new Date(timestamp as string).toISOString()} | ${level.toUpperCase()} | ${message}`
    )
  ),
  transports: [new winston.transports.Console()]
});
