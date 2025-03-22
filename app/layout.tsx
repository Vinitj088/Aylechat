import { Inter } from 'next/font/google';
import './globals.css';
import 'katex/dist/katex.min.css';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';

// Load the ABCDiatype font (Regular and Bold only)
const inter = Inter({ subsets: ['latin'] });

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
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="w-screen overflow-x-hidden">
            {children}
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}