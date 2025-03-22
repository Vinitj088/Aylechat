'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThreadCacheProvider } from '@/context/ThreadCacheContext';
import { AuthDialog } from '@/components/AuthDialog';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThreadCacheProvider>
        {children}
        <AuthDialog />
        <Toaster />
      </ThreadCacheProvider>
    </AuthProvider>
  );
}

export { SessionFixer } from '@/components/SessionFixer'; 