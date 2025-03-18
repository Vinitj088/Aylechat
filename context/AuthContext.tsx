"use client"
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authClient } from '@/lib/auth-client';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Function to refresh the session
  const refreshSession = async (): Promise<void> => {
    try {
      const session = await authClient.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        // Clear user if server session is invalid
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      // Clear user on error to force re-authentication
      setUser(null);
    }
  };

  // Initialize auth state once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initAuth = async () => {
      try {
        setIsLoading(true);
        
        // First check localStorage for faster loading
        const storedUser = authClient.getStoredUser();
        if (storedUser && authClient.hasSessionCookie()) {
          setUser(storedUser);
        }
        
        // Then validate with server
        await refreshSession();
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Set up periodic session refresh
  useEffect(() => {
    if (!user) return;
    
    // Refresh session every 15 minutes
    const refreshInterval = setInterval(refreshSession, 15 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, [user]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const user = await authClient.signIn(email, password);
      setUser(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const user = await authClient.signUp(email, password, name);
      setUser(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Signup failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    
    try {
      // Clear user state immediately for UI feedback
      setUser(null);
      // Then sign out on the server
      await authClient.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    signup,
    logout,
    refreshSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 