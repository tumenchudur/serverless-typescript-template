import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from '@template/contracts';

// Connection pool configuration for Lambda
const connectionConfig = {
  max: 1, // Lambda should use single connection
  idle_timeout: 20,
  connect_timeout: 10
};

// Lazy initialization - only connect when actually used
let _client: Sql | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

function getClient(): Sql {
  if (!_client) {
    const DATABASE_URL = process.env['DATABASE_URL'];
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    _client = postgres(DATABASE_URL, connectionConfig);
  }
  return _client;
}

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

// Export as getters for lazy initialization
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as never)[prop];
  }
});

export const sql = new Proxy({} as Sql, {
  get(_, prop) {
    return (getClient() as never)[prop];
  }
});

// Type for transaction
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
