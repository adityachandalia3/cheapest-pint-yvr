import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(req: Request) {
  const supabase = getSupabaseClient();
  const { bar_id, bar_name, beer_name, category, price, submitter_name } = await req.json();

  if (!bar_name || !category || !price) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const priceNum = Number(price);
  if (isNaN(priceNum) || priceNum <= 0 || priceNum > 100) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  const { error } = await supabase.from('price_submissions').insert({
    bar_id: bar_id ?? null,
    bar_name,
    beer_name: beer_name || null,
    category,
    price: priceNum,
    submitter_name: submitter_name || null,
    status: 'pending',
  });

  if (error) {
    console.error('Supabase error:', error);
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
