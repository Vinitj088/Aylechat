"use client"
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { clientAuth } from '@/lib/client-auth';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastCheckRef = useRef<number>(0);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check auth status on mount and when window regains focus
  useEffect(() => {
    const checkAuthStatus = async () => {
      // Debounce checks - don't check more than once every 3 seconds
      const now = Date.now();
      if (now - lastCheckRef.current < 3000) {
        return;
      }
      
      lastCheckRef.current = now;
      
      try {
        // First check if we have a user in localStorage
        const storedUser = clientAuth.getUser();
        if (storedUser && clientAuth.isAuthenticated()) {
          setUser(storedUser);
          setIsLoading(false);
          return;
        }

        // If not, check with the server
        const response = await fetch('/api/auth', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            setUser(null);
            clientAuth.clearUser();
            return;
          }
          throw new Error(`Auth check failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.user) {
          const userData = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name
          };
          setUser(userData);
          clientAuth.storeUser(userData);
        } else {
          setUser(null);
          clientAuth.clearUser();
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setError('Failed to check authentication status');
        // Don't clear user here - might be a temporary network issue
      } finally {
        setIsLoading(false);
      }
    };

    // Initial auth check
    checkAuthStatus();

    // Check auth status when window regains focus, but debounced
    const handleFocus = () => {
      // Clear any pending timeout
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
      
      // Set a new timeout to prevent rapid rechecking
      checkTimeoutRef.current = setTimeout(() => {
        if (!isLoading) {
          checkAuthStatus();
        }
      }, 500);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [isLoading]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'login', email, password }),
        credentials: 'include' // Important for cookies
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      if (data.success && data.user) {
        const userData = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name
        };
        setUser(userData);
        clientAuth.storeUser(userData);
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
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
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'signup', email, password, name }),
        credentials: 'include' // Important for cookies
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }
      
      if (data.success && data.user) {
        const userData = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name
        };
        setUser(userData);
        clientAuth.storeUser(userData);
      } else {
        throw new Error('Signup failed');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError(error instanceof Error ? error.message : 'Signup failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'logout' }),
        credentials: 'include' // Important for cookies
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUser(null);
        clientAuth.clearUser();
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      setError(error instanceof Error ? error.message : 'Logout failed');
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
    logout
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