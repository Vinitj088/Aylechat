import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Create a single, simplified Supabase client with minimal logging
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Use pkce flow for browser auth
    flowType: 'pkce',
    // Disable debug logs
    debug: false,
    detectSessionInUrl: true,
    // Don't filter logs for cleaner output
  },
});

// Simplify the client even more: disable console logs
if (typeof window !== 'undefined') {
  // Only in browser environment
  const originalConsoleLog = console.log;
  // Filter out GoTrueClient logs
  console.log = function(...args) {
    if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('GoTrueClient')) {
      // Skip GoTrueClient logs
      return;
    }
    originalConsoleLog.apply(console, args);
  };
}

// For server-side operations with service role (admin)
export const getServiceSupabase = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  });
}; 