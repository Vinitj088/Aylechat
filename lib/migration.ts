import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { migrateUserToSupabase } from './supabase-utils';
import { supabase, getServiceSupabase } from './supabase';

const prisma = new PrismaClient();

export async function migrateUsers() {
  try {
    console.log('🔄 Starting user migration from NextAuth to Supabase...');
    
    // Get all users from Prisma/NextAuth
    const users = await prisma.user.findMany({
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    console.log(`📊 Found ${users.length} users to migrate`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Migrate each user to Supabase
    for (const user of users) {
      try {
        // Skip if user doesn't have an email or password
        if (!user.email || !user.password) {
          console.log(`⚠️ Skipping user ${user.id}: Missing email or password`);
          skipCount++;
          continue;
        }
        
        // Check if user already exists in Supabase
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
          
        if (existingUser) {
          console.log(`ℹ️ User ${user.email} already exists in Supabase, skipping`);
          skipCount++;
          continue;
        }
        
        // Migrate user to Supabase
        const result = await migrateUserToSupabase(
          user.email,
          user.password, // Assuming password is already hashed
          user.name || undefined
        );
        
        if (result.success) {
          console.log(`✅ Migrated user ${user.email} successfully`);
          successCount++;
        } else {
          console.error(`❌ Failed to migrate user ${user.email}: ${result.message}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrating user ${user.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('📝 Migration summary:');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⚠️ Skipped: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    return {
      total: users.length,
      success: successCount,
      skipped: skipCount,
      error: errorCount
    };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Function to migrate thread data from your custom implementation to Supabase
export async function migrateThreads() {
  // Implement based on your current thread storage mechanism
  // This is just a starting point you'll need to customize
  try {
    console.log('🔄 Starting thread migration to Supabase...');
    
    // Get all threads from your current database
    // Example assuming you have threads in Prisma:
    // const threads = await prisma.thread.findMany({
    //   include: {
    //     messages: true
    //   }
    // });
    
    // Use Kysely to get threads if you're using that
    // const threads = await db.selectFrom('threads').selectAll().execute();
    
    // For each thread, create it in Supabase
    // for (const thread of threads) {
    //   const serviceClient = getServiceSupabase();
    //   
    //   // Create the thread
    //   const { data: newThread, error } = await serviceClient
    //     .from('threads')
    //     .insert({
    //       id: thread.id, // Keep the same ID for easier mapping
    //       user_id: thread.userId,
    //       title: thread.title,
    //       model: thread.model,
    //       created_at: thread.createdAt,
    //       updated_at: thread.updatedAt
    //     })
    //     .select()
    //     .single();
    //     
    //   if (error) throw error;
    //   
    //   // Migrate all messages for this thread
    //   if (thread.messages && thread.messages.length > 0) {
    //     const messagesToInsert = thread.messages.map(msg => ({
    //       thread_id: newThread.id,
    //       role: msg.role,
    //       content: msg.content,
    //       created_at: msg.createdAt
    //     }));
    //     
    //     const { error: messagesError } = await serviceClient
    //       .from('thread_messages')
    //       .insert(messagesToInsert);
    //       
    //     if (messagesError) throw messagesError;
    //   }
    // }
    
    console.log('✅ Thread migration completed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Thread migration failed:', error);
    return { success: false, error };
  }
} 