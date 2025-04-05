'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThreadCacheProvider } from '@/context/ThreadCacheContext';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AuthDialog } from '@/components/AuthDialog';
import { Toaster } from '@/components/ui/sonner';
import { PostHogProvider } from './posthog/provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider>
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
          </NextThemesProvider>
        </ThreadCacheProvider>
      </AuthProvider>
    </PostHogProvider>
  );
}