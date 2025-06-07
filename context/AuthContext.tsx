'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { signIn as serverSignIn, signUp as serverSignUp, signOut as serverSignOut, resetPassword as serverResetPassword, updatePassword as serverUpdatePassword } from '@/app/auth/actions';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAnonymous: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: AuthError | null;
    success: boolean;
  }>;
  signUp: (email: string, password: string, name: string) => Promise<{
    error: AuthError | null;
    success: boolean;
  }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string, redirectTo?: string) => Promise<{
    error: AuthError | null;
    success: boolean;
  }>;
  updatePassword: (password: string) => Promise<{
    error: AuthError | null;
    success: boolean;
  }>;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
  isAuthDialogOpen: boolean;
  refreshSession: () => Promise<boolean>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Helper to extract is_anonymous from user or session
  const getIsAnonymous = (user: User | null, session: Session | null): boolean => {
    if (user && typeof user.is_anonymous === 'boolean') {
      return user.is_anonymous;
    }
    // Fallback: try to decode JWT if available
    if (session && session.access_token) {
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        if (typeof payload.is_anonymous === 'boolean') {
          return payload.is_anonymous;
        }
      } catch (e) {
        // Ignore decoding errors
      }
    }
    return false;
  };

  const isAnonymous = getIsAnonymous(user, session);

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
      
      // Force a router refresh after sign out
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

  const resetPassword = async (email: string, redirectTo?: string) => {
    try {
      const formData = new FormData();
      formData.append('email', email);
      
      // Use current site URL if not provided
      const defaultRedirectUrl = window.location.origin + '/auth/update-password';
      const finalRedirectTo = redirectTo || defaultRedirectUrl;
      
      formData.append('redirectTo', finalRedirectTo);
      
      const result = await serverResetPassword(formData);
      
      if (result.error) {
        return { error: { message: result.error } as AuthError, success: false };
      }
      
      return { error: null, success: true };
    } catch (error) {
      console.error('Unexpected error during password reset:', error);
      return { error: error as AuthError, success: false };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const formData = new FormData();
      formData.append('password', password);
      
      const result = await serverUpdatePassword(formData);
      
      if (result.error) {
        return { error: { message: result.error } as AuthError, success: false };
      }
      
      // Refresh session after password update
      await refreshSession();
      
      return { error: null, success: true };
    } catch (error) {
      console.error('Unexpected error during password update:', error);
      return { error: error as AuthError, success: false };
    }
  };

  // Add Google Sign-In function
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Optional: Specify where to redirect after successful sign-in
          // redirectTo: `${window.location.origin}/auth/callback`,
          // Optional: Add scopes if needed
          // scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        },
      });
      
      if (error) {
        console.error('Google Sign-In Error:', error);
        toast.error(error.message || 'Failed to sign in with Google.');
        return { error };
      }
      
      // No need to return success here, the redirect handles it.
      // The onAuthStateChange listener will pick up the session.
      return { error: null };
    } catch (error) {
      console.error('Unexpected error during Google sign in:', error);
      toast.error('An unexpected error occurred during Google sign-in.');
      return { error: error as AuthError };
    }
  };

  const value = {
    session,
    user,
    isLoading,
    isAnonymous,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    openAuthDialog,
    closeAuthDialog,
    isAuthDialogOpen,
    refreshSession,
    signInWithGoogle,
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