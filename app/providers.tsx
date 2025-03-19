'use client';

import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster 
        position="bottom-right"
        closeButton
        expand={false}
        style={{
          zIndex: 9999,
        }}
      />
    </AuthProvider>
  );
}

export { SessionFixer } from '@/components/SessionFixer'; 