import { createClient } from '@supabase/supabase-js';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Helper function to check if we're on the client side
export const isClient = typeof window !== 'undefined';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use pkce flow which is more secure for SPA
    flowType: 'pkce',
    // Enable debug logging in development
    debug: process.env.NODE_ENV === 'development',
    // Callbacks for session events
    ...(isClient && {
      async onAuthStateChange(event: AuthChangeEvent, session: Session | null) {
        console.log('Supabase Auth State Change:', event, session?.user?.email);
        
        // Set secure cookies for cross-api auth
        if (session?.user) {
          document.cookie = `user-authenticated=true; path=/; max-age=2592000; SameSite=Lax`;
          document.cookie = `user-email=${session.user.email}; path=/; max-age=2592000; SameSite=Lax`;
        }
      }
    })
  },
  // Global error handler
  global: {
    headers: {
      'x-client-info': 'exachat-web-app'
    }
  }
});

// For server-side operations with service role (admin)
export const getServiceSupabase = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(supabaseUrl, supabaseServiceKey);
}; 