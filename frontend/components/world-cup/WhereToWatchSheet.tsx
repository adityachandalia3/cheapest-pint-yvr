'use client';

import { useState, useMemo } from 'react';
import posthog from 'posthog-js';
import type { WcMatch, SupportersBar, WcVenueBar, WcProfile } from '@/app/world-cup/page';
import { cheapestPrice, isHHActive } from '@/app/world-cup/WcVenueList';
import type { SelectedVenue } from '@/app/world-cup/WcVenueList';

// ── Types ──────────────────────────────────────────────────────────────────────

type Vibe = 'cheap' | 'fans' | 'chill';
type Step = 1 | 2 | 3;

type WatchResult = {
  id: string | null;
  name: string;
  neighbourhood: string | null;
  price: number | null;
  hhActiveAtKickoff: boolean;
  hhEndDisplay: string | null;
  wcProfile: WcProfile | null;
  supportersBadge: string | null;
  whyLine: string;
  mapsUrl: string;
};

type CommunityResult = {
  name: string;
  description: string;
  badge: string;
  mapsUrl: string;
  infoUrl: string | null;
};

type CommunityVenueData = CommunityResult & { teams: string[] };

type Recs = {
  primary: WatchResult | null;
  communityPrimary: CommunityResult | null;
  alternatives: WatchResult[];
  alsoWorthKnowing: CommunityResult[];
  fifaFestival: CommunityResult | null;
  noSupportersNote?: string;
};

// ── Community venues ───────────────────────────────────────────────────────────

const COMMUNITY_VENUES: CommunityVenueData[] = [
  {
    name: 'FIFA Fan Festival',
    description: 'Free entry · Hastings Park · All matches on giant screens',
    badge: '🏟️ Official',
    mapsUrl: 'https://maps.google.com/?q=Hastings+Park+Vancouver',
    infoUrl: 'https://www.vancouverfwc26.ca/fifa-fan-festival',
    teams: [],
  },
  {
    name: 'Portuguese Club of Vancouver',
    description: 'Public entry 30 min before kickoff · 1144 Commercial Dr',
    badge: '🇵🇹 Portugal fans',
    mapsUrl: 'https://maps.google.com/?q=Portuguese+Club+Vancouver',
    infoUrl: null,
    teams: ['Portugal'],
  },
  {
    name: 'Croatian Cultural Centre',
    description: 'Community screening · 3250 Commercial Dr',
    badge: '🇭🇷 Croatia fans',
    mapsUrl: 'https://maps.google.com/?q=Croatian+Cultural+Centre+Vancouver',
    infoUrl: null,
    teams: ['Croatia'],
  },
  {
    name: 'Alliance Française',
    description: 'Les Bleus watch parties · South Granville',
    badge: '🇫🇷 France fans',
    mapsUrl: 'https://maps.google.com/?q=Alliance+Francaise+Vancouver',
    infoUrl: null,
    teams: ['France'],
  },
  {
    name: 'Latin Plaza Hub (Latincouver)',
    description: 'Tribuna Latina · Gastown · All Latin American matches',
    badge: '🌎 Latin fans',
    mapsUrl: 'https://maps.google.com/?q=Gastown+Vancouver',
    infoUrl: null,
    teams: ['Mexico', 'Argentina', 'Colombia', 'Brazil', 'Uruguay', 'Ecuador', 'Bolivia', 'Venezuela', 'Paraguay', 'Peru', 'Chile'],
  },
];

const FIFA_FESTIVAL: CommunityResult = COMMUNITY_VENUES[0];

function toCommunityResult(cv: CommunityVenueData): CommunityResult {
  return { name: cv.name, description: cv.description, badge: cv.badge, mapsUrl: cv.mapsUrl, infoUrl: cv.infoUrl };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtKickoff(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function fmtEndTime(t: string): string {
  const [h] = t.split(':').map(Number);
  return `${h % 12 || 12}${h >= 12 ? 'pm' : 'am'}`;
}

function dayAbbrFor(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(y, mo - 1, d).getDay()];
}

function windowContains(start: string, end: string, t: string): boolean {
  const s = start.slice(0, 8), e = end.slice(0, 8), tt = t.slice(0, 8);
  return s <= e ? tt >= s && tt <= e : tt >= s || tt <= e;
}

function hhAtKickoff(
  bar: WcVenueBar,
  matchDate: string,
  kickoffTime: string,
): { active: boolean; endDisplay: string | null } {
  const day = dayAbbrFor(matchDate);
  for (const w of bar.happy_hour_windows) {
    if (!w.days.includes(day)) continue;
    if (windowContains(w.start_time, w.end_time, kickoffTime)) {
      return { active: true, endDisplay: fmtEndTime(w.end_time) };
    }
  }
  return { active: false, endDisplay: null };
}

// World Cup 2026 runs Jun–Jul; Vancouver is PDT (UTC-7)
function kickoffInHours(matchDate: string, kickoffTime: string, now: Date): number {
  const [y, mo, d] = matchDate.split('-').map(Number);
  const [h, min] = kickoffTime.split(':').map(Number);
  const kickoffUTC = new Date(Date.UTC(y, mo - 1, d, h + 7, min));
  return (kickoffUTC.getTime() - now.getTime()) / (1000 * 60 * 60);
}

function gmapsUrl(name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' Vancouver BC')}`;
}

function fw(s: string, n: number) { return s.trim().split(/\s+/).slice(0, n).join(' '); }

function computeWhyLine(
  v: WcVenueBar,
  match: WcMatch,
  now: Date,
  supportersCountry?: string,
): string {
  if (supportersCountry) return `Home of ${supportersCountry} fans in Vancouver`;

  const p = v.wc_profile;
  if (p?.special_features && p.special_features !== 'null') return fw(p.special_features, 8);

  const hh = hhAtKickoff(v, match.match_date, match.kickoff_time);
  if (hh.active) return 'Happy hour active during kickoff 🟢';

  if (p?.opens_early === true) {
    const [h] = match.kickoff_time.split(':').map(Number);
    if (h < 12) return 'Opens early for this match 🌅';
  }

  const hrs = kickoffInHours(match.match_date, match.kickoff_time, now);
  if (p?.booking_required === false && hrs >= 0 && hrs <= 3) return 'Walk-ins welcome right now 🚪';

  const price = cheapestPrice(v, now);
  if (price < 6) return "One of Vancouver's cheapest pints 🍺";

  if ((v.average_rating ?? 0) > 4.5) return 'Top rated sports bar in Vancouver ⭐';

  return 'Confirmed screening all World Cup matches ⚽';
}

function fromVenue(v: WcVenueBar, match: WcMatch, now: Date, badge?: string, supportersCountry?: string): WatchResult {
  const p = cheapestPrice(v, now);
  const hh = hhAtKickoff(v, match.match_date, match.kickoff_time);
  return {
    id: v.id,
    name: v.name,
    neighbourhood: v.neighbourhood,
    price: p < Infinity ? p : null,
    hhActiveAtKickoff: hh.active,
    hhEndDisplay: hh.endDisplay,
    wcProfile: v.wc_profile,
    supportersBadge: badge ?? null,
    whyLine: computeWhyLine(v, match, now, supportersCountry),
    mapsUrl: gmapsUrl(v.name),
  };
}

function fromSupportersBar(sb: SupportersBar): WatchResult {
  const barName = sb.bar?.name ?? sb.venue_name ?? sb.country;
  const query = sb.bar ? `${sb.bar.name} Vancouver BC` : `${barName} Vancouver BC`;
  return {
    id: sb.bar_id,
    name: barName,
    neighbourhood: sb.bar?.neighbourhood ?? sb.neighbourhood,
    price: null,
    hhActiveAtKickoff: false,
    hhEndDisplay: null,
    wcProfile: null,
    supportersBadge: `${sb.flag} ${barName}`,
    whyLine: `Home of ${sb.country} fans in Vancouver`,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  };
}

function cheapPrice(v: WcVenueBar, now: Date): number {
  const p = cheapestPrice(v, now);
  return p < Infinity ? p : 9999;
}

// Single-pass boost (move up 1) + penalty (move down 1)
function applyBoostPenalty<T>(
  arr: T[],
  shouldBoost: (item: T) => boolean,
  shouldPenalize: (item: T) => boolean,
): T[] {
  const r = [...arr];
  for (let i = r.length - 1; i >= 1; i--) {
    if (shouldBoost(r[i]) && !shouldBoost(r[i - 1])) [r[i - 1], r[i]] = [r[i], r[i - 1]];
  }
  for (let i = 0; i < r.length - 1; i++) {
    if (shouldPenalize(r[i]) && !shouldPenalize(r[i + 1])) [r[i], r[i + 1]] = [r[i + 1], r[i]];
  }
  return r;
}

function getRecommendations(
  vibe: Vibe,
  match: WcMatch,
  venues: WcVenueBar[],
  sbs: SupportersBar[],
  now: Date,
): Recs {
  if (venues.length === 0) {
    return {
      primary: { id: null, name: 'No venues found', neighbourhood: null, price: null, hhActiveAtKickoff: false, hhEndDisplay: null, wcProfile: null, supportersBadge: null, whyLine: 'Check back soon', mapsUrl: '' },
      communityPrimary: null, alternatives: [], alsoWorthKnowing: [], fifaFestival: null,
    };
  }

  const hrs = kickoffInHours(match.match_date, match.kickoff_time, now);
  const bookingPenalty = (v: WcVenueBar) =>
    v.wc_profile?.booking_required === true && hrs >= 0 && hrs <= 3;

  // ── cheap ──
  if (vibe === 'cheap') {
    const base = [...venues].sort((a, b) => cheapPrice(a, now) - cheapPrice(b, now));
    const sorted = applyBoostPenalty(
      base,
      v => hhAtKickoff(v, match.match_date, match.kickoff_time).active,
      bookingPenalty,
    );
    return {
      primary: fromVenue(sorted[0], match, now),
      communityPrimary: null,
      alternatives: sorted.slice(1, 3).map(v => fromVenue(v, match, now)),
      alsoWorthKnowing: [],
      fifaFestival: null,
    };
  }

  // ── fans ──
  if (vibe === 'fans') {
    const homeEntry = sbs.find(sb => sb.country === match.team_home && (sb.bar || sb.venue_name));
    const awayEntry = sbs.find(sb => sb.country === match.team_away && (sb.bar || sb.venue_name));

    let chosen: SupportersBar | null = null;
    if (homeEntry && awayEntry) {
      if (homeEntry.bar_id && !awayEntry.bar_id) chosen = homeEntry;
      else if (awayEntry.bar_id && !homeEntry.bar_id) chosen = awayEntry;
      else chosen = homeEntry;
    } else {
      chosen = homeEntry ?? awayEntry ?? null;
    }

    // Community venues matching either team (FIFA handled separately as Step D)
    const communityMatches = COMMUNITY_VENUES
      .filter(cv => cv.teams.length > 0 && (cv.teams.includes(match.team_home) || cv.teams.includes(match.team_away)))
      .map(toCommunityResult);

    // Step A: supporters bar found
    if (chosen) {
      const venueMatch = chosen.bar_id ? venues.find(v => v.id === chosen!.bar_id) : null;
      const badge = `${chosen.flag} ${chosen.bar?.name ?? chosen.venue_name ?? chosen.country}`;
      const primary = venueMatch
        ? fromVenue(venueMatch, match, now, badge, chosen.country)
        : fromSupportersBar(chosen);
      const targetHood = chosen.bar?.neighbourhood ?? chosen.neighbourhood;
      const others = venues
        .filter(v => v.id !== chosen!.bar_id)
        .sort((a, b) => {
          const ah = a.neighbourhood === targetHood ? 0 : 1;
          const bh = b.neighbourhood === targetHood ? 0 : 1;
          if (ah !== bh) return ah - bh;
          return cheapPrice(a, now) - cheapPrice(b, now);
        });
      return {
        primary,
        communityPrimary: null,
        alternatives: others.slice(0, 2).map(v => fromVenue(v, match, now)),
        alsoWorthKnowing: communityMatches,
        fifaFestival: FIFA_FESTIVAL,
      };
    }

    // Step B/C: no supporters bar — community venue as primary if available
    if (communityMatches.length > 0) {
      return {
        primary: null,
        communityPrimary: communityMatches[0],
        alternatives: [],
        alsoWorthKnowing: communityMatches.slice(1),
        fifaFestival: FIFA_FESTIVAL,
      };
    }

    // Step C fallback: top bars by review_count
    const sorted = [...venues].sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0));
    return {
      primary: fromVenue(sorted[0], match, now),
      communityPrimary: null,
      alternatives: sorted.slice(1, 3).map(v => fromVenue(v, match, now)),
      alsoWorthKnowing: [],
      fifaFestival: FIFA_FESTIVAL,
      noSupportersNote: 'No dedicated supporters bar found — here are the best spots to watch',
    };
  }

  // ── chill ──
  const base = [...venues].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
  const sorted = applyBoostPenalty(
    base,
    v => v.wc_profile?.atmosphere === 'chill',
    bookingPenalty,
  );
  return {
    primary: fromVenue(sorted[0], match, now),
    communityPrimary: null,
    alternatives: sorted.slice(1, 3).map(v => fromVenue(v, match, now)),
    alsoWorthKnowing: [],
    fifaFestival: null,
  };
}

// ── Chip renderer ──────────────────────────────────────────────────────────────

const CHIP: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  background: 'rgba(0,0,0,0.06)', border: '1px solid #e8dcc8',
  borderRadius: 999, padding: '3px 8px', fontSize: 10,
  color: '#5C4A2A', whiteSpace: 'nowrap', flexShrink: 0,
};

function Chips({ profile }: { profile: WcProfile | null }) {
  if (!profile) return null;
  const chips: string[] = [];
  if (profile.screen_type && profile.screen_type !== 'null') chips.push(`📺 ${fw(profile.screen_type, 3)}`);
  if (chips.length < 3 && profile.booking_required === false) chips.push('🚪 Walk-in');
  else if (chips.length < 3 && profile.booking_required === true) chips.push('📅 Book ahead');
  if (chips.length < 3 && profile.opens_early === true) chips.push('🌅 Early open');
  if (chips.length < 3 && profile.special_features && profile.special_features !== 'null') chips.push(`🎉 ${fw(profile.special_features, 2)}`);
  if (!chips.length) return null;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden', marginTop: 6 }}>
      {chips.slice(0, 3).map((c, i) => <span key={i} style={CHIP}>{c}</span>)}
    </div>
  );
}

// ── Result cards ───────────────────────────────────────────────────────────────

type CardActions = {
  screeningVenues: WcVenueBar[];
  now: Date;
  onShowVenue: (v: SelectedVenue) => void;
};

function resolveAction(result: WatchResult, { screeningVenues, now, onShowVenue }: CardActions) {
  const venue = result.id ? screeningVenues.find(v => v.id === result.id) : null;
  if (venue) {
    return () => onShowVenue({ bar: venue, price: cheapestPrice(venue, now), hhActive: isHHActive(venue, now) });
  }
  return () => window.open(result.mapsUrl, '_blank');
}

function PrimaryCard({ result, actions }: { result: WatchResult; actions: CardActions }) {
  const handleClick = resolveAction(result, actions);
  const hasVenue = !!result.id && actions.screeningVenues.some(v => v.id === result.id);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left active:scale-[0.99] transition-all"
      style={{ background: 'white', border: '1.5px solid #fde8c4', borderRadius: 14, padding: 14, boxShadow: '0 2px 12px rgba(179,66,7,0.08)' }}
    >
      {result.supportersBadge && (
        <span style={{ display: 'inline-block', background: '#FAEEDA', border: '1px solid #FFD966', color: '#1c1410', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
          {result.supportersBadge}
        </span>
      )}
      <p style={{ fontSize: 16, fontWeight: 700, color: '#1c1410', margin: 0, lineHeight: 1.2 }}>
        {result.name}
      </p>
      {result.whyLine && (
        <p style={{ fontSize: 11, color: '#a0855a', fontStyle: 'italic', margin: '3px 0 0' }}>
          {result.whyLine}
        </p>
      )}
      <p style={{ fontSize: 12, color: '#a0855a', marginTop: 3, marginBottom: 0 }}>
        {[result.neighbourhood, result.price != null ? `from $${result.price.toFixed(2)}` : null].filter(Boolean).join(' · ')}
      </p>
      <Chips profile={result.wcProfile} />
      <p style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
        {result.hhActiveAtKickoff ? (
          <span style={{ color: '#166534' }}>🟢 HH active{result.hhEndDisplay ? ` until ${result.hhEndDisplay}` : ''}</span>
        ) : (
          <span style={{ color: '#991b1b' }}>🔴 HH ends before kickoff</span>
        )}
      </p>
      <p style={{ fontSize: 11, color: '#a0855a', fontStyle: 'italic', marginTop: 4, marginBottom: 6 }}>
        💡 Match-day specials may apply — check with the bar
      </p>
      <span style={{ fontSize: 11, color: '#B34207', fontWeight: 600 }}>
        {hasVenue ? 'Tap for more info →' : 'Tap for directions →'}
      </span>
    </button>
  );
}

function AltCard({ result, actions }: { result: WatchResult; actions: CardActions }) {
  const handleClick = resolveAction(result, actions);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left active:scale-[0.98] transition-all"
      style={{ display: 'block', background: 'white', border: '1px solid #fde8c4', borderRadius: 10, padding: 10 }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {result.name}
      </p>
      {result.whyLine && (
        <p style={{ fontSize: 10, color: '#a0855a', fontStyle: 'italic', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {result.whyLine}
        </p>
      )}
      <p style={{ fontSize: 11, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {result.neighbourhood && <span style={{ color: '#a0855a' }}>{result.neighbourhood}</span>}
        {result.price != null && (
          <span style={{ color: '#B34207', fontWeight: 500 }}>
            {result.neighbourhood ? ' · ' : ''}${result.price.toFixed(2)}
          </span>
        )}
      </p>
      <Chips profile={result.wcProfile} />
    </button>
  );
}

function CommunityCard({ result }: { result: CommunityResult }) {
  return (
    <div style={{ background: 'white', border: '1px solid #fde8c4', borderRadius: 10, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', margin: 0 }}>
          {result.name}
        </p>
        <span style={{ background: '#FAEEDA', color: '#854F0B', borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {result.badge}
        </span>
      </div>
      <p style={{ fontSize: 11, color: '#a0855a', margin: '3px 0 8px' }}>
        {result.description}
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        <a
          href={result.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0', borderRadius: 8, background: '#B34207', color: 'white', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
        >
          Get Directions →
        </a>
        {result.infoUrl && (
          <a
            href={result.infoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0', borderRadius: 8, border: '1px solid #e8dcc8', background: 'white', color: '#1c1917', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
          >
            More Info →
          </a>
        )}
      </div>
    </div>
  );
}

// ── Step 1: Match selector ─────────────────────────────────────────────────────

function MatchStep({ matches, onSelect, onClose }: { matches: WcMatch[]; onSelect: (m: WcMatch) => void; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#e8dcc8] shrink-0">
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1c1410', margin: 0 }}>Which match?</p>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-[#1c1917] hover:bg-stone-100 transition-all text-sm">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        {matches.length === 0 && (
          <p className="px-5 py-8 text-center" style={{ fontSize: 14, color: '#a0855a' }}>No upcoming matches found</p>
        )}
        {matches.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#fef3e2] transition-colors"
            style={{ borderBottom: i < matches.length - 1 ? '1px solid #e8dcc8' : undefined }}
          >
            <span style={{ fontSize: 15, color: '#1c1410' }}>
              {m.flag_home} {m.team_home}{' '}
              <span style={{ color: '#a0855a', fontSize: 13 }}>vs</span>{' '}
              {m.flag_away} {m.team_away}
            </span>
            <span style={{ background: '#FAEEDA', border: '1px solid #e8dcc8', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: '#1c1410', whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>
              {fmtKickoff(m.kickoff_time)}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

// ── Step 2: Vibe selector ──────────────────────────────────────────────────────

const VIBES: { id: Vibe; title: string; subtitle: string }[] = [
  { id: 'cheap', title: '🍺 Cheap & lively',          subtitle: 'Best pint price near a screening' },
  { id: 'fans',  title: "🎉 With my country's fans",   subtitle: "Find your country's supporters bar" },
  { id: 'chill', title: '🧘 Chill, actually watch',    subtitle: 'Quieter spot, great screens' },
];

function VibeStep({ onSelect, onBack }: { onSelect: (v: Vibe) => void; onBack: () => void }) {
  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-2 pb-3 border-b border-[#e8dcc8] shrink-0">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-[#1c1917] hover:bg-stone-100 transition-all text-sm shrink-0">←</button>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1c1410', margin: 0 }}>What&apos;s your vibe?</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        {VIBES.map(v => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className="w-full text-left hover:border-[#B34207]/40 transition-all"
            style={{ background: '#faf5eb', border: '1px solid #e8dcc8', borderRadius: 10, padding: '12px 14px' }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1410', margin: 0 }}>{v.title}</p>
            <p style={{ fontSize: 11, color: '#a0855a', margin: '3px 0 0' }}>{v.subtitle}</p>
          </button>
        ))}
      </div>
    </>
  );
}

// ── Step 3: Results ────────────────────────────────────────────────────────────

function ResultsStep({ recs, onReset, actions }: { recs: Recs; onReset: () => void; actions: CardActions }) {
  return (
    <>
      <div className="flex items-center px-5 pt-2 pb-3 border-b border-[#e8dcc8] shrink-0">
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1c1410', margin: 0 }}>Your spot 🍺</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        {recs.noSupportersNote && (
          <p style={{ fontSize: 11, color: '#a0855a', fontStyle: 'italic', marginBottom: 12 }}>{recs.noSupportersNote}</p>
        )}

        {/* Primary result */}
        {recs.primary !== null
          ? <PrimaryCard result={recs.primary} actions={actions} />
          : recs.communityPrimary !== null
          ? <CommunityCard result={recs.communityPrimary} />
          : null
        }

        {/* Bar alternatives */}
        {recs.alternatives.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: '#a0855a', marginTop: 16, marginBottom: 8 }}>Or try these →</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {recs.alternatives.map((alt, i) => <AltCard key={i} result={alt} actions={actions} />)}
            </div>
          </>
        )}

        {/* Community venues — "Also worth knowing" */}
        {recs.alsoWorthKnowing.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: '#a0855a', marginTop: 16, marginBottom: 8 }}>Also worth knowing 👀</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recs.alsoWorthKnowing.map((cv, i) => <CommunityCard key={i} result={cv} />)}
            </div>
          </>
        )}

        {/* FIFA Fan Festival — always last for fans vibe */}
        {recs.fifaFestival && (
          <>
            <p style={{ fontSize: 11, color: '#a0855a', marginTop: 16, marginBottom: 8 }}>Or go big →</p>
            <CommunityCard result={recs.fifaFestival} />
          </>
        )}

        <div className="text-center mt-6 mb-2">
          <button onClick={onReset} style={{ fontSize: 13, color: '#a0855a', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Search again
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function WhereToWatchSheet({
  todayMatches,
  upcomingMatches,
  screeningVenues,
  supportersBars,
  onClose,
  onShowVenue,
}: {
  todayMatches: WcMatch[];
  upcomingMatches: WcMatch[];
  screeningVenues: WcVenueBar[];
  supportersBars: SupportersBar[];
  onClose: () => void;
  onShowVenue: (v: SelectedVenue) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [selectedMatch, setSelectedMatch] = useState<WcMatch | null>(null);
  const [recs, setRecs] = useState<Recs | null>(null);
  const [now] = useState(() => new Date());

  const matches = useMemo(() => {
    if (todayMatches.length >= 3) return todayMatches;
    return [...todayMatches, ...upcomingMatches.slice(0, 2)];
  }, [todayMatches, upcomingMatches]);

  function handleMatchSelect(match: WcMatch) {
    setSelectedMatch(match);
    setStep(2);
  }

  function handleVibeSelect(vibe: Vibe) {
    if (!selectedMatch) return;
    const computed = getRecommendations(vibe, selectedMatch, screeningVenues, supportersBars, now);
    setRecs(computed);
    setStep(3);
    posthog.capture('wc_where_to_watch_used', {
      match_id: selectedMatch.id,
      vibe,
      result_bar_id: computed.primary?.id ?? null,
    });
  }

  function handleReset() {
    setStep(1);
    setSelectedMatch(null);
    setRecs(null);
  }

  return (
    <>
      <style>{`@keyframes wtSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div className="fixed inset-0 z-[500] bg-black/50" onClick={onClose} />
      <div
        className="fixed left-0 right-0 bottom-0 z-[501] max-h-[85vh] flex flex-col rounded-t-2xl shadow-2xl"
        style={{ background: '#fffbeb', animation: 'wtSlideUp 0.25s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {step === 1 && <MatchStep matches={matches} onSelect={handleMatchSelect} onClose={onClose} />}
        {step === 2 && <VibeStep onSelect={handleVibeSelect} onBack={() => setStep(1)} />}
        {step === 3 && recs && <ResultsStep recs={recs} onReset={handleReset} actions={{ screeningVenues, now, onShowVenue }} />}
      </div>
    </>
  );
}
