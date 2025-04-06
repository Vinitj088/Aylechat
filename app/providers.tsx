'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThreadCacheProvider } from '@/context/ThreadCacheContext';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AuthDialog } from '@/components/AuthDialog';
import { Toaster } from '@/components/ui/sonner';
import { SpeedInsights } from "@vercel/speed-insights/next";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThreadCacheProvider>
        <NextThemesProvider 
          attribute="class" 
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
          <AuthDialog />
          <Toaster />
          <SpeedInsights />
        </NextThemesProvider>
      </ThreadCacheProvider>
    </AuthProvider>
  );
}