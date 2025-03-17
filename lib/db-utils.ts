import { db } from './db';
import { sql } from 'kysely';

export async function createTablesIfNotExist() {
  const hasUsers = await db
    .selectFrom('users')
    .select('id')
    .limit(1)
    .execute()
    .then(() => true)
    .catch(() => false);

  if (!hasUsers) {
    console.log('Creating database tables...');
    await db.schema
      .createTable('users')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('email', 'varchar', (col) => col.notNull().unique())
      .addColumn('password', 'varchar', (col) => col.notNull())
      .addColumn('name', 'varchar')
      .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .execute();

    await db.schema
      .createTable('sessions')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
      .addColumn('expires_at', 'timestamp', (col) => col.notNull())
      .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .execute();
  } else {
    console.log('Database tables already exist');
  }
} 