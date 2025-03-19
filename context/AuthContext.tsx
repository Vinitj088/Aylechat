'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthDialog } from '@/components/AuthDialog';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  openAuthDialog: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const router = useRouter();

  // Initial session loading
  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error loading session:', error.message);
          return;
        }
        
        if (session) {
          setSession(session);
          setUser(session.user);
        }
      } catch (error) {
        console.error('Unexpected error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSession();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      setIsLoading(false);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Refresh the session token
  const refreshSession = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }
      
      const { session: refreshData } = data;
      
      if (refreshData) {
        setSession(refreshData);
        setUser(refreshData.user);
        return;
      }
      
      throw new Error('No session returned from refresh');
    } catch (error: any) {
      console.error('Error refreshing session:', error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      setSession(data.session);
      setUser(data.user);
      
      // Refresh router data with new auth state
      router.refresh();
      
    } catch (error: any) {
      console.error('Sign in error:', error.message);
      toast.error('Failed to sign in', {
        description: error.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Get the current URL's origin for the redirect
      const origin = window.location.origin;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      
      if (error) {
        throw error;
      }
      
      // In Supabase, signUp might either:
      // 1. Create the user and return session (if email verification is disabled)
      // 2. Create the user but not return session (if email confirmation is required)
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        
        // Refresh router data
        router.refresh();
      } else {
        // Email confirmation is required
        toast.success('Please check your email', {
          description: 'A confirmation link has been sent to your email',
          duration: 5000,
        });
      }
      
    } catch (error: any) {
      console.error('Sign up error:', error.message);
      toast.error('Failed to sign up', {
        description: error.message,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Call the backend signout endpoint to clear server-side cookies
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error('Error from signout API:', data);
      }
      
      // Also sign out on the client
      await supabase.auth.signOut();
      
      // Clear user and session state
      setUser(null);
      setSession(null);
      
      // Redirect to home page and refresh router
      router.push('/');
      router.refresh();
      
    } catch (error: any) {
      console.error('Sign out error:', error.message);
      toast.error('Failed to sign out', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to open the auth dialog
  const openAuthDialog = () => {
    setIsAuthDialogOpen(true);
  };
  
  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
    refreshSession,
    openAuthDialog
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthDialog 
        isOpen={isAuthDialogOpen}
        onClose={() => setIsAuthDialogOpen(false)}
        onSuccess={() => {
          setIsAuthDialogOpen(false);
          router.refresh();
        }}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 