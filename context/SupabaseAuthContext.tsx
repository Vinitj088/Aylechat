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
    // Initialize session from local storage on mount
    const initializeSession = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      // Debug logging for session state
      if (session) {
        console.log('Session initialized with user:', session.user.email);
        // Ensure cookies are set
        document.cookie = `user-authenticated=true; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `user-email=${session.user.email}; path=/; max-age=86400; SameSite=Lax`;
      } else {
        console.log('No session found during initialization');
      }
      
      setIsLoading(false);

      // Set up listener for auth state changes
      const { data: { subscription } } = await supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('Auth state changed:', event, session?.user?.email);
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
          
          // Set a debug-only cookie when authentication state changes
          if (session?.user) {
            document.cookie = `user-authenticated=true; path=/; max-age=86400; SameSite=Lax`;
            document.cookie = `user-email=${session.user.email}; path=/; max-age=86400; SameSite=Lax`;
            
            // Force refresh to ensure middleware picks up the session
            if (event === 'SIGNED_IN') {
              console.log('User signed in, refreshing...');
              // Small delay to ensure cookies are set
              setTimeout(() => {
                router.refresh();
              }, 500);
            }
          } else {
            document.cookie = 'user-authenticated=; path=/; max-age=0';
            document.cookie = 'user-email=; path=/; max-age=0';
            
            if (event === 'SIGNED_OUT') {
              console.log('User signed out, refreshing...');
              router.refresh();
            }
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    };

    initializeSession();
  }, [router]);

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