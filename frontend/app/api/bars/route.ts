import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );

  const { data, error } = await supabase
    .from('bars')
    .select(`
      id, google_place_id, name, address, latitude, longitude,
      neighbourhood, is_permanently_closed,
      pint_prices (
        id, bar_id, category, beer_name, price_cad,
        happy_hour_price_cad, pour_size_oz
      ),
      happy_hour_windows (
        id, bar_id, days, start_time, end_time, notes
      )
    `)
    .eq('is_permanently_closed', false)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bars: data ?? [] });
}
