'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import type { WcMatch, SupportersBar, NeutralBarData } from './page';

// ---------------------------------------------------------------------------
// Carousel constants — match HeroSection patterns, adapted for match cards
// ---------------------------------------------------------------------------
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

function countdownLabel(matchDate: string, kickoffTime: string, now: Date): string {
  const diff = kickoffToUTC(matchDate, kickoffTime).getTime() - now.getTime();
  if (diff < -120 * 60 * 1000) return 'Finished';
  if (diff < 0) return 'In progress 🔴';
  const totalMins = Math.floor(diff / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `in ${mins}m`;
  if (hours < 24) return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

function getNeutralBarPrice(bar: NeutralBarData, now: Date): { price: number | null; isHH: boolean; hhEnd: string | null } {
  const dayAbbr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
  const timeStr = now.toLocaleTimeString('sv-SE', { timeZone: 'America/Vancouver' }).slice(0, 8);

  const activeWin = (bar.happy_hour_windows ?? []).find(w => {
    if (!w.days.map(d => d.toLowerCase()).includes(dayAbbr)) return false;
    const s = w.start_time.slice(0, 8);
    const e = w.end_time.slice(0, 8);
    return s <= e ? (timeStr >= s && timeStr <= e) : (timeStr >= s || timeStr <= e);
  });

  const isHH = !!activeWin;
  const hhEnd = activeWin ? activeWin.end_time.slice(0, 5) : null;

  let cheapest: number | null = null;
  for (const pp of bar.pint_prices ?? []) {
    const p = isHH && pp.happy_hour_price_cad ? pp.happy_hour_price_cad : pp.price_cad;
    if (p != null && (cheapest === null || p < cheapest)) cheapest = p;
  }

  return { price: cheapest, isHH, hhEnd };
}

function formatHHEnd(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}${m > 0 ? ':' + m.toString().padStart(2, '0') : ''}${ampm}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 mb-3">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{children}</span>
      </div>
      {right && <span className="text-[10px] text-[#a0855a] font-semibold">{right}</span>}
    </div>
  );
}

function BarRow({
  name,
  badge,
  badgeStyle,
  barId,
}: {
  name: string;
  badge: string;
  badgeStyle: string;
  barId?: string;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-2 py-2 px-1">
      <span className="text-xs font-semibold text-white/90 truncate">{name}</span>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${badgeStyle}`}>
        {badge}
      </span>
    </div>
  );

  if (barId) {
    return (
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' Vancouver BC')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:bg-white/10 rounded-lg transition-colors -mx-1 px-1"
      >
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

function MatchCard({ match, now }: { match: WcMatch; now: Date }) {
  const isVan = match.is_vancouver_match;
  const countdown = countdownLabel(match.match_date, match.kickoff_time, now);

  const neutralPrice = match.neutral_bar
    ? getNeutralBarPrice(match.neutral_bar, now)
    : null;

  const hasBars = match.supporters_bar || match.neutral_bar;

  const bgStyle: React.CSSProperties = {
    background: isVan
      ? 'linear-gradient(135deg, #92400e, #b45309, #78350f)'
      : 'linear-gradient(135deg, #1e3a8a, #1d4ed8, #312e81)',
  };

  return (
    <div className="w-full h-full rounded-2xl flex flex-col overflow-hidden shadow-lg" style={bgStyle}>
      {/* Header row */}
      <div className="flex items-start justify-between px-4 pt-3 pb-2">
        <div className="min-w-0">
          {match.group_label && (
            <p className="text-[11px] font-black uppercase tracking-widest text-yellow-400">{match.group_label}</p>
          )}
          {match.venue && (
            <p className="text-[10px] text-white/50 leading-tight mt-0.5 truncate max-w-[180px]">{match.venue}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isVan && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-white/20 text-white">
              🏟 Home match
            </span>
          )}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
            {formatKickoff(match.kickoff_time)}
          </span>
        </div>
      </div>

      {/* Teams row */}
      <div className="flex items-center justify-between px-6 py-2 flex-1">
        <div className="flex flex-col items-center gap-2 w-[38%]">
          <span className="text-6xl md:text-7xl leading-none drop-shadow-lg">{match.flag_home}</span>
          <span className="text-sm md:text-xl font-black text-white text-center leading-tight uppercase tracking-wide">{match.team_home}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-base md:text-2xl font-black text-white/30">vs</span>
          <span className="text-[10px] md:text-xs font-bold text-white/70 whitespace-nowrap bg-white/10 px-2 py-0.5 rounded-full">{countdown}</span>
        </div>
        <div className="flex flex-col items-center gap-2 w-[38%]">
          <span className="text-6xl md:text-7xl leading-none drop-shadow-lg">{match.flag_away}</span>
          <span className="text-sm md:text-xl font-black text-white text-center leading-tight uppercase tracking-wide">{match.team_away}</span>
        </div>
      </div>

      {/* Where fans are watching */}
      {hasBars && (
        <div className="px-4 pb-3 pt-2 mt-auto border-t border-white/10">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Where fans are watching</p>
          {match.supporters_bar && (
            <BarRow
              name={match.supporters_bar.name}
              badge={match.supporters_bar_label ?? '⚽ Supporters bar'}
              badgeStyle="bg-white/20 text-white"
              barId={match.supporters_bar.id}
            />
          )}
          {match.neutral_bar && neutralPrice && (
            <BarRow
              name={match.neutral_bar.name}
              badge={
                neutralPrice.price != null
                  ? neutralPrice.isHH
                    ? `$${neutralPrice.price.toFixed(2)} · 🟢 HH ends ${formatHHEnd(neutralPrice.hhEnd!)}`
                    : `$${neutralPrice.price.toFixed(2)} pint`
                  : 'Cheap pints'
              }
              badgeStyle="bg-emerald-400/20 text-emerald-300"
              barId={match.neutral_bar.id}
            />
          )}
        </div>
      )}
    </div>
  );
}

function NextMatchCard({ match }: { match: WcMatch }) {
  return (
    <div className="w-full h-full rounded-2xl flex flex-col items-center justify-center px-6 text-center gap-3 shadow-lg" style={{ background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8, #312e81)' }}>
      <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">No matches today — next up</p>
      <div className="flex items-center gap-6 md:gap-12">
        <div className="flex flex-col items-center gap-2">
          <span className="text-6xl md:text-9xl drop-shadow-lg">{match.flag_home}</span>
          <span className="text-xs md:text-xl font-black text-white uppercase tracking-wide">{match.team_home}</span>
        </div>
        <span className="text-base md:text-2xl font-black text-white/30">vs</span>
        <div className="flex flex-col items-center gap-2">
          <span className="text-6xl md:text-9xl drop-shadow-lg">{match.flag_away}</span>
          <span className="text-xs md:text-xl font-black text-white uppercase tracking-wide">{match.team_away}</span>
        </div>
      </div>
      <div className="text-xs text-white/60 font-semibold">
        {formatMatchDate(match.match_date)} · {formatKickoff(match.kickoff_time)}
        {match.venue && <><br /><span className="text-white/40">{match.venue}</span></>}
      </div>
    </div>
  );
}

function CountryDetail({ sb }: { sb: SupportersBar }) {
  const name = sb.bar?.name ?? sb.venue_name ?? sb.country;
  const hood = sb.bar?.neighbourhood ?? sb.neighbourhood;
  const mapsQuery = sb.bar
    ? `${sb.bar.name} Vancouver BC`
    : `${sb.venue_name ?? sb.country} Vancouver BC`;

  return (
    <div className="mt-2 mx-1 p-3 rounded-xl bg-[#fffbeb] border border-[#e8dcc8] animate-expandDown">
      <p className="text-sm font-black text-[#1c1410]">{name}</p>
      {hood && <p className="text-xs text-[#a0855a] mt-0.5">{hood}</p>}
      {sb.notes && <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">{sb.notes}</p>}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-2.5 text-xs font-black text-white bg-[#B34207] hover:bg-[#8f3506] px-3 py-1.5 rounded-lg transition-colors"
        onClick={() => posthog.capture('wc_supporters_bar_tapped', { country: sb.country })}
      >
        📍 Get Directions
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function WorldCupClient({
  todayMatches,
  nextMatch,
  supportersBars,
}: {
  todayMatches: WcMatch[];
  nextMatch: WcMatch | null;
  supportersBars: SupportersBar[];
}) {
  const matches = todayMatches.length > 0 ? todayMatches : (nextMatch ? [nextMatch] : []);
  const hasMatches = todayMatches.length > 0;
  const count = matches.length;

  const [index, setIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [expandedCountryId, setExpandedCountryId] = useState<string | null>(null);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [now, setNow] = useState(new Date());

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const hasSwiped = useRef(false);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ResizeObserver for carousel width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(e => setContainerWidth(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // PostHog page view
  useEffect(() => {
    posthog.capture('wc_page_viewed');
  }, []);

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

  const COUNTRIES_VISIBLE = 8;
  const visibleCountries = showAllCountries ? supportersBars : supportersBars.slice(0, COUNTRIES_VISIBLE);

  const todayStr = now.toLocaleDateString('en-US', {
    timeZone: 'America/Vancouver',
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-[#faf5eb] pb-24 md:pb-8">

      {/* ── Today's Matches — full-width carousel ────────────────────── */}
      <div className="pt-3 pb-2">

        {/* Label — sits flush above carousel */}
        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
            {hasMatches ? "Today's Matches" : 'Match Schedule'}
          </span>
          <span className="text-[10px] text-[#a0855a] font-semibold">
            {hasMatches
              ? `${todayStr} · ${todayMatches.length} match${todayMatches.length !== 1 ? 'es' : ''}`
              : todayStr}
          </span>
        </div>

        {/* Carousel stage — no max-w, full viewport width */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden h-[190px] md:h-[240px]"
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
          {matches.map((match, i) => {
            const diff = (i - index + count) % count;
            const isActive = diff === 0;
            return (
              <div
                key={match.id}
                onClick={() => { if (!isActive) setIndex(i); }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  width: cardWidth,
                  height: '100%',
                  marginLeft: -cardWidth / 2,
                  transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease',
                  cursor: isActive ? 'default' : 'pointer',
                  ...getCardStyle(diff),
                }}
              >
                {hasMatches
                  ? <MatchCard match={match} now={now} />
                  : nextMatch && <NextMatchCard match={nextMatch} />
                }
              </div>
            );
          })}
        </div>

        {/* Arrow buttons — desktop only */}
        {count > 1 && (
          <div className="relative">
            <button
              onClick={() => go(-1)}
              className="hidden md:flex absolute left-4 -top-[230px] w-10 h-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/20 transition-colors z-20"
              aria-label="Previous match"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              onClick={() => go(1)}
              className="hidden md:flex absolute right-4 -top-[230px] w-10 h-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/20 transition-colors z-20"
              aria-label="Next match"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}

        {/* Dot indicators */}
        {count > 1 && (
          <div className="flex items-center justify-center gap-2 pt-3">
            {matches.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: i === index ? 20 : 7,
                  height: 7,
                  background: i === index ? '#B34207' : '#1c191722',
                }}
                aria-label={`Match ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Below sections — constrained width ───────────────────────── */}
      <div className="max-w-2xl mx-auto">

        {/* ── Find Your Country's Bar ─────────────────────────────────── */}
        {supportersBars.length > 0 && (
          <div className="px-4 pt-3 pb-2">
            <SectionHeader>Find Your Country&apos;s Bar</SectionHeader>

            {/* Pills — compact, natural wrap */}
            <div className="flex flex-wrap gap-1.5">
              {visibleCountries.map(sb => (
                <button
                  key={sb.id}
                  onClick={() => {
                    posthog.capture('wc_supporters_bar_tapped', { country: sb.country });
                    setExpandedCountryId(id => id === sb.id ? null : sb.id);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold transition-all ${
                    expandedCountryId === sb.id
                      ? 'bg-[#B34207] text-white border-[#B34207]'
                      : 'bg-white border-[#e8dcc8] text-[#1c1910] hover:border-[#B34207]/40'
                  }`}
                >
                  <span>{sb.flag}</span>
                  <span>{sb.country}</span>
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-200 ${expandedCountryId === sb.id ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              ))}

              {!showAllCountries && supportersBars.length > COUNTRIES_VISIBLE && (
                <button
                  onClick={() => setShowAllCountries(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-[#e8dcc8] text-xs font-semibold text-[#a0855a] hover:border-[#B34207]/40 transition-colors"
                >
                  +{supportersBars.length - COUNTRIES_VISIBLE} more →
                </button>
              )}
            </div>

            {/* Expanded detail — appears below the entire pill row */}
            {expandedCountryId && (() => {
              const sb = supportersBars.find(s => s.id === expandedCountryId);
              return sb ? <CountryDetail sb={sb} /> : null;
            })()}
          </div>
        )}

        {/* ── Cheapest pint near a screening ──────────────────────────── */}
        <div className="px-4 pt-4 pb-2">
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
    </main>
  );
}
