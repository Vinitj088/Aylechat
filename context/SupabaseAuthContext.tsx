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

  // Initialize and set up auth state change listener
  useEffect(() => {
    const initializeSession = async () => {
      setIsLoading(true);
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setSession(newSession);
            setUser(newSession?.user ?? null);
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();
  }, []);

  // Session refresh logic
  useEffect(() => {
    // Refresh token periodically
    const refreshInterval = setInterval(async () => {
      if (session) {
        const { data } = await supabase.auth.refreshSession();
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
      }
    }, 10 * 60 * 1000); // Every 10 minutes
    
    // Refresh when tab becomes visible
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && session) {
        const { data } = await supabase.auth.refreshSession();
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session]);

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
      
      const { error, data } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { name }
        }
      });
      
      if (error) throw error;
      
      // Create profile
      if (data.user) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: email,
            name: name || email.split('@')[0],
            created_at: new Date().toISOString()
          });
        } catch (e) {
          // Silently handle profile creation error
          // User is still created, just without profile data
        }
        
        router.refresh();
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