'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AuthDialog } from '@/components/AuthDialog';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: Error | null;
    success: boolean;
  }>;
  signUp: (email: string, password: string, name: string) => Promise<{
    error: Error | null;
    success: boolean;
  }>;
  signOut: () => Promise<void>;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
  isAuthDialogOpen: boolean;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Get session on initial load
    async function getInitialSession() {
      setIsLoading(true);
      
      try {
        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        }
        
        setSession(session);
        setUser(session?.user || null);
      } catch (error) {
        console.error('Unexpected error during getSession:', error);
      } finally {
        setIsLoading(false);
      }
    }

    getInitialSession();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user || null);
        setIsLoading(false);
      }
    );

    // Set up periodic session health check
    // This helps prevent auth errors by proactively refreshing the session
    const healthCheckInterval = setInterval(async () => {
      // Only run health check if we think we're logged in
      if (user) {
        const stillValid = await refreshSession();
        
        // If session refresh failed and we thought we were logged in, 
        // update our state to reflect we're logged out
        if (!stillValid) {
          setUser(null);
          setSession(null);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(healthCheckInterval);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        return { error, success: false };
      }
      
      // Close the auth dialog on successful sign in
      setIsAuthDialogOpen(false);
      return { error: null, success: true };
    } catch (error) {
      console.error('Unexpected error during sign in:', error);
      return { error: error as Error, success: false };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          }
        }
      });
      
      if (error) {
        return { error, success: false };
      }
      
      return { error: null, success: true };
    } catch (error) {
      console.error('Unexpected error during sign up:', error);
      return { error: error as Error, success: false };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      // First try normal refresh
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        
        // If refresh failed, try getting current session
        const { data: currentSession } = await supabase.auth.getSession();
        
        if (currentSession.session) {
          // If we have a session, update our state with it
          setSession(currentSession.session);
          setUser(currentSession.session.user);
          console.log('Used existing session instead of refresh');
          return true;
        }
        
        return false;
      }
      
      // Update the session and user state
      setSession(data.session);
      setUser(data.session?.user || null);
      console.log('Session refreshed successfully');
      return true;
    } catch (error) {
      console.error('Unexpected error refreshing session:', error);
      return false;
    }
  };

  const openAuthDialog = () => {
    setIsAuthDialogOpen(true);
  };

  const closeAuthDialog = () => {
    setIsAuthDialogOpen(false);
  };

  const value = {
    session,
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
    openAuthDialog,
    closeAuthDialog,
    isAuthDialogOpen,
    refreshSession
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
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 