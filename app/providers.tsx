'use client';

import { SupabaseAuthProvider } from '@/context/SupabaseAuthContext';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseAuthProvider>
      {children}
      <Toaster 
        position="bottom-right"
        closeButton
        expand={false}
        style={{
          zIndex: 9999,
        }}
      />
    </SupabaseAuthProvider>
  );
} 