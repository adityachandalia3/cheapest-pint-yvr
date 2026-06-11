import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import WorldCupClient from './WorldCupClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'World Cup 2026 — Watch Parties & Cheapest Pints | Brewscanner',
  description: 'Find where your country\'s fans are watching FIFA World Cup 2026 in Vancouver. Match schedule, supporters bars, and cheapest pints near every screening.',
};

export type SupportersBar = {
  id: string;
  country: string;
  flag: string;
  bar_id: string | null;
  venue_name: string | null;
  neighbourhood: string | null;
  notes: string | null;
  verified: boolean;
  bar: { id: string; name: string; neighbourhood: string | null } | null;
};

export type NeutralBarData = {
  id: string;
  name: string;
  neighbourhood: string | null;
  pint_prices: Array<{ price_cad: number; happy_hour_price_cad: number | null; category: string }>;
  happy_hour_windows: Array<{ days: string[]; start_time: string; end_time: string }>;
};

export type WcScreeningBar = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  neighbourhood: string | null;
};

export type WcMatch = {
  id: string;
  match_date: string;
  kickoff_time: string;
  group_label: string | null;
  venue: string | null;
  team_home: string;
  team_away: string;
  flag_home: string;
  flag_away: string;
  is_vancouver_match: boolean;
  supporters_bar_label: string | null;
  supporters_bar: { id: string; name: string; neighbourhood: string | null } | null;
  neutral_bar: NeutralBarData | null;
};

export default async function WorldCupPage() {
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Vancouver' });

  const matchSelect = `
    id, match_date, kickoff_time, group_label, venue,
    team_home, team_away, flag_home, flag_away,
    is_vancouver_match, supporters_bar_label,
    supporters_bar:bars!supporters_bar_id(id, name, neighbourhood),
    neutral_bar:bars!neutral_bar_id(
      id, name, neighbourhood,
      pint_prices(price_cad, happy_hour_price_cad, category),
      happy_hour_windows(days, start_time, end_time)
    )
  `;

  const [matchesRes, upcomingRes, supportersRes, screeningRes] = await Promise.all([
    // All of today's matches — client filters to remaining/live ones
    sb.from('wc_matches').select(matchSelect).eq('match_date', today).order('kickoff_time'),

    // Next 5 matches from future days — used to pad carousel to ≥3 cards
    sb.from('wc_matches').select(matchSelect)
      .gt('match_date', today)
      .order('match_date').order('kickoff_time')
      .limit(5),

    sb.from('supporters_bars')
      .select('id, country, flag, bar_id, venue_name, neighbourhood, notes, verified, bar:bars(id, name, neighbourhood)')
      .order('country'),

    // Bars confirmed to be screening — used for the WC map
    sb.from('bars')
      .select('id, name, latitude, longitude, neighbourhood')
      .eq('screening_confirmed', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null),
  ]);

  if (matchesRes.error)   console.error('[wc] matches query error:', matchesRes.error.message);
  if (upcomingRes.error)  console.error('[wc] upcoming query error:', upcomingRes.error.message);
  if (supportersRes.error) console.error('[wc] supporters query error:', supportersRes.error.message);
  if (screeningRes.error) console.error('[wc] screening query error:', screeningRes.error.message);

  const todayMatches    = (matchesRes.data   ?? []) as unknown as WcMatch[];
  const upcomingMatches = (upcomingRes.data  ?? []) as unknown as WcMatch[];
  const supportersBars  = (supportersRes.data ?? []) as unknown as SupportersBar[];
  const screeningBars   = (screeningRes.data  ?? []) as unknown as WcScreeningBar[];

  return (
    <WorldCupClient
      todayMatches={todayMatches}
      upcomingMatches={upcomingMatches}
      supportersBars={supportersBars}
      screeningBars={screeningBars}
    />
  );
}
