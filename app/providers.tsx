'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThreadCacheProvider } from '@/context/ThreadCacheContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthDialog } from '@/components/AuthDialog';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThreadCacheProvider>
        <ThemeProvider>
          {children}
          <AuthDialog />
          <Toaster />
        </ThemeProvider>
      </ThreadCacheProvider>
    </AuthProvider>
  );
}