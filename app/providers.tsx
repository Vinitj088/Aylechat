'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AuthDialog } from '@/components/AuthDialog';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    console.error("FATAL: NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google authentication will not work.");
    // Render the app without Google Auth if the ID is missing
    return (
      <AuthProvider>
        <NextThemesProvider 
          attribute="class" 
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
          <AuthDialog />
          <Toaster />
        </NextThemesProvider>
      </AuthProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <NextThemesProvider 
          attribute="class" 
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
          <AuthDialog />
          <Toaster />
        </NextThemesProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}