import './globals.css';
import 'katex/dist/katex.min.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from './providers';
import Script from 'next/script';
import { Geist, Space_Grotesk } from 'next/font/google';
import { Sentient, MagnetBold, gebukRegular, ppeditorial } from './fonts';
import BorderRadiusInitializer from './component/BorderRadiusInitializer';
import { SidebarPinProvider } from '../context/SidebarPinContext';
import FontInitializer from './component/FontInitializer';

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

export const metadata = {
  title: 'Ayle Chat',
  description: 'Chat with AI using Exa for web search and real-time information',
};

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
            <div className="w-full overflow-x-hidden">
              {children}
            </div>
          </SidebarPinProvider>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}