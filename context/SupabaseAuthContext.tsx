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
      setIsLoading(false);

      // Set up listener for auth state changes
      const { data: { subscription } } = await supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    };

    initializeSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.refresh();
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
      }
      
      router.refresh();
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