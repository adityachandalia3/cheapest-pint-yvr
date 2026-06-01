import { createClient } from '@supabase/supabase-js';
import CrawlBuilderClient from '@/components/CrawlBuilderClient';

export const dynamic = 'force-dynamic';

export default async function CrawlBuilderPage() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );

  const { data } = await supabase
    .from('bars')
    .select('neighbourhood')
    .eq('is_permanently_closed', false)
    .not('neighbourhood', 'is', null);

  // Only show neighbourhoods with more than 3 bars
  const counts: Record<string, number> = {};
  for (const b of data ?? []) {
    if (b.neighbourhood) counts[b.neighbourhood] = (counts[b.neighbourhood] ?? 0) + 1;
  }
  const neighbourhoods = Object.entries(counts)
    .filter(([, count]) => count > 3)
    .map(([name]) => name)
    .sort();

  return <CrawlBuilderClient neighbourhoods={neighbourhoods} />;
}
