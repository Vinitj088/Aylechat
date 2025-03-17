import { Kysely, Generated } from 'kysely';
import { NeonDialect } from 'kysely-neon';
import ws from 'ws';

// Define database schema
export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
}

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password: string;
  name: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  expires_at: Date;
  created_at: Generated<Date>;
}

// Create and export the database instance
export const db = new Kysely<Database>({
  dialect: new NeonDialect({
    connectionString: process.env.NEON_DATABASE_URL || '',
    webSocketConstructor: ws,
  }),
});