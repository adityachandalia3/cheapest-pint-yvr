import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Pint Map YVR — Cheapest Beer in Vancouver',
  description:
    'Find the cheapest pint of beer in Vancouver, BC. Real-time prices from bars and pubs across the city.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-[#1a1a2e]`}>{children}</body>
    </html>
  );
}
