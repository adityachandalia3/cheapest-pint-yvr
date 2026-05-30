import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { isHappyHourActive } from '@/lib/priceUtils';
import { Bar } from '@/lib/types';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { data: unknown; expiresAt: number }>();

function buildBarContext(bar: any): string {
  const vp = bar.vibe_profile ?? {};
  const tags = (vp.tags ?? []).join(', ');
  const bestFor = (vp.best_for ?? []).join(', ');
  const prices = (bar.pint_prices ?? [])
    .map((p: any) => {
      const cat = p.category.replace('cheapest_', '');
      const hh = p.happy_hour_price_cad ? ` (HH: $${p.happy_hour_price_cad})` : '';
      return `${cat}: $${p.price_cad}${hh}`;
    })
    .join(', ');

  return `[ID:${bar.id}] ${bar.name} (${bar.neighbourhood ?? 'Vancouver'})
Best known for: ${bar.best_known_for ?? 'N/A'}
Tags: ${tags}
Crowd: ${vp.crowd ?? 'N/A'}
Energy: ${vp.energy ?? 'N/A'}
Best for: ${bestFor}
Avoid if: ${vp.avoid_if ?? 'N/A'}
Price value: ${vp.price_value ?? 'N/A'}
Night arc: ${vp.night_arc ?? 'N/A'}
Prices: ${prices}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query: string = body?.query?.trim();
  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: bars, error } = await supabase
    .from('bars')
    .select(`
      id, name, neighbourhood, best_known_for, vibe_profile,
      pint_prices(category, price_cad, happy_hour_price_cad, beer_name),
      happy_hour_windows(days, start_time, end_time, notes)
    `)
    .eq('is_permanently_closed', false)
    .not('vibe_profile', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const barsWithVibes = (bars ?? []).filter(b => b.vibe_profile);
  const barContext = barsWithVibes.map(buildBarContext).join('\n\n---\n\n');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const systemPrompt = `You are a Vancouver bar expert. Based on the user's request and the following bar profiles, recommend the 3 best matching bars. For each bar explain in 2-3 sentences why it matches their vibe tonight. Be conversational, specific, and honest. Reference actual details from the bar profiles like prices, happy hour times, crowd type, and insider tips.

Respond with ONLY valid JSON, no markdown fences:
[
  { "bar_id": "...", "match_reason": "..." },
  { "bar_id": "...", "match_reason": "..." },
  { "bar_id": "...", "match_reason": "..." }
]

Bar profiles:
${barContext}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: query }],
  });

  let raw = (message.content[0] as { type: string; text: string }).text.trim();
  raw = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```\s*$/m, '');

  const recommendations: Array<{ bar_id: string; match_reason: string }> = JSON.parse(raw);

  const now = new Date();

  const enriched = recommendations
    .map(rec => {
      const bar = barsWithVibes.find(b => b.id === rec.bar_id);
      if (!bar) return null;

      const happyHour = isHappyHourActive(bar as unknown as Bar, now);
      const sortedPrices = [...(bar.pint_prices ?? [])].sort((a: any, b: any) => {
        const aActive = happyHour && a.happy_hour_price_cad ? a.happy_hour_price_cad : a.price_cad;
        const bActive = happyHour && b.happy_hour_price_cad ? b.happy_hour_price_cad : b.price_cad;
        return aActive - bActive;
      });

      const cheapest = sortedPrices[0] as any;
      const activePrice = cheapest
        ? happyHour && cheapest.happy_hour_price_cad
          ? cheapest.happy_hour_price_cad
          : cheapest.price_cad
        : null;

      const vp = bar.vibe_profile as Record<string, any>;
      const firstTag: string | null = (vp?.tags as string[] | undefined)?.[0] ?? null;

      return {
        bar_id: bar.id,
        bar_name: bar.name,
        neighbourhood: bar.neighbourhood,
        match_reason: rec.match_reason,
        cheapest_price: activePrice,
        is_happy_hour: happyHour,
        tag: firstTag,
      };
    })
    .filter(Boolean);

  const result = { recommendations: enriched };
  cache.set(cacheKey, { data: result, expiresAt: Date.now() + 30 * 60 * 1000 });

  return NextResponse.json(result);
}
