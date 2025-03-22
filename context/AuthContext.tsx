'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

  // Enhanced refreshSession with fallback behavior
  const refreshSession = useCallback(async (): Promise<boolean> => {
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
          
          // Validate the session against the server
          try {
            const validationResponse = await fetch('/api/auth/status', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            if (validationResponse.ok) {
              const validationData = await validationResponse.json();
              if (validationData.authenticated) {
                console.log('Existing session validated against server');
                return true;
              } else {
                console.log('Server does not recognize current session');
              }
            }
          } catch (e) {
            console.error('Error validating existing session:', e);
          }
          
          // If server validation failed, try localStorage recovery as last resort
          try {
            const storedSessionStr = localStorage.getItem('supabase.auth.token');
            if (storedSessionStr) {
              console.log('Found session data in localStorage, attempting recovery');
              const storedSession = JSON.parse(storedSessionStr);
              if (storedSession?.currentSession?.access_token) {
                // Try to manually set the session using the stored tokens
                const recoveryResult = await supabase.auth.setSession({
                  access_token: storedSession.currentSession.access_token,
                  refresh_token: storedSession.currentSession.refresh_token,
                });
                
                if (recoveryResult.data.session) {
                  console.log('Session recovered from localStorage');
                  setSession(recoveryResult.data.session);
                  setUser(recoveryResult.data.session.user);
                  return true;
                }
              }
            }
          } catch (storageError) {
            console.error('Error recovering from localStorage:', storageError);
          }
          
          return true; // Still return true to try using the existing session
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
  }, [supabase]);

  // Function to validate client session state against server
  const validateClientSession = useCallback(async (): Promise<boolean> => {
    try {
      // Check for a persistent cookie
      const match = document.cookie.match(/(^|;)\s*sb-session=([^;]+)/);
      const hasPersistentCookie = !!match;
      
      // Get session from auth API
      const response = await fetch('/api/auth/status', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error('Auth validation API failed:', response.status);
        return false;
      }
      
      const data = await response.json();
      
      // If we have a valid session according to the server
      if (data.authenticated && data.user) {
        // But our client state doesn't match
        if (!user || user.id !== data.user.id) {
          console.log('Client session desync detected - fixing');
          // Force a session refresh to sync client state with server
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setSession(session);
            setUser(session.user);
          } else {
            // If getSession fails but server says we're authenticated,
            // try a more aggressive refresh
            try {
              await supabase.auth.refreshSession();
              const { data: { session: refreshedSession } } = await supabase.auth.getSession();
              if (refreshedSession) {
                setSession(refreshedSession);
                setUser(refreshedSession.user);
              }
            } catch (e) {
              console.error('Failed to fix client session:', e);
              return false;
            }
          }
        }
        return true;
      } else if (!data.authenticated && user) {
        // If server says we're not authenticated but client thinks we are
        console.log('Client thinks authenticated but server disagrees - fixing');
        setSession(null);
        setUser(null);
        return false;
      }
      
      return data.authenticated;
    } catch (error) {
      console.error('Error validating client session:', error);
      return false;
    }
  }, [user, supabase]);

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
        
        if (session) {
          // If we have a session, ensure it's valid by making a validation request
          console.log('Found session on page load, validating...');
          
          // Set the session immediately to avoid flash of logged-out state
          setSession(session);
          setUser(session.user);
          
          // Then validate against server to ensure consistency
          const isValid = await validateClientSession();
          
          if (!isValid) {
            console.warn('Session validation failed, attempting recovery...');
            // Try one more time with refresh
            await refreshSession();
          }
        } else {
          console.log('No session found on page load');
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Unexpected error during getSession:', error);
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    getInitialSession();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('Auth state changed:', !!session);
        setSession(session);
        setUser(session?.user || null);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Set up visibility change listener in a separate effect
  useEffect(() => {
    // Revalidate on tab focus/visibility change
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && user) {
        console.log('Page became visible, checking session validity');
        await validateClientSession();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, validateClientSession]);
  
  // Set up periodic health check in a separate effect
  useEffect(() => {
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
      clearInterval(healthCheckInterval);
    };
  }, [user, refreshSession]);

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