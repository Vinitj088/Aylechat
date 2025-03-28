'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { signIn as serverSignIn, signUp as serverSignUp, signOut as serverSignOut } from '@/app/auth/actions';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: AuthError | null;
    success: boolean;
  }>;
  signUp: (email: string, password: string, name: string) => Promise<{
    error: AuthError | null;
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

  const refreshSession = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        return false;
      }
      
      setSession(data.session);
      setUser(data.session?.user || null);
      return !!data.session;
    } catch (error) {
      console.error('Unexpected error refreshing session:', error);
      return false;
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      setIsLoading(true);
      
      try {
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
    };

    getInitialSession();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user || null);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);
  
  // Set up periodic health check
  useEffect(() => {
    const refreshInterval = 45 * 60 * 1000; // 45 minutes
    const healthCheckInterval = setInterval(async () => {
      if (user) {
        await refreshSession();
      }
    }, refreshInterval);
    
    return () => {
      clearInterval(healthCheckInterval);
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    try {
      // Create a FormData object to work with server actions
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      
      // Use server action for authentication
      const result = await serverSignIn(formData);
      
      if (result.error) {
        return { error: { message: result.error } as AuthError, success: false };
      }
      
      // Refresh client-side session
      await refreshSession();
      
      setIsAuthDialogOpen(false);
      router.refresh();
      return { error: null, success: true };
    } catch (error) {
      console.error('Unexpected error during sign in:', error);
      return { error: error as AuthError, success: false };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      // Create a FormData object to work with server actions
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      formData.append('name', name);
      
      // Use server action for sign up
      const result = await serverSignUp(formData);
      
      if (result.error) {
        return { error: { message: result.error } as AuthError, success: false };
      }
      
      return { error: null, success: true };
    } catch (error) {
      console.error('Unexpected error during sign up:', error);
      return { error: error as AuthError, success: false };
    }
  };

  const signOut = async () => {
    try {
      // Use server action for sign out
      const result = await serverSignOut();
      
      if (result.error) {
        toast.error('Failed to sign out. Please try again.');
        return;
      }
      
      // Clear client-side state
      setSession(null);
      setUser(null);
      
      // Force a router refresh after sign out to clear authenticated data
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out. Please try again.');
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