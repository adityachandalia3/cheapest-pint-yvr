'use client';

import { MyNightProvider } from '@/lib/myNightContext';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <MyNightProvider>{children}</MyNightProvider>;
}
