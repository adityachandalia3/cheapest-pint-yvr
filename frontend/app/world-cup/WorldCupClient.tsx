'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import posthog from 'posthog-js';
import type { WcMatch, SupportersBar, NeutralBarData, WcScreeningBar, WcVenueBar } from './page';
import WcVenueList, { WcVenueSheet, SelectedVenue, cheapestPrice, isHHActive } from './WcVenueList';
import { getTeamColors } from '@/lib/teamColors';
import FeaturedVenuesCarousel from './FeaturedVenuesCarousel';

const WcScreeningMap = dynamic(() => import('./WcScreeningMap'), { ssr: false });

const LOADING_EMOJIS = ['🇲🇽', '🇨🇦', '🇺🇸', '🇧🇷', '🇩🇪', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇦🇷'];

const SCALE_SIDE = 0.92;
const OPACITY_SIDE = 0.55;
const PEEK_MOBILE = 28;
const PEEK_DESKTOP = 160;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatKickoff(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatMatchDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// Treat kickoff as Vancouver PDT (UTC-7) — valid for WC 2026 (Jun–Jul)
function kickoffToUTC(matchDate: string, kickoffTime: string): Date {
  const [y, mo, d] = matchDate.split('-').map(Number);
  const [h, min] = kickoffTime.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h + 7, min));
}

function getNeutralBarPrice(bar: NeutralBarData, now: Date): { price: number | null; isHH: boolean } {
  const dayAbbr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
  const timeStr = now.toLocaleTimeString('sv-SE', { timeZone: 'America/Vancouver' }).slice(0, 8);

  const activeWin = (bar.happy_hour_windows ?? []).find(w => {
    if (!w.days.map((d: string) => d.toLowerCase()).includes(dayAbbr)) return false;
    const s = w.start_time.slice(0, 8);
    const e = w.end_time.slice(0, 8);
    return s <= e ? (timeStr >= s && timeStr <= e) : (timeStr >= s || timeStr <= e);
  });

  const isHH = !!activeWin;
  let cheapest: number | null = null;
  for (const pp of bar.pint_prices ?? []) {
    const p = isHH && pp.happy_hour_price_cad ? pp.happy_hour_price_cad : pp.price_cad;
    if (p != null && (cheapest === null || p < cheapest)) cheapest = p;
  }
  return { price: cheapest, isHH };
}

const PRIORITY_COUNTRIES = ['Canada', 'England', 'Germany', 'Australia', 'Portugal'];

const LATAM_COUNTRIES = new Set([
  'Argentina', 'Brazil', 'Mexico', 'Colombia', 'Uruguay', 'Chile',
  'Ecuador', 'Peru', 'Bolivia', 'Venezuela', 'Paraguay',
  'Costa Rica', 'Honduras', 'Panama', 'El Salvador', 'Guatemala',
]);

type WatchPill =
  | { type: 'supporters'; flag: string; barName: string; mapsQuery: string }
  | { type: 'neutral'; barName: string; mapsQuery: string }
  | { type: 'fanpark' };

function getWatchWithFansPill(match: WcMatch, supportersBars: SupportersBar[]): WatchPill {
  // 1. Direct supporters bar match with priority
  const homeEntry = supportersBars.find(sb => sb.country === match.team_home && (sb.bar || sb.venue_name));
  const awayEntry = supportersBars.find(sb => sb.country === match.team_away && (sb.bar || sb.venue_name));

  let chosen: SupportersBar | null = null;
  if (homeEntry && awayEntry) {
    const hi = PRIORITY_COUNTRIES.indexOf(homeEntry.country);
    const ai = PRIORITY_COUNTRIES.indexOf(awayEntry.country);
    if (hi !== -1 && (ai === -1 || hi < ai)) chosen = homeEntry;
    else if (ai !== -1) chosen = awayEntry;
    else chosen = homeEntry;
  } else {
    chosen = homeEntry ?? awayEntry ?? null;
  }

  if (chosen) {
    const barName = chosen.bar?.name ?? chosen.venue_name ?? chosen.country;
    const mapsQuery = chosen.bar ? `${chosen.bar.name} Vancouver BC` : `${barName} Vancouver BC`;
    return { type: 'supporters', flag: chosen.flag, barName, mapsQuery };
  }

  // 2. Either team is Latin American → Latin festival
  const isLatam = LATAM_COUNTRIES.has(match.team_home) || LATAM_COUNTRIES.has(match.team_away);
  if (isLatam) {
    const latinEntry = supportersBars.find(sb => sb.country === 'Latin America');
    if (latinEntry) {
      const latamFlag = LATAM_COUNTRIES.has(match.team_home) ? match.flag_home : match.flag_away;
      return { type: 'supporters', flag: latamFlag, barName: 'Latincouver', mapsQuery: 'Latincouver Vancouver BC' };
    }
  }

  // 3. Match-specific neutral bar
  if (match.neutral_bar) {
    return { type: 'neutral', barName: match.neutral_bar.name, mapsQuery: `${match.neutral_bar.name} Vancouver BC` };
  }

  // 4. Fallback: FIFA Fan Park
  return { type: 'fanpark' };
}

function getStatusBadge(matchDate: string, kickoffTime: string, now: Date, isVan: boolean): string {
  const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'America/Vancouver' });
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  const tomorrowStr = nextDay.toLocaleDateString('sv-SE', { timeZone: 'America/Vancouver' });

  const kickoffUTC = kickoffToUTC(matchDate, kickoffTime);
  const twoHoursAfter = new Date(kickoffUTC.getTime() + 2 * 60 * 60 * 1000);
  const vanSuffix = isVan ? ' · BC PLACE' : '';

  if (now >= kickoffUTC && now <= twoHoursAfter) return `LIVE NOW 🔴${vanSuffix}`;
  if (matchDate === todayStr) return `TODAY · KICKOFF ${formatKickoff(kickoffTime)}${vanSuffix}`;
  if (matchDate === tomorrowStr) return `TOMORROW · ${formatKickoff(kickoffTime)}${vanSuffix}`;

  // Further out: "FRI JUN 12 · 12:00 PM"
  const [y, mo, d] = matchDate.split('-').map(Number);
  const localDate = new Date(y, mo - 1, d);
  const weekday = localDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const month   = localDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return `${weekday} ${month} ${d} · ${formatKickoff(kickoffTime)}${vanSuffix}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.92)' }}
        >
          {children}
        </span>
      </div>
      {right && (
        <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {right}
        </span>
      )}
    </div>
  );
}

function MatchCardInner({ match, now, supportersBars, fontScale = 1 }: { match: WcMatch; now: Date; supportersBars: SupportersBar[]; fontScale?: number }) {
  const s = (n: number) => n * fontScale;
  const isVan = match.is_vancouver_match;
  const homeColors = getTeamColors(match.team_home);
  const awayColors = getTeamColors(match.team_away);
  const status = getStatusBadge(match.match_date, match.kickoff_time, now, isVan);
  const neutralPrice = match.neutral_bar ? getNeutralBarPrice(match.neutral_bar, now) : null;
  const hasBars = !!(match.supporters_bar || match.neutral_bar);
  const watchPill = getWatchWithFansPill(match, supportersBars);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{
        borderRadius: 16,
        background: '#14110c',
        boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
        border: isVan ? '1.5px solid #FFD966' : undefined,
        position: 'relative',
      }}
    >
      {/* Glow circles */}
      <div style={{
        position: 'absolute', width: 110, height: 110, borderRadius: '50%',
        background: homeColors.secondary, filter: 'blur(46px)', opacity: 0.55,
        top: -20, left: -20, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 110, height: 110, borderRadius: '50%',
        background: awayColors.secondary, filter: 'blur(46px)', opacity: 0.55,
        bottom: -20, right: -20, pointerEvents: 'none',
      }} />

      {/* Diagonal gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
        background: `linear-gradient(115deg, ${homeColors.primary}CC 0%, ${homeColors.primary}55 28%, transparent 47%, transparent 53%, ${awayColors.primary}55 72%, ${awayColors.primary}CC 100%)`,
      }} />

      {/* Card content */}
      <div className="relative flex flex-col h-full px-4 py-3 gap-2">
        {/* Status badge — top centre */}
        <div className="flex justify-center">
          <span style={{
            fontSize: s(8), fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.09em',
            color: '#FFD966', background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,217,102,0.35)',
            borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap',
          }}>
            {status}
          </span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between flex-1 min-h-0 px-1">
          <div className="flex flex-col items-center gap-1 w-[38%] text-center">
            <span style={{ fontSize: s(32), lineHeight: 1, filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.45))' }}>
              {match.flag_home}
            </span>
            <span style={{
              fontSize: s(9), fontWeight: 900, color: '#FFFFFF',
              textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2,
            }}>
              {match.team_home}
            </span>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.12)', borderRadius: 100,
            padding: '4px 10px', fontSize: s(9), fontWeight: 900,
            color: 'rgba(255,255,255,0.7)', flexShrink: 0,
          }}>
            VS
          </div>

          <div className="flex flex-col items-center gap-1 w-[38%] text-center">
            <span style={{ fontSize: s(32), lineHeight: 1, filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.45))' }}>
              {match.flag_away}
            </span>
            <span style={{
              fontSize: s(9), fontWeight: 900, color: '#FFFFFF',
              textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2,
            }}>
              {match.team_away}
            </span>
          </div>
        </div>

        {/* Kickoff line */}
        <div className="text-center" style={{ fontSize: s(9) }}>
          <span style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>
            {formatMatchDate(match.match_date)} · {formatKickoff(match.kickoff_time)}
          </span>
          {match.venue && (
            <span style={{ color: 'rgba(255,255,255,0.55)' }}> · {match.venue}</span>
          )}
        </div>

        {/* Watch with fans pill */}
        <div className="flex justify-center overflow-hidden w-full">
          <a
            href={watchPill.type === 'fanpark'
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('FIFA Fan Park Vancouver BC')}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(watchPill.mapsQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display: 'inline-block',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              background: 'rgba(255,217,102,0.15)',
              border: '1px solid rgba(255,217,102,0.4)',
              color: '#FFD966',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: s(9),
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {watchPill.type === 'supporters'
              ? `🍺 Watch with fans ${watchPill.flag} ${watchPill.barName}`
              : watchPill.type === 'neutral'
              ? `📺 Showing this match · ${watchPill.barName}`
              : `📺 FIFA Fan Park · Official Fan Zone`}
          </a>
        </div>

        {/* Bar chips */}
        {hasBars && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {match.supporters_bar && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.supporters_bar.name + ' Vancouver BC')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  background: '#FFD966', color: '#14110c',
                  fontSize: s(9), fontWeight: 700,
                  padding: '3px 9px', borderRadius: 100,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                {match.supporters_bar_label ? `${match.supporters_bar_label} ` : '⚽ '}{match.supporters_bar.name}
              </a>
            )}
            {match.neutral_bar && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.neutral_bar.name + ' Vancouver BC')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: s(9), fontWeight: 700,
                  padding: '3px 9px', borderRadius: 100,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                {neutralPrice?.price != null ? `$${neutralPrice.price.toFixed(2)} · ` : ''}{match.neutral_bar.name}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Carousel variant — fills the full card slot
function MatchCard({ match, now, supportersBars, fontScale = 1 }: { match: WcMatch; now: Date; supportersBars: SupportersBar[]; fontScale?: number }) {
  return <MatchCardInner match={match} now={now} supportersBars={supportersBars} fontScale={fontScale} />;
}

function CountryDetail({ sb }: { sb: SupportersBar }) {
  const name = sb.bar?.name ?? sb.venue_name ?? sb.country;
  const hood = sb.bar?.neighbourhood ?? sb.neighbourhood;
  const mapsQuery = sb.bar
    ? `${sb.bar.name} Vancouver BC`
    : `${sb.venue_name ?? sb.country} Vancouver BC`;

  return (
    <div
      className="mt-2 mx-1 p-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
    >
      <p className="text-sm font-black" style={{ color: 'rgba(255,255,255,0.92)' }}>{name}</p>
      {hood && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{hood}</p>}
      {sb.notes && (
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {sb.notes}
        </p>
      )}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-2.5 text-xs font-black px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
        style={{ background: '#FFD966', color: '#14110c', textDecoration: 'none' }}
        onClick={() => posthog.capture('wc_supporters_bar_tapped', { country: sb.country })}
      >
        📍 Get Directions
      </a>
    </div>
  );
}

function SupportersBarSheet({
  sbs,
  onClose,
  onMoreInfo,
  screeningVenueIds,
}: {
  sbs: SupportersBar[];
  onClose: () => void;
  onMoreInfo?: (sb: SupportersBar) => void;
  screeningVenueIds: Set<string>;
}) {
  const { flag, country } = sbs[0];

  return (
    <>
      <style>{`@keyframes sbSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div className="fixed inset-0 z-[500] bg-black/50" onClick={onClose} />
      <div
        className="fixed left-0 right-0 bottom-0 z-[501] max-h-[80vh] flex flex-col rounded-t-2xl shadow-2xl"
        style={{ background: '#fffbeb', animation: 'sbSlideUp 0.25s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#e8dcc8] shrink-0">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 28, lineHeight: 1 }}>{flag}</span>
            <p className="font-black text-[#1c1917]" style={{ fontSize: 18 }}>{country}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-[#1c1917] hover:bg-stone-100 transition-all text-sm"
          >
            ✕
          </button>
        </div>

        {/* Bar cards */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          {sbs.map(sb => {
            const name = sb.bar?.name ?? sb.venue_name ?? sb.country;
            const hood = sb.bar?.neighbourhood ?? sb.neighbourhood;
            const mapsQuery = sb.bar ? `${sb.bar.name} Vancouver BC` : `${sb.venue_name ?? sb.country} Vancouver BC`;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
            const hasVenue = screeningVenueIds.has(sb.bar_id ?? '');

            return (
              <div key={sb.id} className="bg-white rounded-xl p-4 border border-[#e8dcc8]">
                <p className="font-black text-[#1c1917] mb-0.5" style={{ fontSize: 15 }}>{name}</p>
                {hood && <p className="text-xs mb-1" style={{ color: '#a0855a' }}>{hood}</p>}
                {sb.notes && (
                  <p className="text-sm leading-relaxed mt-1" style={{ color: '#5C4A2A' }}>{sb.notes}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => posthog.capture('wc_supporters_bar_tapped', { country: sb.country })}
                    className="flex-1 flex items-center justify-center py-2 rounded-xl font-black text-sm text-white transition-colors hover:opacity-90"
                    style={{ background: '#B34207' }}
                  >
                    📍 Directions →
                  </a>
                  {hasVenue && onMoreInfo && (
                    <button
                      onClick={() => onMoreInfo(sb)}
                      className="flex-1 flex items-center justify-center py-2 rounded-xl font-black text-sm border border-[#e8dcc8] transition-colors hover:border-[#B34207]/40"
                      style={{ background: 'white', color: '#1c1917' }}
                    >
                      🍺 More Info →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function WorldCupClient({
  todayMatches,
  upcomingMatches,
  supportersBars,
  screeningBars,
  screeningVenues,
}: {
  todayMatches: WcMatch[];
  upcomingMatches: WcMatch[];
  supportersBars: SupportersBar[];
  screeningBars: WcScreeningBar[];
  screeningVenues: WcVenueBar[];
}) {
  const [index, setIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedSbGroup, setSelectedSbGroup] = useState<SupportersBar[] | null>(null);
  const [selectedVenueSheet, setSelectedVenueSheet] = useState<SelectedVenue | null>(null);
  const [now, setNow] = useState(new Date());
  const [emojiIdx, setEmojiIdx] = useState(0);
  const [loadingVisible, setLoadingVisible] = useState(true);
  const [loadingFading, setLoadingFading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const hasSwiped = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(e => setContainerWidth(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    posthog.capture('wc_page_viewed');
  }, []);

  const loadingOnTrophy = emojiIdx === LOADING_EMOJIS.length;

  useEffect(() => {
    // one pass: 7 flags × 150ms = 1050ms, then trophy holds for 1s, then 300ms fade
    const flagDuration = LOADING_EMOJIS.length * 150;
    const interval = setInterval(() => setEmojiIdx(i => {
      if (i >= LOADING_EMOJIS.length) return i;
      return i + 1;
    }), 150);
    const fadeStart = setTimeout(() => setLoadingFading(true), flagDuration + 1000);
    const stop = setTimeout(() => { clearInterval(interval); setLoadingVisible(false); }, flagDuration + 1300);
    return () => { clearInterval(interval); clearTimeout(fadeStart); clearTimeout(stop); };
  }, []);

  // Remaining + live today (kickoff + 2h window has not closed)
  const remainingToday = todayMatches.filter(
    m => kickoffToUTC(m.match_date, m.kickoff_time).getTime() + 2 * 60 * 60 * 1000 > now.getTime()
  );
  // Pad with upcoming days until we have at least 3 cards
  const displayMatches = remainingToday.length >= 3
    ? remainingToday
    : [...remainingToday, ...upcomingMatches.slice(0, 3 - remainingToday.length)];
  const count = displayMatches.length;

  // Keep index in bounds if displayMatches shrinks (e.g. a match finishes)
  useEffect(() => {
    if (count > 0 && index >= count) setIndex(0);
  }, [count, index]);

  const isMobile = containerWidth > 0 ? containerWidth < 768 : true;
  const peek = isMobile ? PEEK_MOBILE : PEEK_DESKTOP;
  const cardWidth = containerWidth > 0 ? containerWidth - 2 * peek : 300;

  const getCardStyle = useCallback((diff: number): React.CSSProperties => {
    if (containerWidth === 0) return { opacity: 0 };
    const sideOffset = containerWidth / 2 - peek + (cardWidth * SCALE_SIDE) / 2;
    if (diff === 0) return { transform: 'translateX(0) scale(1)', opacity: 1, zIndex: 10 };
    if (diff === 1) return { transform: `translateX(${sideOffset}px) scale(${SCALE_SIDE})`, opacity: OPACITY_SIDE, zIndex: 5 };
    if (count >= 3 && diff === count - 1) return { transform: `translateX(-${sideOffset}px) scale(${SCALE_SIDE})`, opacity: OPACITY_SIDE, zIndex: 5 };
    return { transform: `translateX(${diff <= count / 2 ? containerWidth * 2 : -containerWidth * 2}px) scale(${SCALE_SIDE})`, opacity: 0, zIndex: 1 };
  }, [containerWidth, peek, cardWidth, count]);

  const go = useCallback((dir: 1 | -1) => {
    setIndex(i => (i + dir + count) % count);
    posthog.capture('wc_match_swiped', { direction: dir === 1 ? 'next' : 'prev' });
  }, [count]);

  // bar_id → { country, flag } for gold pin lookup
  const supportersBarMap = useMemo(() => {
    const map: Record<string, { country: string; flag: string }> = {};
    for (const sb of supportersBars) {
      if (sb.bar_id) map[sb.bar_id] = { country: sb.country, flag: sb.flag };
    }
    return map;
  }, [supportersBars]);

  const filteredSupportersBars = supportersBars.filter(
    sb => sb.country !== 'Italy' && sb.country !== 'Ireland'
  );

  const groupedSupportersBars = useMemo(() => {
    const map = new Map<string, SupportersBar[]>();
    for (const sb of filteredSupportersBars) {
      const list = map.get(sb.country) ?? [];
      list.push(sb);
      map.set(sb.country, list);
    }
    return Array.from(map.values());
  }, [filteredSupportersBars]);

  const screeningVenueIds = useMemo(
    () => new Set(screeningVenues.map(v => v.id)),
    [screeningVenues]
  );


  const todayStr = now.toLocaleDateString('en-US', {
    timeZone: 'America/Vancouver',
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <>
      {loadingVisible && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'linear-gradient(180deg, #0E1B3D 0%, #16275A 55%, #1B2C5C 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12,
          transition: 'opacity 0.3s ease',
          opacity: loadingFading ? 0 : 1,
        }}>
          {loadingOnTrophy ? (
            <img src="/wc-trophy.png" alt="World Cup Trophy" style={{ height: 56, width: 'auto' }} />
          ) : (
            <span style={{ fontSize: 56, lineHeight: 1 }}>{LOADING_EMOJIS[emojiIdx]}</span>
          )}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            Entering World Cup mode...
          </p>
        </div>
      )}
      <main
        style={{
          background: 'linear-gradient(180deg, #0E1B3D 0%, #16275A 55%, #1B2C5C 100%)',
          minHeight: '100vh',
        }}
      >
      {/* Festival ribbon */}
      <div style={{
        height: 4,
        background: 'linear-gradient(90deg, #006847, #CE1126, #FFB612, #007749, #2A4FD7, #B34207)',
        flexShrink: 0,
      }} />

      {/* ── Today's Matches ───────────────────────────────────────────── */}
      <div className="pt-3 pb-1">

        {/* Label row */}
        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.92)' }}
          >
            {remainingToday.length > 0 ? "Today's Matches" : 'Match Schedule'}
          </span>
          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {remainingToday.length > 0
              ? `${todayStr} · ${remainingToday.length} match${remainingToday.length !== 1 ? 'es' : ''}`
              : todayStr}
          </span>
        </div>

        {/* Carousel — always shown, minimum 3 cards */}
        {count > 0 && (
          <>
            <div
              ref={containerRef}
              className="relative w-full overflow-hidden h-[145px] md:h-[310px]"
              onTouchStart={e => { touchStartX.current = e.touches[0].clientX; hasSwiped.current = false; }}
              onTouchMove={e => {
                if (touchStartX.current === null) return;
                if (Math.abs(e.touches[0].clientX - touchStartX.current) > 10) hasSwiped.current = true;
              }}
              onTouchEnd={e => {
                if (touchStartX.current === null) return;
                const delta = e.changedTouches[0].clientX - touchStartX.current;
                touchStartX.current = null;
                if (!hasSwiped.current || Math.abs(delta) < 40) return;
                go(delta < 0 ? 1 : -1);
              }}
            >
              {displayMatches.map((match, i) => {
                const diff = (i - index + count) % count;
                const isActive = diff === 0;
                return (
                  <div
                    key={match.id}
                    onClick={() => { if (!isActive) setIndex(i); }}
                    style={{
                      position: 'absolute', top: 0, left: '50%',
                      width: cardWidth, height: '100%', marginLeft: -cardWidth / 2,
                      transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s ease',
                      cursor: isActive ? 'default' : 'pointer',
                      ...getCardStyle(diff),
                    }}
                  >
                    <MatchCard match={match} now={now} supportersBars={supportersBars} fontScale={isMobile ? 1 : 1.5} />
                  </div>
                );
              })}

              {/* Arrow buttons — inside carousel, always vertically centred */}
              {count > 1 && (
                <>
                  <button
                    onClick={() => go(-1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full transition-colors z-20"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
                    aria-label="Previous match"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => go(1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full transition-colors z-20"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
                    aria-label="Next match"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Dot indicators */}
            {count > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                {displayMatches.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className="transition-all duration-300 rounded-full"
                    style={{
                      width: i === index ? 20 : 7,
                      height: 7,
                      background: i === index ? '#FFD966' : 'rgba(255,255,255,0.3)',
                    }}
                    aria-label={`Match ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Featured Venues Carousel ────────────────────────────────── */}
      <div className="pt-2">
        <FeaturedVenuesCarousel />
      </div>

      {/* ── Find Your Country's Bar ──────────────────────────────────── */}
      {filteredSupportersBars.length > 0 && (
        <div className="pt-3 pb-1">
          <p className="px-4 text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Find Your Country&apos;s Bar
          </p>
          <div
            className="flex gap-2 overflow-x-auto px-4"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {groupedSupportersBars.map(group => (
              <button
                key={group[0].country}
                onClick={() => {
                  posthog.capture('wc_supporters_bar_tapped', { country: group[0].country });
                  setSelectedSbGroup(group);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold transition-all shrink-0"
                style={{
                  padding: '5px 10px', borderRadius: 100,
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  color: '#FFFFFF',
                }}
              >
                <span>{group[0].flag}</span>
                <span>{group[0].country}</span>
              </button>
            ))}
            <div className="w-4 shrink-0" />
          </div>
        </div>
      )}

      {/* ── WHERE TO WATCH map ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            >
              Where to Watch
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {screeningBars.length} confirmed venues
          </span>
        </div>
        <WcScreeningMap screeningBars={screeningBars} supportersBarMap={supportersBarMap} />
      </div>

      {/* ── Where to Watch — venue list ─────────────────────────────── */}
      <WcVenueList venues={screeningVenues} />

      {/* ── Cheapest pint CTA — mobile: inline card, desktop: fixed bottom bar ── */}
      <div className="md:hidden max-w-2xl mx-auto pb-8">
        <div className="px-4 pt-3 pb-4">
          <Link
            href="/"
            onClick={() => posthog.capture('wc_screening_cta_tapped')}
            className="block w-full rounded-2xl bg-[#fffbeb] border border-[#e8dcc8] hover:border-[#B34207]/40 transition-colors p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B34207]/10 flex items-center justify-center shrink-0">
                <span className="text-xl">📍</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-[#1c1410]">Cheapest pint near a screening</p>
                <p className="text-xs text-[#a0855a] mt-0.5">Match-day deals sorted by price, near you →</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
      <div
        className="hidden md:block sticky bottom-0 z-40"
        style={{ background: '#fffbeb', borderTop: '1px solid #e8dcc8' }}
      >
        <Link
          href="/"
          onClick={() => posthog.capture('wc_screening_cta_tapped')}
          className="flex items-center justify-between gap-4 px-8 py-3 hover:bg-[#fef3e2] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📍</span>
            <div>
              <p className="text-sm font-black text-[#1c1410]">Cheapest pint near a screening</p>
              <p className="text-xs text-[#a0855a]">Match-day deals sorted by price, near you</p>
            </div>
          </div>
          <span className="text-sm font-black text-[#B34207] whitespace-nowrap">Find deals →</span>
        </Link>
      </div>
    </main>

      {selectedSbGroup && (
        <SupportersBarSheet
          sbs={selectedSbGroup}
          onClose={() => setSelectedSbGroup(null)}
          screeningVenueIds={screeningVenueIds}
          onMoreInfo={sb => {
            const matchingVenue = screeningVenues.find(v => v.id === sb.bar_id);
            if (!matchingVenue) return;
            setSelectedSbGroup(null);
            setSelectedVenueSheet({
              bar: matchingVenue,
              price: cheapestPrice(matchingVenue, now),
              hhActive: isHHActive(matchingVenue, now),
            });
          }}
        />
      )}

      {selectedVenueSheet && (
        <WcVenueSheet venue={selectedVenueSheet} onClose={() => setSelectedVenueSheet(null)} />
      )}
    </>
  );
}
