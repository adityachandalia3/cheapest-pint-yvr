import { createClient } from '@supabase/supabase-js';
import CrawlBuilderClient from '@/components/CrawlBuilderClient';

export const dynamic = 'force-dynamic';

export interface BarOption {
  id: string;
  name: string;
  neighbourhood: string | null;
  latitude: number | null;
  longitude: number | null;
}

export default async function CrawlBuilderPage() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );

  const { data } = await supabase
    .from('bars')
    .select('id, name, neighbourhood, latitude, longitude')
    .eq('is_permanently_closed', false)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  const bars: BarOption[] = (data ?? []) as BarOption[];

  // Neighbourhoods with >3 bars for Option B dropdown
  const counts: Record<string, number> = {};
  for (const b of bars) {
    if (b.neighbourhood) counts[b.neighbourhood] = (counts[b.neighbourhood] ?? 0) + 1;
  }
  const neighbourhoods = Object.entries(counts)
    .filter(([, count]) => count > 3)
    .map(([name]) => name)
    .sort();

  return <CrawlBuilderClient bars={bars} neighbourhoods={neighbourhoods} />;
}
