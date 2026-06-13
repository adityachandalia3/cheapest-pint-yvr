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
  title: {
    default: 'Brewscanner — Find the Cheapest Pint in Vancouver',
    template: '%s | Brewscanner',
  },
  description:
    'Real-time beer prices across 100+ Vancouver bars. Find the cheapest pint near you, discover happy hour deals, and build the perfect pub crawl. Free.',
  metadataBase: new URL('https://www.getbrewscanner.com'),
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
    siteName: 'Brewscanner',
    type: 'website',
    locale: 'en_CA',
    url: 'https://www.getbrewscanner.com',
    title: 'Brewscanner — Find the Cheapest Pint in Vancouver',
    description: 'Real-time beer prices across 100+ Vancouver bars. Find the cheapest pint near you, discover happy hour deals, and build the perfect pub crawl.',
    images: [{ url: '/logo.png', width: 1080, height: 1080, alt: 'Brewscanner' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brewscanner — Find the Cheapest Pint in Vancouver',
    description: 'Real-time beer prices across 100+ Vancouver bars. Find the cheapest pint near you.',
    images: ['/logo.png'],
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
          <div>
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
