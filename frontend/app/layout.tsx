import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import AppProviders from '@/components/AppProviders';
import { Analytics } from '@vercel/analytics/next';
import { PostHogProvider } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Brewscanner — Find the Cheapest Pint in Vancouver',
  description:
    'Brewscanner — Find the Cheapest Pint in Vancouver. Real beer prices across 100+ bars.',
  openGraph: {
    title: 'Brewscanner — Find the Cheapest Pint in Vancouver',
    description: 'Brewscanner — Find the Cheapest Pint in Vancouver. Real beer prices across 100+ bars.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-[#fef9f0]`}>
        <PostHogProvider>
        <AppProviders>
          <SiteNav />
          {/* pb accounts for the fixed mobile bottom tab bar */}
          <div className="pb-[72px] md:pb-0">
            {children}
            <SiteFooter />
          </div>
        </AppProviders>
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
