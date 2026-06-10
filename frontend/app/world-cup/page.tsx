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

  const [matchesRes, nextRes, supportersRes] = await Promise.all([
    sb
      .from('wc_matches')
      .select(`
        id, match_date, kickoff_time, group_label, venue,
        team_home, team_away, flag_home, flag_away,
        is_vancouver_match, supporters_bar_label,
        supporters_bar:bars!wc_matches_supporters_bar_id_fkey(id, name, neighbourhood),
        neutral_bar:bars!wc_matches_neutral_bar_id_fkey(
          id, name, neighbourhood,
          pint_prices(price_cad, happy_hour_price_cad, category),
          happy_hour_windows(days, start_time, end_time)
        )
      `)
      .eq('match_date', today)
      .order('kickoff_time'),

    sb
      .from('wc_matches')
      .select('id, match_date, kickoff_time, group_label, venue, team_home, team_away, flag_home, flag_away, is_vancouver_match, supporters_bar_label')
      .gt('match_date', today)
      .order('match_date')
      .order('kickoff_time')
      .limit(1),

    sb
      .from('supporters_bars')
      .select('id, country, flag, bar_id, venue_name, neighbourhood, notes, verified, bar:bars(id, name, neighbourhood)')
      .order('country'),
  ]);

  const todayMatches = (matchesRes.data ?? []) as unknown as WcMatch[];
  const nextMatch = (nextRes.data?.[0] ?? null) as WcMatch | null;
  const supportersBars = (supportersRes.data ?? []) as unknown as SupportersBar[];

  return (
    <WorldCupClient
      todayMatches={todayMatches}
      nextMatch={nextMatch}
      supportersBars={supportersBars}
    />
  );
}
