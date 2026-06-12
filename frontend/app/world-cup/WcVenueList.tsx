'use client';

import { useState, useMemo, useEffect } from 'react';
import type { WcVenueBar, WcProfile } from './page';

const INITIAL_COUNT = 9;

// ── confidence sort helpers ──────────────────────────────────────────────────
function confidenceRank(profile: WcProfile | null): number {
  if (!profile) return 2;
  if (profile.confidence === 'high') return 0;
  if (profile.confidence === 'medium') return 1;
  return 2;
}

// ── happy hour + price helpers ───────────────────────────────────────────────
function vanTimeStr(now: Date): string {
  return now.toLocaleTimeString('sv-SE', { timeZone: 'America/Vancouver' });
}
function vanDay(now: Date): string {
  return now.toLocaleDateString('en-US', { timeZone: 'America/Vancouver', weekday: 'short' }).toLowerCase();
}
function windowActive(start: string, end: string, t: string): boolean {
  const s = start.slice(0, 8), e = end.slice(0, 8);
  return s <= e ? t >= s && t <= e : t >= s || t <= e;
}
export function isHHActive(bar: WcVenueBar, now: Date): boolean {
  if (!bar.happy_hour_windows.length) return false;
  const t = vanTimeStr(now), d = vanDay(now);
  return bar.happy_hour_windows.some(
    w => w.days.includes(d) && windowActive(w.start_time, w.end_time, t)
  );
}
export function cheapestPrice(bar: WcVenueBar, now: Date): number {
  const hh = isHHActive(bar, now);
  let min = Infinity;
  for (const pp of bar.pint_prices) {
    const p =
      hh && pp.happy_hour_price_cad != null
        ? Math.min(Number(pp.price_cad ?? Infinity), Number(pp.happy_hour_price_cad))
        : pp.price_cad != null
        ? Number(pp.price_cad)
        : Infinity;
    if (p < min) min = p;
  }
  return min;
}

// ── WC chips ─────────────────────────────────────────────────────────────────
const CHIP_STYLE = {
  display: 'inline-flex' as const,
  alignItems: 'center' as const,
  gap: 3,
  background: 'rgba(0,0,0,0.06)',
  border: '1px solid #e8dcc8',
  borderRadius: 999,
  padding: '3px 8px',
  fontSize: 10,
  color: '#5C4A2A',
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
};

function firstWords(text: string, n: number): string {
  return text.trim().split(/\s+/).slice(0, n).join(' ');
}

function WcChips({ profile }: { profile: WcProfile | null }) {
  if (!profile) return null;

  const chips: string[] = [];

  if (profile.screen_type && profile.screen_type !== 'null') {
    chips.push(`📺 ${firstWords(profile.screen_type, 3)}`);
  }

  if (chips.length < 3 && profile.booking_required === false) {
    chips.push('🚪 Walk-in');
  } else if (chips.length < 3 && profile.booking_required === true) {
    chips.push('📅 Book ahead');
  }

  if (chips.length < 3 && profile.opens_early === true) {
    chips.push('🌅 Early open');
  }

  if (chips.length < 3 && profile.special_features && profile.special_features !== 'null') {
    chips.push(`🎉 ${firstWords(profile.special_features, 2)}`);
  }

  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, overflow: 'hidden', marginTop: 6 }}>
      {chips.map((label, i) => (
        <span key={i} style={CHIP_STYLE}>{label}</span>
      ))}
    </div>
  );
}

// ── bottom sheet ─────────────────────────────────────────────────────────────
export type SelectedVenue = { bar: WcVenueBar; price: number; hhActive: boolean };

const BULLET = { fontSize: 13, color: '#5C4A2A', margin: '0 0 6px', lineHeight: 1.5 };

export function WcVenueSheet({ venue, onClose }: { venue: SelectedVenue; onClose: () => void }) {
  const { bar, price, hhActive } = venue;
  const p = bar.wc_profile;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bar.name + ' Vancouver BC')}`;

  return (
    <>
      <style>{`@keyframes wcSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-[500] bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[501] max-h-[85vh] flex flex-col rounded-t-2xl shadow-2xl"
        style={{ background: '#fffbeb', animation: 'wcSlideUp 0.25s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-3 border-b border-[#e8dcc8] shrink-0">
          <div className="min-w-0 pr-3">
            <h2 className="font-black text-[#1c1917] leading-tight" style={{ fontSize: 18 }}>
              {bar.name}
            </h2>
            {(bar.neighbourhood || price < Infinity) && (
              <p className="mt-1" style={{ fontSize: 13 }}>
                {bar.neighbourhood && (
                  <span style={{ color: '#a0855a' }}>{bar.neighbourhood}</span>
                )}
                {price < Infinity && (
                  <span style={{ color: '#B34207', fontWeight: 600 }}>
                    {bar.neighbourhood ? ' · ' : ''}
                    {hhActive ? '🎉 ' : ''}${price.toFixed(2)} pint{hhActive ? ' · Happy Hour' : ''}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-[#1c1917] hover:bg-stone-100 transition-all text-sm mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <WcChips profile={p} />

          {p && (
            <div className="mt-4">
              {p.screen_type && p.screen_type !== 'null' && (
                <p style={BULLET}>📺 {p.screen_type}</p>
              )}
              {p.booking_required === true && (
                <p style={BULLET}>
                  📅 Booking required{p.booking_notes ? ` · ${p.booking_notes}` : ''}
                </p>
              )}
              {p.booking_required === false && (
                <p style={BULLET}>🚪 Walk-ins welcome</p>
              )}
              {p.opens_early === true && (
                <p style={BULLET}>
                  🌅 Opens early for morning matches{p.opens_early_notes ? ` · ${p.opens_early_notes}` : ''}
                </p>
              )}
              {p.atmosphere && p.atmosphere !== 'null' && (
                <p style={BULLET}>🎭 {p.atmosphere} atmosphere</p>
              )}
              {p.capacity_notes && p.capacity_notes !== 'null' && (
                <p style={BULLET}>👥 {p.capacity_notes}</p>
              )}
              {p.special_features && p.special_features !== 'null' && (
                <p style={BULLET}>🎉 {p.special_features}</p>
              )}
              {p.match_day_deals && p.match_day_deals !== 'null' && (
                <p style={{ ...BULLET, margin: 0 }}>🍺 {p.match_day_deals}</p>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div
          className="px-5 py-4 border-t border-[#e8dcc8] flex gap-3 shrink-0"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        >
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center py-2.5 rounded-xl font-black text-sm text-white transition-colors hover:opacity-90"
            style={{ background: '#B34207' }}
          >
            📍 Get Directions →
          </a>
          <a
            href="/"
            className="flex-1 flex items-center justify-center py-2.5 rounded-xl font-black text-sm border border-[#e8dcc8] transition-colors hover:border-[#B34207]/40"
            style={{ background: 'white', color: '#1c1917' }}
          >
            🍺 View Bar →
          </a>
        </div>
      </div>
    </>
  );
}

// ── individual bar card ───────────────────────────────────────────────────────
function WcBarCard({
  bar,
  price,
  hhActive,
  onClick,
}: {
  bar: WcVenueBar;
  price: number;
  hhActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full bg-white rounded-xl border border-[#fde8c4] transition-all duration-200 hover:border-[#B34207]/40 hover:shadow-lg hover:shadow-[#B34207]/5 active:scale-[0.98] overflow-hidden"
      style={{ padding: 10 }}
    >
      <p className="font-semibold text-[#1c1917] truncate mb-0.5" style={{ fontSize: 13 }}>
        {bar.name}
      </p>
      <p className="truncate" style={{ fontSize: 11, marginBottom: 0 }}>
        {bar.neighbourhood && (
          <span style={{ color: '#a0855a' }}>{bar.neighbourhood}</span>
        )}
        {price < Infinity && (
          <span style={{ color: '#B34207', fontWeight: 500 }}>
            {bar.neighbourhood ? ' · ' : ''}${price.toFixed(2)}
          </span>
        )}
      </p>
      <WcChips profile={bar.wc_profile} />
    </button>
  );
}

// ── main export ───────────────────────────────────────────────────────────────
export default function WcVenueList({ venues }: { venues: WcVenueBar[] }) {
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenue | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const sorted = useMemo(
    () =>
      [...venues]
        .map(bar => ({
          bar,
          price: cheapestPrice(bar, now),
          hhActive: isHHActive(bar, now),
        }))
        .sort((a, b) => {
          const diff = confidenceRank(a.bar.wc_profile) - confidenceRank(b.bar.wc_profile);
          if (diff !== 0) return diff;
          const pa = a.price < Infinity ? a.price : 9999;
          const pb = b.price < Infinity ? b.price : 9999;
          return pa - pb;
        }),
    [venues, now]
  );

  const visible = showAll ? sorted : sorted.slice(0, INITIAL_COUNT);

  return (
    <div className="pb-8">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
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
          {venues.length} confirmed venues
        </span>
      </div>

      {venues.length === 0 ? (
        <p className="text-center py-8 px-4" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
          More venues being confirmed — check back soon 🍺
        </p>
      ) : (
        <>
          <div className="px-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map(({ bar, price, hhActive }) => (
              <WcBarCard
                key={bar.id}
                bar={bar}
                price={price}
                hhActive={hhActive}
                onClick={() => setSelectedVenue({ bar, price, hhActive })}
              />
            ))}
          </div>

          {!showAll && sorted.length > INITIAL_COUNT && (
            <div className="text-center pt-5">
              <button
                onClick={() => setShowAll(true)}
                className="text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                Show more venues → ({sorted.length - INITIAL_COUNT} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {selectedVenue && (
        <WcVenueSheet venue={selectedVenue} onClose={() => setSelectedVenue(null)} />
      )}
    </div>
  );
}
