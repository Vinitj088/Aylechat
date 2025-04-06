import './globals.css';
import 'katex/dist/katex.min.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from './providers';
import Script from 'next/script';
import { Instrument_Sans, Space_Grotesk } from 'next/font/google';

// Configure fonts
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument-sans',
  weight: ['400', '500', '600', '700'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata = {
  title: 'ExaChat',
  description: 'Chat with AI using Exa for web search and real-time information',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
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
      </head>
      <body className={instrumentSans.className}>
        <Providers>
          <div className="w-full overflow-x-hidden">
            {children}
          </div>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}