'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { User } from '@instantdb/react';
import { db } from '@/lib/db';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  sendMagicCode: (email: string) => Promise<void>;
  signInWithMagicCode: (email: string, code: string) => Promise<void>;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
  isAuthDialogOpen: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, error } = db.useAuth();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

  if (error) {
    console.error("Auth Error:", error);
    toast.error("Authentication error", { description: error.message });
  }

  const sendMagicCode = useCallback(async (email: string) => {
    await db.auth.sendMagicCode({ email });
  }, []);

  const signInWithMagicCode = useCallback(async (email: string, code: string) => {
    await db.auth.signInWithMagicCode({ email, code });
  }, []);

  const signOut = useCallback(async () => {
    await db.auth.signOut();
    toast.success("Signed out successfully");
  }, []);

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(false);
  }, []);

  const value = {
    user,
    isLoading,
    signOut,
    sendMagicCode,
    signInWithMagicCode,
    openAuthDialog,
    closeAuthDialog,
    isAuthDialogOpen,
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