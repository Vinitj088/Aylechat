import { db } from './db';
import { sql } from 'kysely';

// Add retry logic for database operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Increase delay for next attempt
      delay = delay * 1.5;
    }
  }
  
  throw lastError;
}

export async function setupDatabase() {
  console.log('🔄 Setting up database tables...');
  
  try {
    // First check if users table exists
    const hasUsersTable = await withRetry(async () => {
      try {
        // Try a simple query to check if the table exists
        await db
          .selectFrom('users')
          .select(db.fn.count<number>('id').as('count'))
          .executeTakeFirst();
        return true;
      } catch (error: any) {
        // If the error is about the table not existing, return false
        if (error.code === '42P01') { // PostgreSQL table does not exist error
          return false;
        }
        // Otherwise, rethrow the error
        throw error;
      }
    });

    if (hasUsersTable) {
      console.log('✅ Users table already exists, skipping creation.');
      return;
    }

    // Create users table
    console.log('👤 Creating users table...');
    await withRetry(async () => {
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
    });
    
    console.log('✅ Users table created successfully.');
    
    // Verify table exists by running a simple query
    const tableCheck = await withRetry(async () => {
      return db
        .selectFrom('users')
        .select(db.fn.count<number>('id').as('count'))
        .executeTakeFirst();
    });
    
    console.log(`✅ Verification complete. Users table has ${tableCheck?.count || 0} records.`);
    console.log('🚀 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error; // Re-throw to ensure callers know the setup failed
  }
} 