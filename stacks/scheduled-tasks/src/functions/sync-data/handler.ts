import type { ScheduledHandler } from 'aws-lambda';
import { logger } from '@template/libs';

export const syncDataHandler: ScheduledHandler = async (event) => {
  logger.info('Starting scheduled data sync', { time: event.time });

  try {
    // Example: sync data between systems
    logger.info('Data sync completed successfully');
  } catch (error) {
    logger.error('Data sync failed', error);
    throw error;
  }
};
