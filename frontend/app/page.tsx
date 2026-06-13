import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import PintMapClient from '@/components/PintMapClient';
import CommunityPopup from '@/components/CommunityPopup';
import JsonLd from '@/components/JsonLd';
import WcPromoBanner from '@/components/WcPromoBanner';
import { Bar } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Brewscanner — Find the Cheapest Pint in Vancouver Right Now',
  description: 'Real-time beer prices across 100+ Vancouver bars. Find the cheapest pint near you, discover happy hour deals, and build the perfect pub crawl. Free.',
  openGraph: {
    title: 'Brewscanner — Find the Cheapest Pint in Vancouver Right Now',
    description: 'Real-time beer prices across 100+ Vancouver bars. Find the cheapest pint near you, discover happy hour deals, and build the perfect pub crawl.',
    url: 'https://www.getbrewscanner.com',
  },
};

export default async function Home() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );

  const { data, error } = await supabase
    .from('bars')
    .select(
      `id, google_place_id, name, address, latitude, longitude,
       neighbourhood, is_permanently_closed,
       pint_prices (
         id, bar_id, category, beer_name, price_cad,
         happy_hour_price_cad, pour_size_oz
       ),
       happy_hour_windows (
         id, bar_id, days, start_time, end_time, notes
       )`
    )
    .eq('is_permanently_closed', false)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) {
    console.error('Supabase error:', error.message);
  }

  return (
    <>
      <h1 className="sr-only">Find the Cheapest Pint in Vancouver</h1>
      <WcPromoBanner />
      <PintMapClient initialBars={(data ?? []) as Bar[]} />
      <CommunityPopup />
      <JsonLd />
    </>
  );
}
