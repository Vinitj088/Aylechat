'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  openAuthDialog: () => void;
};

// Create context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global state for authentication dialog
let globalOpenAuthDialog: (() => void) | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authDialogCallback, setAuthDialogCallback] = useState<() => void>(() => {
    // Default implementation does nothing
    return () => {};
  });
  const router = useRouter();

  // Function to expose opening the auth dialog
  const openAuthDialog = useCallback(() => {
    if (authDialogCallback) {
      authDialogCallback();
    }
  }, [authDialogCallback]);

  // Expose the callback globally so it can be accessed outside React
  globalOpenAuthDialog = openAuthDialog;

  // Allow external components to set the auth dialog callback
  const setOpenAuthDialog = useCallback((callback: () => void) => {
    setAuthDialogCallback(() => callback);
  }, []);

  // After successful sign-in, set a debug cookie
  const setDebugCookie = (userId: string) => {
    try {
      // Set a simple debug cookie
      document.cookie = `app-user-id=${userId}; path=/; max-age=86400; SameSite=Lax`;
      console.log('Set debug cookie with user ID');
    } catch (e) {
      console.error('Failed to set debug cookie:', e);
    }
  };

  // Function to refresh session
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        
        // Try the fix-session endpoint as a fallback
        try {
          const fixResponse = await fetch('/api/fix-session', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          });
          
          if (fixResponse.ok) {
            // Get the updated session after fixing
            const { data: refreshData } = await supabase.auth.getSession();
            if (refreshData.session) {
              setSession(refreshData.session);
              setUser(refreshData.session.user);
              setDebugCookie(refreshData.session.user.id);
              return true;
            }
          }
          
          // If we got here, session fixing failed
          // Open the auth dialog to prompt the user to sign in
          openAuthDialog();
          return false;
        } catch (e) {
          console.error('Error calling fix-session endpoint:', e);
          // Open the auth dialog to prompt the user to sign in
          openAuthDialog();
          return false;
        }
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setDebugCookie(data.session.user.id);
        return true;
      }
      
      // If no session was returned, prompt the user to sign in
      openAuthDialog();
      return false;
    } catch (error) {
      console.error('Exception refreshing session:', error);
      // Open the auth dialog to prompt the user to sign in
      openAuthDialog();
      return false;
    }
  }, [openAuthDialog]);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
        
        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, newSession) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              setSession(newSession);
              setUser(newSession?.user ?? null);
              router.refresh();
            } else if (event === 'SIGNED_OUT') {
              setSession(null);
              setUser(null);
              router.refresh();
            }
          }
        );
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeAuth();
  }, [router]);

  // Periodic session refresh
  useEffect(() => {
    if (!session) return;
    
    // Refresh token every 10 minutes if session exists
    const refreshInterval = setInterval(refreshSession, 10 * 60 * 1000);
    
    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSession();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, refreshSession]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) throw error;
      
      // Set debug cookie if sign-in was successful
      if (data.user) {
        setDebugCookie(data.user.id);
      }
      
      router.refresh();
    } catch (error) {
      if (error instanceof AuthError) {
        toast.error(error.message || 'Error signing in');
      } else {
        toast.error('An unexpected error occurred');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up function
  const signUp = async (email: string, password: string, name?: string) => {
    try {
      setIsLoading(true);
      
      const { error, data } = await supabase.auth.signUp({ 
        email,
        password,
        options: {
          data: { name: name || email.split('@')[0] }
        }
      });
      
      if (error) throw error;
      
      // Create profile (this is optional and depends on your database schema)
      if (data.user) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: email,
            name: name || email.split('@')[0],
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.error('Error creating profile:', e);
          // Continue anyway as the user is created
        }
      }
      
      toast.success('Account created successfully! Please check your email to confirm your account.');
      router.refresh();
    } catch (error) {
      if (error instanceof AuthError) {
        toast.error(error.message || 'Error signing up');
      } else {
        toast.error('An unexpected error occurred');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Call the API endpoint to ensure cookies are properly cleared
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // Also try to sign out client-side
      await supabase.auth.signOut();
      
      // Ensure state is cleared
      setUser(null);
      setSession(null);
      
      router.push('/');
      router.refresh();
    } catch (error) {
      if (error instanceof AuthError) {
        toast.error(error.message || 'Error signing out');
      } else {
        toast.error('An unexpected error occurred');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        refreshSession,
        openAuthDialog,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
} 