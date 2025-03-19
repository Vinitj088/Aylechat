import { NextResponse } from 'next/server';
import { migrateUsers, migrateThreads } from '@/lib/migration';

export async function POST() {
  try {
    // Implement some authentication here to ensure only authorized users can run the migration
    // This should not be accessible to everyone
    
    // Run user migration
    const userMigrationResult = await migrateUsers();
    
    // Run thread migration
    const threadMigrationResult = await migrateThreads();
    
    return NextResponse.json({
      success: true,
      users: userMigrationResult,
      threads: threadMigrationResult
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
} 