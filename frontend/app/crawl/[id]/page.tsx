import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CrawlShareView from '@/components/CrawlShareView';
import type { CrawlResult } from '@/components/CrawlOutput';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Bar Crawl Itinerary — Brewscanner',
    description: 'A shareable bar crawl itinerary built on Brewscanner.',
  };
}

export default async function CrawlPage({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );

  const { data, error } = await supabase
    .from('saved_crawls')
    .select('crawl_data, title')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  const crawl = data.crawl_data as CrawlResult;

  return <CrawlShareView crawl={crawl} />;
}
