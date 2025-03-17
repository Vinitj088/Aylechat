import { db } from './db';
import { sql } from 'kysely';

export async function createTables() {
  const tablesExist = await checkIfTablesExist();
  
  if (!tablesExist) {
    console.log('Creating database tables...');
    
    // Create users table
    await db.schema
      .createTable('users')
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('email', 'varchar', (col) => col.unique().notNull())
      .addColumn('password', 'varchar', (col) => col.notNull())
      .addColumn('name', 'varchar')
      .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
      .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
      .execute();
    
    // Create sessions table
    await db.schema
      .createTable('sessions')
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
      .addColumn('expires_at', 'timestamp', (col) => col.notNull())
      .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
      .execute();
    
    console.log('Database tables created successfully');
  } else {
    console.log('Database tables already exist');
  }
}

async function checkIfTablesExist(): Promise<boolean> {
  try {
    // Check if the users table exists using a raw SQL query
    const result = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      ) as exists
    `.execute(db);
    
    return result.rows[0]?.exists || false;
  } catch (error) {
    console.error('Error checking if tables exist:', error);
    return false;
  }
} 