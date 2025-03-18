import { AUTH_CONFIG } from './constants';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface Session {
  user: User | null;
  expires: string;
}

// Simple client-side auth service that follows BetterAuth patterns
export const authClient = {
  // Session management
  async getSession(): Promise<Session | null> {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (!data.user) return null;
      
      return data;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },
  
  // Auth methods
  async signIn(email: string, password: string): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Sign in failed');
      }
      
      const data = await response.json();
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      }
      
      return null;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  },
  
  async signUp(email: string, password: string, name: string): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Sign up failed');
      }
      
      const data = await response.json();
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      }
      
      return null;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  },
  
  async signOut(): Promise<void> {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      localStorage.removeItem('user');
    }
  },
  
  // Utility functions
  getStoredUser(): User | null {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      return null;
    }
  },
  
  hasSessionCookie(): boolean {
    return !!document.cookie
      .split('; ')
      .find(row => row.startsWith(`${AUTH_CONFIG.COOKIE_NAME}=`));
  }
}; 