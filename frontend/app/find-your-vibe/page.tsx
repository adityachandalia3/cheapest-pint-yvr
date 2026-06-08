import type { Metadata } from 'next';
import FindYourVibeClient from './FindYourVibeClient';

export const metadata: Metadata = {
  title: 'Find Your Vibe — Brewscanner',
  description: 'Describe your night and we\'ll match you with the perfect Vancouver bar. Beers, cocktails, budget, neighbourhood — all in a quick chat.',
};

export default function FindYourVibePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  return <FindYourVibeClient initialQuery={searchParams.q ?? ''} />;
}
