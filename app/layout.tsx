'use client';

import './globals.css';
import 'katex/dist/katex.min.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from './providers';
import Script from 'next/script';
import { Geist, Space_Grotesk } from 'next/font/google';
import { Sentient, MagnetBold, gebukRegular, ppeditorial } from './fonts';
import BorderRadiusInitializer from './component/BorderRadiusInitializer';
import { SidebarPinProvider, useSidebarPin } from '../context/SidebarPinContext';
import FontInitializer from './component/FontInitializer';
import Sidebar from './component/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const GeistSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

const metadata = {
  title: 'Ayle Chat',
  description: 'Chat with AI using Exa for web search and real-time information',
};

function AppLayout({ children }: { children: React.ReactNode }) {
  const { pinned, setPinned } = useSidebarPin();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { openAuthDialog } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1300 && pinned) setPinned(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pinned, setPinned]);

  return (
    <div className="min-h-screen w-full">
      <Sidebar
        isOpen={pinned || isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSignInClick={openAuthDialog}
        refreshTrigger={refreshTrigger}
        pinned={pinned}
        setPinned={setPinned}
      />
      <main className={cn(
        "flex flex-col flex-1 min-h-screen main-content",
        pinned ? "ayle-main-pinned" : ""
      )}>
        {children}
      </main>
    </div>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${spaceGrotesk.variable} ${Sentient.variable} ${MagnetBold.variable} ${gebukRegular.variable} ${ppeditorial.variable}`} suppressHydrationWarning>
      <head>
        <Script id="sw-register" strategy="beforeInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                  console.log('SW registered:', registration);
                }).catch(error => {
                  console.log('SW registration failed:', error);
                });
              });
            }
          `}
        </Script>
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className={GeistSans.className}>
        <Providers>
          <SidebarPinProvider>
            <BorderRadiusInitializer />
            <FontInitializer />
            <AppLayout>
              {children}
            </AppLayout>
          </SidebarPinProvider>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}