import './globals.css';
import 'katex/dist/katex.min.css';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';
import Script from 'next/script';

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
    <html lang="en" suppressHydrationWarning>
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
        <Script id="theme-switcher" strategy="beforeInteractive">
          {`
            (function() {
              try {
                const savedTheme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                
                if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {
                // Fail gracefully if localStorage is not available
              }
            })();
          `}
        </Script>
      </head>
      <body>
        <Providers>
          <div className="w-full overflow-x-hidden">
            {children}
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}