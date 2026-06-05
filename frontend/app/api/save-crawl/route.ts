import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CrawlResult } from '../crawl-builder/route';

export async function POST(req: NextRequest) {
  const { crawl } = await req.json() as { crawl: CrawlResult };
  if (!crawl) return NextResponse.json({ error: 'Missing crawl data' }, { status: 400 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase
    .from('saved_crawls')
    .insert({ title: crawl.title, crawl_data: crawl })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
