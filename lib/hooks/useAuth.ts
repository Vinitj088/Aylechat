import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

// NOTE: This is the primary authentication hook used by client components.
// It integrates with NextAuth while providing additional functionality.
// This hook is used throughout the application for auth state management.

type SignInParams = {
  email: string;
  password: string;
  redirect?: boolean;
  callbackUrl?: string;
};

type SignUpParams = {
  email: string;
  password: string;
  name: string;
};

export function useAuth() {
  const { data: session, status, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async ({ email, password, redirect = false, callbackUrl = "/" }: SignInParams) => {
    try {
      // Prevent duplicate sign-in attempts
      if (loading) return null;
      
      setLoading(true);
      setError(null);
      
      // Clear any existing session data first to prevent conflicts
      localStorage.removeItem('userSession');
      sessionStorage.removeItem('authState');
      
      const result = await signIn("credentials", {
        email,
        password,
        redirect,
        callbackUrl,
      });
      
      if (result?.error) {
        setError("Invalid email or password");
        return null;
      }
      
      // Force multiple updates to ensure state is current
      await update();
      
      // Store a flag to indicate successful login
      localStorage.setItem('userSession', 'active');
      
      // Add a small delay to allow session update to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force another update after the delay
      await update();
      
      return session?.user;
    } catch (err) {
      setError("An error occurred during sign in");
      console.error("Sign in error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async ({ email, password, name }: SignUpParams) => {
    try {
      setLoading(true);
      setError(null);
      
      // Make a request to our signup API
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message || "Failed to create account");
        return null;
      }
      
      // Auto sign in after signup
      return await handleSignIn({ email, password });
    } catch (err) {
      setError("An error occurred during sign up");
      console.error("Sign up error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Prevent duplicate sign-out attempts
      if (loading) return false;
      
      setLoading(true);
      console.log('useAuth: Starting signout process...');
      
      // Mark as logging out for immediate UI feedback
      localStorage.removeItem('userSession');
      sessionStorage.removeItem('authState');
      
      // More aggressive cookie clearing - ALL cookies, not just auth related
      // This ensures complete state reset while preserving Redis data server-side
      console.log('useAuth: Clearing all cookies...');
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name) {
          console.log(`useAuth: Clearing cookie: ${name}`);
          // Clear with different paths to ensure complete removal
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/auth;`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/api;`;
        }
      });
      
      // Call force-logout API first to ensure server-side session clearing
      console.log('useAuth: Calling force-logout API...');
      await fetch('/api/auth/force-logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      // Call NextAuth signOut with specific options
      console.log('useAuth: Calling NextAuth signOut...');
      await signOut({ 
        redirect: false,
        callbackUrl: '/'
      });
      
      // Force session update
      console.log('useAuth: Forcing session update...');
      await update();
      
      // Add a longer delay to ensure everything is synced
      console.log('useAuth: Adding delay before returning...');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      return true;
    } catch (err) {
      console.error("Sign out error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    user: session?.user,
    isAuthenticated: !!session?.user,
    isLoading: status === "loading" || loading,
    error,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
  };
} 