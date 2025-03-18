'use client';

import { SessionProvider } from 'next-auth/react';
import { SonnerToaster } from './component/ui/sonner-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <SonnerToaster 
        position="bottom-right"
        closeButton
        richColors={false}
        expand={false}
        style={{
          zIndex: 9999,
        }}
      />
    </SessionProvider>
  );
} 