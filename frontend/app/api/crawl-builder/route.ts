import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawBar {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  neighbourhood: string | null;
  best_known_for: string | null;
  average_rating: number | null;
  vibe_profile: Record<string, any> | null;
  pint_prices: Array<{
    category: string;
    beer_name: string | null;
    price_cad: number;
    happy_hour_price_cad: number | null;
    pour_size_oz: number | null;
  }>;
  happy_hour_windows: Array<{
    days: string[];
    start_time: string;
    end_time: string;
    notes: string | null;
  }>;
}

export interface CrawlStop {
  position: number;
  bar: RawBar;
  arrival_time: string;
  active_price: number | null;
  is_happy_hour: boolean;
  walking_minutes_from_prev: number | null;
  walking_km_from_prev: number | null;
  reason: string;
}

export interface CrawlResult {
  title: string;
  neighbourhood: string;
  stops: CrawlStop[];
  total_spend: number;
  total_walking_km: number;
  total_duration_min: number;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function addMinutes(timeHHMM: string, minutes: number): string {
  const [h, m] = timeHHMM.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

function formatTime12h(timeHHMM: string): string {
  const [h, m] = timeHHMM.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function timeToSeconds(t: string): number {
  const parts = t.split(':').map(Number);
  return parts[0] * 3600 + parts[1] * 60 + (parts[2] ?? 0);
}

function windowActive(start: string, end: string, current: string): boolean {
  const s = timeToSeconds(start);
  const e = timeToSeconds(end);
  const c = timeToSeconds(current + ':00');
  if (s <= e) return c >= s && c <= e;
  return c >= s || c <= e; // spans midnight
}

function isHappyHour(bar: RawBar, timeHHMM: string, day: string): boolean {
  if (!bar.happy_hour_windows?.length) return false;
  return bar.happy_hour_windows.some(
    w => w.days.includes(day) && windowActive(w.start_time, w.end_time, timeHHMM)
  );
}

function getCheapestPrice(bar: RawBar, hhActive: boolean): number | null {
  if (!bar.pint_prices?.length) return null;
  let cheapest = Infinity;
  for (const p of bar.pint_prices) {
    const price = hhActive && p.happy_hour_price_cad
      ? Math.min(Number(p.price_cad), Number(p.happy_hour_price_cad))
      : Number(p.price_cad);
    if (price < cheapest) cheapest = price;
  }
  return cheapest === Infinity ? null : cheapest;
}

// ─── Geo ─────────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ─── Scoring & Selection ─────────────────────────────────────────────────────

function scoreBar(
  bar: RawBar,
  timeHHMM: string,
  day: string,
  selectedBars: RawBar[],
): { score: number; price: number | null; hh: boolean } {
  const hh = isHappyHour(bar, timeHHMM, day);
  const price = getCheapestPrice(bar, hh);

  // Price score: normalize $4–$14 range (lower = better)
  let priceScore = 0.45; // neutral for no-price bars
  if (price !== null) {
    priceScore = Math.max(0, Math.min(1, 1 - (price - 4) / 10));
  }

  // Happy hour bonus
  const hhBonus = hh ? 0.15 : 0;

  // Vibe diversity: penalise if we already have 2 bars with the same primary tag
  const primaryTag = bar.vibe_profile?.tags?.[0];
  const tagDupes = primaryTag
    ? selectedBars.filter(b => b.vibe_profile?.tags?.[0] === primaryTag).length
    : 0;
  const diversityPenalty = tagDupes >= 2 ? 0.25 : tagDupes === 1 ? 0.1 : 0;

  return { score: priceScore + hhBonus - diversityPenalty, price, hh };
}

const MAX_RADIUS_KM = 0.75; // hard cap — all stops must stay within this radius of the crawl centroid

function centroid(bars: RawBar[]): { lat: number; lng: number } | null {
  const valid = bars.filter(b => b.latitude && b.longitude);
  if (!valid.length) return null;
  return {
    lat: valid.reduce((s, b) => s + b.latitude!, 0) / valid.length,
    lng: valid.reduce((s, b) => s + b.longitude!, 0) / valid.length,
  };
}

function buildCrawl(
  candidates: RawBar[],
  barCount: number,
  startTime: string,
  day: string,
  minutesPerStop: number = 50,
): Array<{ bar: RawBar; arrivalTime: string; price: number | null; hh: boolean }> {
  const stops: Array<{ bar: RawBar; arrivalTime: string; price: number | null; hh: boolean }> = [];
  const remaining = [...candidates];

  for (let i = 0; i < barCount; i++) {
    const arrivalTime = addMinutes(startTime, i * minutesPerStop);
    const selectedBars = stops.map(s => s.bar);

    // After first stop, enforce radius cap around crawl centroid
    const center = i > 0 ? centroid(selectedBars) : null;
    const pool = center
      ? remaining.filter(b => {
          if (!b.latitude || !b.longitude) return false;
          return haversineKm(center.lat, center.lng, b.latitude, b.longitude) <= MAX_RADIUS_KM;
        })
      : remaining;

    // Fall back to full remaining if radius is too tight
    const candidates_ = pool.length >= 1 ? pool : remaining;

    if (i === 0) {
      const scored = candidates_.map(b => ({
        bar: b,
        ...scoreBar(b, arrivalTime, day, selectedBars),
      }));
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      stops.push({ bar: best.bar, arrivalTime, price: best.price, hh: best.hh });
      remaining.splice(remaining.findIndex(b => b.id === best.bar.id), 1);
    } else {
      const prev = stops[stops.length - 1].bar;
      const scored = candidates_.map(b => {
        const { score, price, hh } = scoreBar(b, arrivalTime, day, selectedBars);
        const dist =
          prev.latitude && prev.longitude && b.latitude && b.longitude
            ? haversineKm(prev.latitude, prev.longitude, b.latitude, b.longitude)
            : 1;
        // Stronger walking weight now that radius cap is the primary constraint
        const combined = score - dist * 0.2;
        return { bar: b, score: combined, price, hh, dist };
      });
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      stops.push({ bar: best.bar, arrivalTime, price: best.price, hh: best.hh });
      remaining.splice(remaining.findIndex(b => b.id === best.bar.id), 1);
    }
  }

  return stops;
}

// ─── Claude reasons ───────────────────────────────────────────────────────────

async function generateReasons(
  stops: Array<{ bar: RawBar; arrivalTime: string; price: number | null; hh: boolean }>,
  neighbourhood: string,
  anthropic: Anthropic,
): Promise<Record<string, string>> {
  const barSummaries = stops.map((s, i) => {
    const vp = s.bar.vibe_profile ?? {};
    const tags = (vp.tags ?? []).join(', ');
    const priceStr = s.price != null
      ? `$${Number(s.price).toFixed(2)}${s.hh ? ' (happy hour)' : ''}`
      : 'no price data';
    return `Stop ${i + 1} [bar_id: ${s.bar.id}]: ${s.bar.name}
  Arrival: ${formatTime12h(s.arrivalTime)}
  Price: ${priceStr}
  Best known for: ${s.bar.best_known_for ?? 'N/A'}
  Tags: ${tags}
  Crowd: ${vp.crowd ?? 'N/A'}
  Best for: ${(vp.best_for ?? []).join(', ')}`;
  }).join('\n\n');

  const prompt = `You're writing a bar crawl itinerary for ${neighbourhood}, Vancouver.
For each stop below, write ONE punchy sentence (max 20 words) explaining why it was picked.
Be specific — reference price, happy hour, vibe, or crowd. Not generic.
If no price data, base the reason purely on vibe.

${barSummaries}

Respond with ONLY valid JSON, no markdown:
[
  {"bar_id": "...", "reason": "..."},
  ...
]`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  let raw = (msg.content[0] as { type: string; text: string }).text.trim();
  raw = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```\s*$/m, '');

  const parsed: Array<{ bar_id: string; reason: string }> = JSON.parse(raw);
  return Object.fromEntries(parsed.map(r => [r.bar_id, r.reason]));
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { neighbourhood, barCount, startTime, day } = body as {
    neighbourhood: string;
    barCount: number;
    startTime: string;
    day: string;
  };

  if (!neighbourhood || !barCount || !startTime || !day) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: bars, error } = await supabase
    .from('bars')
    .select(`
      id, name, address, latitude, longitude, neighbourhood,
      best_known_for, average_rating, vibe_profile, price_entry_count,
      pint_prices(category, beer_name, price_cad, happy_hour_price_cad, pour_size_oz),
      happy_hour_windows(days, start_time, end_time, notes)
    `)
    .eq('is_permanently_closed', false)
    .eq('neighbourhood', neighbourhood)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Include bars with prices OR vibe profile
  const candidates = (bars ?? []).filter(
    b => (b.price_entry_count ?? 0) > 0 || b.vibe_profile != null
  ) as RawBar[];

  if (candidates.length < barCount) {
    return NextResponse.json(
      { error: `Not enough bars in ${neighbourhood} — only ${candidates.length} found.` },
      { status: 422 }
    );
  }

  const selectedStops = buildCrawl(candidates, barCount, startTime, day);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const reasons = await generateReasons(selectedStops, neighbourhood, anthropic);

  // Build final stops with walking distances
  const stops: CrawlStop[] = selectedStops.map((s, i) => {
    let walkingKm: number | null = null;
    let walkingMinutes: number | null = null;

    if (i > 0) {
      const prev = selectedStops[i - 1].bar;
      if (prev.latitude && prev.longitude && s.bar.latitude && s.bar.longitude) {
        walkingKm = Math.round(haversineKm(prev.latitude, prev.longitude, s.bar.latitude, s.bar.longitude) * 100) / 100;
        walkingMinutes = Math.round((walkingKm / 5) * 60); // 5 km/h walking speed
      }
    }

    return {
      position: i + 1,
      bar: s.bar,
      arrival_time: formatTime12h(s.arrivalTime),
      active_price: s.price,
      is_happy_hour: s.hh,
      walking_minutes_from_prev: walkingMinutes,
      walking_km_from_prev: walkingKm,
      reason: reasons[s.bar.id] ?? `A great ${neighbourhood} pick for your crawl.`,
    };
  });

  const totalSpend = stops.reduce((sum, s) => sum + (s.active_price ?? 0), 0);
  const totalWalkingKm = stops.reduce((sum, s) => sum + (s.walking_km_from_prev ?? 0), 0);
  const totalDurationMin = (barCount - 1) * 50 + 60; // 50 min per stop + 1 hour at last bar

  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const result: CrawlResult = {
    title: `Your ${neighbourhood} Crawl — ${dayLabel}`,
    neighbourhood,
    stops,
    total_spend: Math.round(totalSpend * 100) / 100,
    total_walking_km: Math.round(totalWalkingKm * 100) / 100,
    total_duration_min: totalDurationMin,
  };

  return NextResponse.json({ crawl: result });
}
