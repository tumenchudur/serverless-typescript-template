import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/contracts/src/tables/*.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/template_db'
  },
  verbose: true,
  strict: true
});
