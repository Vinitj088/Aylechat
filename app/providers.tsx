'use client';

import { SupabaseAuthProvider } from '@/context/SupabaseAuthContext';
import { SonnerToaster } from './component/ui/sonner-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseAuthProvider>
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
    </SupabaseAuthProvider>
  );
} 