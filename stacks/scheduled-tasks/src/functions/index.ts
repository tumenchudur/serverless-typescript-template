import { createDefaultFunction } from '@template/libs';

export const SCHEDULED_FUNCTIONS = {
  syncData: {
    ...createDefaultFunction({
      dir: __dirname,
      fnName: 'sync-data/handler.syncDataHandler',
      other: {
        timeout: 60
      }
    }),
    events: [
      {
        schedule: {
          rate: ['rate(5 minutes)'],
          enabled: true
        }
      }
    ]
  }
};
