import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import AppProviders from '@/components/AppProviders';
import InstallBanner from '@/components/InstallBanner';
import PwaTracker from '@/components/PwaTracker';
import { Analytics } from '@vercel/analytics/next';
import { PostHogProvider } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport: Viewport = {
  themeColor: '#B34207',
};

export const metadata: Metadata = {
  title: 'Brewscanner — Find the Cheapest Pint in Vancouver',
  description:
    'Brewscanner — Find the Cheapest Pint in Vancouver. Real beer prices across 100+ bars.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Brewscanner',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png' }],
  },
  openGraph: {
    title: 'Brewscanner — Find the Cheapest Pint in Vancouver',
    description: 'Brewscanner — Find the Cheapest Pint in Vancouver. Real beer prices across 100+ bars.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
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
        <InstallBanner />
        <PwaTracker />
      </body>
    </html>
  );
}
