'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
 import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { AuthDialog } from '@/components/AuthDialog';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
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