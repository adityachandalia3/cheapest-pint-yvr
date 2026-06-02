import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SiteNav from '@/components/SiteNav';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Pint Map YVR — Cheapest Beer in Vancouver',
  description:
    'Find the cheapest pint of beer in Vancouver, BC. Real-time prices from bars and pubs across the city.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-[#fef9f0]`}>
        <SiteNav />
        {/* pb accounts for the fixed mobile bottom tab bar */}
        <div className="pb-[72px] md:pb-0">{children}</div>
      </body>
    </html>
  );
}
