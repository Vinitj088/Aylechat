import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

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
      
      // Mark as logging out for immediate UI feedback
      localStorage.removeItem('userSession');
      sessionStorage.removeItem('authState');
      
      // Manual cookie clearing for auth-related cookies only
      // This approach preserves Redis data while clearing auth state
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name && (name.includes('next-auth') || name.includes('session'))) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });
      
      // Call NextAuth signOut with no redirect
      await signOut({ 
        redirect: false,
        callbackUrl: window.location.origin 
      });
      
      // Force session update
      await update();
      
      // Add a small delay to ensure everything is synced
      await new Promise(resolve => setTimeout(resolve, 100));
      
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