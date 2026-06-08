import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { isHappyHourActive } from '@/lib/priceUtils';
import { Bar } from '@/lib/types';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { data: unknown; expiresAt: number }>();

// Rate limiting: 15 unique queries per IP per hour
const rateLimit = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

type DbPintPrice = {
  category: string;
  price_cad: number;
  happy_hour_price_cad: number | null;
  beer_name: string | null;
};

type DbBar = {
  id: string;
  name: string;
  neighbourhood: string | null;
  best_known_for: string | null;
  vibe_profile: Record<string, unknown> | null;
  pint_prices: DbPintPrice[] | null;
  happy_hour_windows: { days: string[]; start_time: string; end_time: string; notes: string | null }[] | null;
};

function buildBarContext(bar: DbBar): string {
  const vp = bar.vibe_profile ?? {};
  const tags = ((vp.tags as string[] | undefined) ?? []).join(', ');
  const bestFor = ((vp.best_for as string[] | undefined) ?? []).join(', ');
  const prices = (bar.pint_prices ?? [])
    .map((p) => {
      const cat = p.category.replace('cheapest_', '');
      const hh = p.happy_hour_price_cad ? ` (HH: $${p.happy_hour_price_cad})` : '';
      return `${cat}: $${p.price_cad}${hh}`;
    })
    .join(', ');

  return `[ID:${bar.id}] ${bar.name} (${bar.neighbourhood ?? 'Vancouver'})
Best known for: ${bar.best_known_for ?? 'N/A'}
Tags: ${tags}
Crowd: ${(vp.crowd as string | undefined) ?? 'N/A'}
Energy: ${(vp.energy as string | undefined) ?? 'N/A'}
Best for: ${bestFor}
Avoid if: ${(vp.avoid_if as string | undefined) ?? 'N/A'}
Price value: ${(vp.price_value as string | undefined) ?? 'N/A'}
Night arc: ${(vp.night_arc as string | undefined) ?? 'N/A'}
Prices: ${prices}`;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many searches. Try again in an hour.' },
      { status: 429 }
    );
  }

  const body = await req.json();
  const query: string = body?.query?.trim();
  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  if (query.length > 300) {
    return NextResponse.json({ error: 'Query too long.' }, { status: 400 });
  }

  const drinkType: string = body?.drinkType ?? 'any';
  const neighbourhood: string | null = body?.neighbourhood ?? null;
  const timeOfDay: string | null = body?.timeOfDay ?? null;
  const maxPrice: number | null = body?.maxPrice ?? null;

  const cacheKey = `${query.toLowerCase()}|${drinkType}|${neighbourhood ?? ''}|${timeOfDay ?? ''}|${maxPrice ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  let dbQuery = supabase
    .from('bars')
    .select(`
      id, name, neighbourhood, best_known_for, vibe_profile,
      pint_prices(category, price_cad, happy_hour_price_cad, beer_name),
      happy_hour_windows(days, start_time, end_time, notes)
    `)
    .eq('is_permanently_closed', false)
    .not('vibe_profile', 'is', null);

  if (neighbourhood) {
    dbQuery = dbQuery.eq('neighbourhood', neighbourhood);
  }

  const { data: bars, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let barsWithVibes = ((bars ?? []) as DbBar[]).filter(b => b.vibe_profile);

  // Price filter
  if (maxPrice) {
    barsWithVibes = barsWithVibes.filter(b =>
      (b.pint_prices ?? []).some(p => p.price_cad <= maxPrice)
    );
  }

  // Build enriched query for Claude
  const contextParts: string[] = [];
  if (neighbourhood) contextParts.push(`in ${neighbourhood}`);
  if (drinkType === 'beer') contextParts.push('looking for beers/pints');
  if (drinkType === 'cocktail') contextParts.push('looking for cocktails');
  if (timeOfDay) contextParts.push(`going out in the ${timeOfDay}`);
  if (maxPrice) contextParts.push(`budget around $${maxPrice} per drink`);
  const enrichedQuery = contextParts.length
    ? `${query} [${contextParts.join(', ')}]`
    : query;
  const barContext = barsWithVibes.map(buildBarContext).join('\n\n---\n\n');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: `You are a Vancouver bar expert. Based on the user's request and the following bar profiles, recommend the 3 best matching bars. For each bar explain in 2-3 sentences why it matches their vibe tonight. Be conversational, specific, and honest. Reference actual details from that bar's own profile only — do NOT mix details from different bars.

CRITICAL: Each bar profile starts with [ID:...]. You must use the exact bar_id from that bar's profile. Only use details (crowd, energy, prices, tips) from that specific bar's profile in its match_reason.

Respond with ONLY valid JSON, no markdown fences:
[
  { "bar_id": "...", "match_reason": "..." },
  { "bar_id": "...", "match_reason": "..." },
  { "bar_id": "...", "match_reason": "..." }
]`,
      },
      {
        type: 'text',
        text: `Bar profiles:\n\n${barContext}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: enrichedQuery }],
  });

  let raw = (message.content[0] as { type: string; text: string }).text.trim();
  raw = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```\s*$/m, '');

  let recommendations: Array<{ bar_id: string; match_reason: string }>;
  try {
    recommendations = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  const now = new Date();

  const enriched = recommendations
    .map(rec => {
      const bar = barsWithVibes.find(b => b.id === rec.bar_id);
      if (!bar) return null;

      const happyHour = isHappyHourActive(bar as unknown as Bar, now);
      const sortedPrices = [...(bar.pint_prices ?? [])].sort((a, b) => {
        const aActive = happyHour && a.happy_hour_price_cad ? a.happy_hour_price_cad : a.price_cad;
        const bActive = happyHour && b.happy_hour_price_cad ? b.happy_hour_price_cad : b.price_cad;
        return aActive - bActive;
      });

      const cheapest: DbPintPrice | undefined = sortedPrices[0];
      const activePrice = cheapest
        ? happyHour && cheapest.happy_hour_price_cad
          ? cheapest.happy_hour_price_cad
          : cheapest.price_cad
        : null;

      const vp = bar.vibe_profile as Record<string, unknown>;
      const tags: string[] = (vp?.tags as string[] | undefined) ?? [];

      return {
        bar_id: bar.id,
        bar_name: bar.name,
        neighbourhood: bar.neighbourhood,
        match_reason: rec.match_reason,
        cheapest_price: activePrice,
        is_happy_hour: happyHour,
        tags,
        expense_rating: (vp?.price_value as string | undefined) ?? null,
      };
    })
    .filter(Boolean);

  // Ensure at most 1 bar without price data — sort priced bars first, then cap
  const withPrice = enriched.filter(r => r!.cheapest_price != null);
  const withoutPrice = enriched.filter(r => r!.cheapest_price == null).slice(0, 1);
  const filtered = [...withPrice, ...withoutPrice].slice(0, 3);

  const result = { recommendations: filtered };
  cache.set(cacheKey, { data: result, expiresAt: Date.now() + 30 * 60 * 1000 });

  return NextResponse.json(result);
}
