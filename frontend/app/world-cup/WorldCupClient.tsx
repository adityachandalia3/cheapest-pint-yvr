'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import type { WcMatch, SupportersBar, NeutralBarData } from './page';
import { getTeamColors } from '@/lib/teamColors';

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

function getStatusBadge(matchDate: string, kickoffTime: string, now: Date, teamHome: string, isVan: boolean): string {
  const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'America/Vancouver' });
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  const tomorrowStr = nextDay.toLocaleDateString('sv-SE', { timeZone: 'America/Vancouver' });

  const kickoffUTC = kickoffToUTC(matchDate, kickoffTime);
  const twoHoursAfter = new Date(kickoffUTC.getTime() + 2 * 60 * 60 * 1000);
  const vanSuffix = isVan ? ' · BC PLACE' : '';

  if (now >= kickoffUTC && now <= twoHoursAfter) return `LIVE NOW 🔴${vanSuffix}`;
  if (matchDate === todayStr) return `TODAY · KICKOFF ${formatKickoff(kickoffTime)}${vanSuffix}`;
  if (matchDate === tomorrowStr) {
    if (matchDate === '2026-06-11' && teamHome === 'Mexico') return `TOMORROW · TOURNAMENT OPENER${vanSuffix}`;
    return `TOMORROW · ${formatKickoff(kickoffTime)}${vanSuffix}`;
  }
  return `${formatMatchDate(matchDate)} · ${formatKickoff(kickoffTime)}${vanSuffix}`;
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

function MatchCardInner({ match, now }: { match: WcMatch; now: Date }) {
  const isVan = match.is_vancouver_match;
  const homeColors = getTeamColors(match.team_home);
  const awayColors = getTeamColors(match.team_away);
  const status = getStatusBadge(match.match_date, match.kickoff_time, now, match.team_home, isVan);
  const neutralPrice = match.neutral_bar ? getNeutralBarPrice(match.neutral_bar, now) : null;
  const hasBars = !!(match.supporters_bar || match.neutral_bar);

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
            fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.09em',
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
            <span style={{ fontSize: 38, lineHeight: 1, filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.45))' }}>
              {match.flag_home}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 900, color: '#FFFFFF',
              textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2,
            }}>
              {match.team_home}
            </span>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.12)', borderRadius: 100,
            padding: '4px 10px', fontSize: 11, fontWeight: 900,
            color: 'rgba(255,255,255,0.7)', flexShrink: 0,
          }}>
            VS
          </div>

          <div className="flex flex-col items-center gap-1 w-[38%] text-center">
            <span style={{ fontSize: 38, lineHeight: 1, filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.45))' }}>
              {match.flag_away}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 900, color: '#FFFFFF',
              textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2,
            }}>
              {match.team_away}
            </span>
          </div>
        </div>

        {/* Kickoff line */}
        <div className="text-center" style={{ fontSize: 11 }}>
          <span style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>
            {formatMatchDate(match.match_date)} · {formatKickoff(match.kickoff_time)}
          </span>
          {match.venue && (
            <span style={{ color: 'rgba(255,255,255,0.55)' }}> · {match.venue}</span>
          )}
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
                  fontSize: 10, fontWeight: 700,
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
                  fontSize: 10, fontWeight: 700,
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
function MatchCard({ match, now }: { match: WcMatch; now: Date }) {
  return <MatchCardInner match={match} now={now} />;
}

// Standalone fallback variant — fills the carousel-equivalent area
function NextMatchCard({ match, now }: { match: WcMatch; now: Date }) {
  return (
    <div
      className="w-full overflow-hidden"
      style={{ borderRadius: 16, minHeight: 210, position: 'relative' }}
    >
      <MatchCardInner match={match} now={now} />
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
  const hasMatches = todayMatches.length > 0;
  const count = todayMatches.length;

  const [index, setIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [expandedCountryId, setExpandedCountryId] = useState<string | null>(null);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [now, setNow] = useState(new Date());

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

  const filteredSupportersBars = supportersBars.filter(
    sb => sb.country !== 'Italy' && sb.country !== 'Ireland'
  );
  const COUNTRIES_VISIBLE = 8;
  const visibleCountries = showAllCountries
    ? filteredSupportersBars
    : filteredSupportersBars.slice(0, COUNTRIES_VISIBLE);

  const todayStr = now.toLocaleDateString('en-US', {
    timeZone: 'America/Vancouver',
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
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
            {hasMatches ? "Today's Matches" : 'Match Schedule'}
          </span>
          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {hasMatches
              ? `${todayStr} · ${todayMatches.length} match${todayMatches.length !== 1 ? 'es' : ''}`
              : todayStr}
          </span>
        </div>

        {/* Carousel — only when matches today exist */}
        {hasMatches ? (
          <>
            <div
              ref={containerRef}
              className="relative w-full overflow-hidden h-[220px] md:h-[260px]"
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
              {todayMatches.map((match, i) => {
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
                    <MatchCard match={match} now={now} />
                  </div>
                );
              })}
            </div>

            {/* Arrow buttons — desktop only */}
            {count > 1 && (
              <div className="relative">
                <button
                  onClick={() => go(-1)}
                  className="hidden md:flex absolute left-4 -top-[250px] w-10 h-10 items-center justify-center rounded-full transition-colors z-20"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
                  aria-label="Previous match"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  onClick={() => go(1)}
                  className="hidden md:flex absolute right-4 -top-[250px] w-10 h-10 items-center justify-center rounded-full transition-colors z-20"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
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
              <div className="flex items-center justify-center gap-2 pt-2">
                {todayMatches.map((_, i) => (
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
        ) : nextMatch ? (
          /* Fallback — no matches today; px matches carousel PEEK_DESKTOP on desktop */
          <div className="px-4 md:px-[160px] py-1">
            <NextMatchCard match={nextMatch} now={now} />
          </div>
        ) : null}
      </div>

      {/* ── Constrained sections ──────────────────────────────────────── */}
      <div className="max-w-2xl md:max-w-3xl mx-auto pb-8">

        {/* Find Your Country's Bar */}
        {filteredSupportersBars.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <SectionHeader>Find Your Country&apos;s Bar</SectionHeader>

            <div className="flex flex-wrap gap-1.5">
              {visibleCountries.map(sb => (
                <button
                  key={sb.id}
                  onClick={() => {
                    posthog.capture('wc_supporters_bar_tapped', { country: sb.country });
                    setExpandedCountryId(id => id === sb.id ? null : sb.id);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold transition-all"
                  style={{
                    padding: '6px 10px', borderRadius: 100,
                    background: expandedCountryId === sb.id ? '#B34207' : 'rgba(255,255,255,0.10)',
                    border: expandedCountryId === sb.id
                      ? '1px solid #B34207'
                      : '1px solid rgba(255,255,255,0.22)',
                    color: '#FFFFFF',
                  }}
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

              {!showAllCountries && filteredSupportersBars.length > COUNTRIES_VISIBLE && (
                <button
                  onClick={() => setShowAllCountries(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{
                    padding: '6px 10px', borderRadius: 100,
                    background: 'transparent',
                    border: '1px dashed #FFD966',
                    color: '#FFD966',
                  }}
                >
                  +{filteredSupportersBars.length - COUNTRIES_VISIBLE} more →
                </button>
              )}
            </div>

            {expandedCountryId && (() => {
              const sb = filteredSupportersBars.find(s => s.id === expandedCountryId);
              return sb ? <CountryDetail sb={sb} /> : null;
            })()}
          </div>
        )}

        {/* Cheapest pint CTA — stays cream to bridge back to the main app */}
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
    </main>
  );
}
