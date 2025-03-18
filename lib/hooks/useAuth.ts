import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import { useState } from "react";

/**
 * Primary authentication hook for client components
 * 
 * This hook extends NextAuth's functionality by providing:
 * 1. Better error handling and loading states
 * 2. Sign-up functionality with our custom API
 * 3. Enhanced sign-out with proper cleanup
 * 4. Session management and persistence
 * 
 * Use this hook in all components that need authentication instead
 * of directly using NextAuth functions.
 */

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

  /**
   * Sign in a user with credentials
   * Uses NextAuth's signIn function with our credentials provider
   */
  const handleSignIn = async ({ email, password, redirect = false, callbackUrl = "/" }: SignInParams) => {
    try {
      // Prevent duplicate sign-in attempts
      if (loading) return null;
      
      setLoading(true);
      setError(null);
      
      // Clear any existing session data first to prevent conflicts
      localStorage.removeItem('userSession');
      sessionStorage.removeItem('authState');
      
      const result = await nextAuthSignIn("credentials", {
        email,
        password,
        redirect,
        callbackUrl,
      });
      
      if (result?.error) {
        setError("Invalid email or password");
        return null;
      }
      
      // Force session update
      await update();
      
      // Store a flag to indicate successful login
      localStorage.setItem('userSession', 'active');
      
      return session?.user;
    } catch (err) {
      setError("An error occurred during sign in");
      console.error("Sign in error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign up a new user
   * Creates a user in our database via API, then signs them in
   */
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

  /**
   * Sign out a user
   * Uses a direct approach to clear all auth state
   */
  const handleSignOut = async (): Promise<boolean> => {
    if (loading) return false;
    
    try {
      setLoading(true);
      
      console.log("Redirecting to force-logout endpoint");
      // Redirect to our force-logout endpoint which handles everything
      window.location.href = `/api/auth/force-logout?t=${Date.now()}&r=${Math.random().toString(36).substring(7)}`;
      
      // This line won't actually execute due to the redirection
      return true;
    } catch (error) {
      console.error("Error during sign out:", error);
      setLoading(false);
      
      // If something goes wrong, still try to get to auth page
      window.location.href = `/auth?error=signout&t=${Date.now()}`;
      return false;
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