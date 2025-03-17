import { Generated } from 'kysely';

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

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
} 