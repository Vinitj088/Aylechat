'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

type SupabaseAuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export const SupabaseAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initializeSession = async () => {
      setIsLoading(true);
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        // Set cookies whenever we have a session, even if it's from local storage
        if (session) {
          document.cookie = `user-authenticated=true; path=/; max-age=2592000; SameSite=Lax; Secure`; // 30 days
          document.cookie = `user-email=${session.user.email}; path=/; max-age=2592000; SameSite=Lax; Secure`; // 30 days
          document.cookie = `debug-authenticated=true; path=/; max-age=2592000; SameSite=Lax; Secure`; // 30 days
          console.log('Set session cookies from initialized session');
        }
        
        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
          console.log(`Auth state changed: ${event}`);
          
          // Only update if we have a real change
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            
            // Set cookies on sign in or token refresh
            if (newSession) {
              document.cookie = `user-authenticated=true; path=/; max-age=2592000; SameSite=Lax; Secure`; // 30 days
              document.cookie = `user-email=${newSession.user.email}; path=/; max-age=2592000; SameSite=Lax; Secure`; // 30 days
              document.cookie = `debug-authenticated=true; path=/; max-age=2592000; SameSite=Lax; Secure`; // 30 days
              console.log('Set session cookies after auth state change');
            }
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            
            // Clear cookies on sign out
            document.cookie = 'user-authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = 'user-email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = 'debug-authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            console.log('Cleared session cookies after sign out');
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();
  }, [supabase.auth, router]);

  // Force refresh token periodically to keep session alive
  useEffect(() => {
    // Helper to refresh the token every 10 minutes to keep session alive
    const refreshToken = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('Error refreshing token:', error);
          // If we can't refresh the token but have backup cookies, make sure we don't lose session
          const cookies = document.cookie.split(';').map(c => c.trim());
          const hasCookieAuth = cookies.some(c => c.startsWith('user-authenticated='));
          const hasEmailCookie = cookies.some(c => c.startsWith('user-email='));
          
          if (hasCookieAuth && hasEmailCookie) {
            console.log('Session refresh failed but backup cookies exist, maintaining session');
            // Don't clear session state, let backup cookie auth handle it
          } else {
            console.log('No valid session or backup cookies, clearing session state');
            setSession(null);
            setUser(null);
          }
        } else if (data.session) {
          console.log('Session refreshed successfully');
          setSession(data.session);
          setUser(data.session.user);
          
          // Refresh the cookies too
          document.cookie = `user-authenticated=true; path=/; max-age=2592000; SameSite=Lax; Secure`; // 30 days
          document.cookie = `user-email=${data.session.user.email}; path=/; max-age=2592000; SameSite=Lax; Secure`; // 30 days
          document.cookie = `debug-authenticated=true; path=/; max-age=2592000; SameSite=Lax; Secure`; // 30 days
        }
      } catch (e) {
        console.error('Exception during token refresh:', e);
      }
    };

    // Only set up the refresh interval if we have a session
    if (session) {
      const interval = setInterval(refreshToken, 10 * 60 * 1000); // 10 minutes
      return () => clearInterval(interval);
    }
  }, [session, supabase.auth]);

  // Re-check auth state whenever the page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // When page becomes visible again, try to refresh the token
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) {
            console.log('Session refreshed on visibility change');
            setSession(data.session);
            setUser(data.session.user);
          }
        } catch (e) {
          console.error('Error refreshing session on visibility change:', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [supabase.auth]);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Debug logging
      console.log('Sign in successful, setting session for user:', email);
      
      // We no longer need to manually set cookies since Supabase will handle this automatically
      // with the correct cookie names when using the implicit flow

      // But we'll set a special cookie for debugging
      document.cookie = `user-email=${email}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `user-authenticated=true; path=/; max-age=86400; SameSite=Lax`;
      
      // Small delay to ensure cookies are set
      setTimeout(() => {
        router.refresh();
      }, 500);
    } catch (error: any) {
      throw new Error(error.message || 'Error signing in');
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      setIsLoading(true);
      
      // Sign up the user without email verification
      const { error, data } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { name },
          emailRedirectTo: undefined
        }
      });
      
      if (error) throw error;
      
      console.log('Sign up successful, user data:', data.user?.email);
      
      // Automatically sign in the user after sign-up
      if (data.user) {
        // Update profile data if name is provided
        if (name) {
          await supabase
            .from('profiles')
            .upsert({ 
              id: data.user.id, 
              name,
              email,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        }
        
        // Sign in with the credentials that were just used to sign up
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) throw signInError;
        
        // Set debugging cookie
        document.cookie = `user-email=${email}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `user-authenticated=true; path=/; max-age=86400; SameSite=Lax`;
        
        // Small delay to ensure cookies are set
        setTimeout(() => {
          router.refresh();
        }, 500);
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error signing up');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      
      // Clear debug cookies
      document.cookie = 'user-authenticated=; path=/; max-age=0';
      document.cookie = 'user-email=; path=/; max-age=0';
      
      router.push('/');
      router.refresh();
    } catch (error: any) {
      throw new Error(error.message || 'Error signing out');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SupabaseAuthContext.Provider
      value={{ user, session, isLoading, signIn, signUp, signOut }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
};

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}; 