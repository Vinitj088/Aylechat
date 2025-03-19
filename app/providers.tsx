'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AuthDialog />
      <Toaster />
    </AuthProvider>
  );
}

export { SessionFixer } from '@/components/SessionFixer'; 