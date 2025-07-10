'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { User, tx, id } from '@instantdb/react';
import { db } from '@/lib/db';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  sendMagicCode: (email: string) => Promise<void>;
  signInWithMagicCode: (email: string, code: string) => Promise<void>;
  signInWithIdToken: (params: {
    clientName: string;
    idToken: string;
    nonce: string;
  }) => Promise<void>;
  updateUserProfile: (profile: { firstName: string }) => Promise<void>;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
  isAuthDialogOpen: boolean;
  ensureUserProfile: (firstName?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, error } = db.useAuth();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const profileOperationInProgress = useRef(new Set<string>());

  if (error) {
    console.error("Auth Error:", error);
    toast.error("Authentication error", { description: error.message });
  }

  // Centralized profile creation/update function
  const ensureUserProfile = useCallback(async (firstName?: string) => {
    if (!user || profileOperationInProgress.current.has(user.id)) {
      return;
    }

    try {
      // Mark as in progress to prevent concurrent attempts
      profileOperationInProgress.current.add(user.id);
      
      console.log("Ensuring profile for user:", user.id, "with firstName:", firstName);
      
      // Small delay to reduce race conditions
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Always query for existing profile first
      const { data } = await db.queryOnce({
        profiles: { $: { where: { userId: user.id } } }
      });
      
      if (data?.profiles?.length) {
        // Profile exists - update if firstName is provided
        const existingProfile = data.profiles[0];
        console.log("Found existing profile:", existingProfile.id);
        
        if (firstName && existingProfile.firstName !== firstName) {
          console.log("Updating existing profile firstName to:", firstName);
          await db.transact(
            tx.profiles[existingProfile.id].update({
              firstName: firstName
            })
          );
          console.log("Profile updated successfully");
        }
      } else {
        // No profile exists - create one
        console.log("No profile found, creating new profile");
        
        const defaultFirstName = firstName || user.email?.split('@')[0] || 'User';
        const profileId = id();
        
        await db.transact([
          tx.profiles[profileId].update({
            userId: user.id,
            firstName: defaultFirstName
          }),
          tx.profiles[profileId].link({ user: user.id })
        ]);
        
        console.log("Profile created successfully with firstName:", defaultFirstName);
      }
    } catch (err: any) {
      console.error("Failed to ensure profile:", err);
      
      // Check if it's a unique constraint error (profile already exists)
      if (
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof err.message === "string" &&
        (err.message.includes('unique attribute') || 
         err.message.includes('userId'))
      ) {
        console.log("Profile already exists (unique constraint), trying to update instead");
        
        // Query again to get the existing profile
        try {
          const { data } = await db.queryOnce({
            profiles: { $: { where: { userId: user.id } } }
          });
          
          if (data?.profiles?.length && firstName) {
            const existingProfile = data.profiles[0];
            await db.transact(
              tx.profiles[existingProfile.id].update({
                firstName: firstName
              })
            );
            console.log("Profile updated successfully after unique constraint error");
          }
        } catch (retryErr) {
          console.error("Failed to update profile after unique constraint error:", retryErr);
          throw retryErr;
        }
      } else {
        throw err;
      }
    } finally {
      // Always remove from in-progress set
      profileOperationInProgress.current.delete(user.id);
    }
  }, [user]);

  // Auto-create profile when user signs in (with default firstName)
  useEffect(() => {
    if (user && !profileOperationInProgress.current.has(user.id)) {
      // Add a small delay before running to let the auth state settle
      const timer = setTimeout(() => {
        ensureUserProfile();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [user?.id, ensureUserProfile]);

  const sendMagicCode = useCallback(async (email: string) => {
    await db.auth.sendMagicCode({ email });
  }, []);

  const signInWithMagicCode = useCallback(async (email: string, code: string) => {
    await db.auth.signInWithMagicCode({ email, code });
  }, []);

  const signInWithIdToken = useCallback(
    async (params: { clientName: string; idToken: string; nonce: string }) => {
      await db.auth.signInWithIdToken(params);
    },
    []
  );

  const updateUserProfile = useCallback(async (profile: { firstName: string }) => {
    if (!user) {
      toast.error("Not signed in", { description: "You must be signed in to update your profile." });
      return;
    }
    
    try {
      await ensureUserProfile(profile.firstName);
      toast.success("Profile updated!");
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      
      // Better error message formatting
      let errorMessage = "An error occurred while updating your profile";
      if (err && typeof err === "object") {
        if (err.message && typeof err.message === "string") {
          errorMessage = err.message;
        } else if (err.toString && typeof err.toString === "function") {
          errorMessage = err.toString();
        }
      } else if (typeof err === "string") {
        errorMessage = err;
      }
      
      toast.error("Profile update failed", { 
        description: errorMessage
      });
      throw err;
    }
  }, [user, ensureUserProfile]);

  const signOut = useCallback(async () => {
    // Clear the profile operation tracking when signing out
    if (user) {
      profileOperationInProgress.current.delete(user.id);
    }
    
    await db.auth.signOut();
    toast.success("Signed out successfully");
  }, [user]);

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(false);
  }, []);

  const value = {
    user: user ?? null,
    isLoading,
    signOut,
    sendMagicCode,
    signInWithMagicCode,
    signInWithIdToken,
    updateUserProfile,
    openAuthDialog,
    closeAuthDialog,
    isAuthDialogOpen,
    ensureUserProfile,
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