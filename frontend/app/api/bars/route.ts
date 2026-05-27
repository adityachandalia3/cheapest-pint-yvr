import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('bars')
    .select(`
      id, google_place_id, name, address, latitude, longitude,
      neighbourhood, happy_hour_start, happy_hour_end, happy_hour_notes,
      is_permanently_closed,
      pint_prices (
        id, bar_id, category, beer_name, price_cad,
        happy_hour_price_cad, pour_size_oz
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
