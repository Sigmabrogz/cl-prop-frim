import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// For query purposes
const queryClient = postgres(connectionString);

// Drizzle client with schema
export const db = drizzle(queryClient, { schema });

// Export types
export type Database = typeof db;

// Re-export schema
export * from './schema/index.js';

