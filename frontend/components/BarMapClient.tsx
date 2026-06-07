'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Bar, BeerCategory } from '@/lib/types';
import { enrichBarWithActivePrice, getDisplayName, formatPourSize } from '@/lib/priceUtils';
import { useNearMe } from '@/lib/useNearMe';

const MapSection = dynamic(() => import('./MapSection'), { ssr: false });

const BEER_TYPES: { value: BeerCategory; label: string }[] = [
  { value: 'cheapest_beer', label: 'Beer' },
  { value: 'cheapest_lager', label: 'Lager' },
  { value: 'cheapest_ipa', label: 'IPA' },
];

const NEAR_ME_PAGE_SIZE = 25;

type BarWithVibe = Bar & { vibe_profile?: { tags?: string[] } | { tags?: string[] }[] | null };

function getVibeTag(bar: Bar): string | null {
  const vp = (bar as BarWithVibe).vibe_profile;
  if (!vp) return null;
  const tags: string[] = Array.isArray(vp) ? (vp[0]?.tags ?? []) : (vp.tags ?? []);
  return tags[0] ?? null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pill(active: boolean) {
  return `shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
    active
      ? 'bg-[#B34207] text-white border-[#B34207]'
      : 'bg-transparent text-stone-500 border-[#e8dcc8] hover:border-[#B34207]/40 hover:text-[#1c1917]'
  }`;
}

function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

export default function BarMapClient({ initialBars }: { initialBars: Bar[] }) {
  const [now, setNow] = useState(() => new Date());
  const [neighbourhood, setNeighbourhood] = useState('');
  const [beerType, setBeerType] = useState<BeerCategory>('cheapest_beer');
  const [highlightedBarId, setHighlightedBarId] = useState<string | null>(null);
  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null);
  const [nearMeVisible, setNearMeVisible] = useState(NEAR_ME_PAGE_SIZE);

  const nearMe = useNearMe(initialBars);

  const mapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  // Reset pagination when Near Me toggled
  useEffect(() => {
    setNearMeVisible(NEAR_ME_PAGE_SIZE);
  }, [nearMe.isActive]);

  const filteredBars = useMemo(() => {
    return initialBars
      .map(b => enrichBarWithActivePrice(b, now, beerType))
      .filter(b => {
        if (b.activePrice === Infinity) return false;
        if (neighbourhood && b.neighbourhood !== neighbourhood) return false;
        return true;
      })
      .sort((a, b) => a.activePrice - b.activePrice);
  }, [initialBars, now, beerType, neighbourhood]);

  // Near Me: all bars sorted by distance, enriched for price display (may be Infinity)
  const nearMeBars = useMemo(() => {
    if (!nearMe.isActive || !nearMe.userLocation) return [];
    const { lat, lng } = nearMe.userLocation;
    return initialBars
      .map(b => {
        const enriched = enrichBarWithActivePrice(b, now, beerType);
        const distKm = b.latitude !== null && b.longitude !== null
          ? haversineKm(lat, lng, b.latitude, b.longitude)
          : Infinity;
        return { ...enriched, distKm };
      })
      .sort((a, b) => a.distKm - b.distKm);
  }, [initialBars, now, beerType, nearMe.isActive, nearMe.userLocation]);

  const neighbourhoods = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of initialBars) {
      if (b.neighbourhood) counts[b.neighbourhood] = (counts[b.neighbourhood] ?? 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, n]) => n > 3)
      .map(([name]) => name)
      .sort();
  }, [initialBars]);

  const cheapestBarId = filteredBars[0]?.id ?? null;

  const handleMapPinClick = useCallback((barId: string | null) => {
    if (!barId) return;
    setHighlightedBarId(barId);
    const el = cardRefs.current[barId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleCardClick = useCallback((barId: string) => {
    setHighlightedBarId(barId);
    mapRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const displayBars = nearMe.isActive ? nearMeBars : filteredBars;
  const visibleBars = nearMe.isActive ? nearMeBars.slice(0, nearMeVisible) : filteredBars;
  const hasMore = nearMe.isActive && nearMeVisible < nearMeBars.length;

  return (
    <div className="min-h-screen bg-[#fef9f0] text-[#1c1917]">
      {/* Page title */}
      <div className="px-4 pt-6 pb-3 max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-black text-[#1c1917] mb-0.5">🗺 All Bars</h1>
        <p className="text-stone-400 text-sm">
          {nearMe.isActive
            ? `${nearMeBars.length} bars sorted by distance from you`
            : 'Vancouver bars with live pint prices'}
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-[#e8dcc8] sticky top-12 md:top-14 z-40">
        <div
          className="flex gap-2 px-4 py-2.5 overflow-x-auto max-w-6xl mx-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          {/* Near Me pill */}
          <button
            onClick={nearMe.toggle}
            disabled={nearMe.isLoading}
            className={pill(nearMe.isActive || nearMe.isLoading)}
          >
            {nearMe.isLoading ? '⏳ Locating…' : '📍 Near Me'}
          </button>

          {/* Neighbourhood pill — hidden when Near Me active */}
          {!nearMe.isActive && (
            <div className="relative shrink-0">
              <span className={pill(!!neighbourhood)}>
                {neighbourhood || 'All Neighbourhoods'}
              </span>
              <select
                value={neighbourhood}
                onChange={e => setNeighbourhood(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                aria-label="Neighbourhood"
              >
                <option value="">All Neighbourhoods</option>
                {neighbourhoods.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {BEER_TYPES.map(({ value, label }) => (
            <button key={value} onClick={() => setBeerType(value)} className={pill(beerType === value)}>
              {label}
            </button>
          ))}

          <span className="shrink-0 ml-auto self-center text-xs text-stone-400 font-semibold pr-1">
            {nearMe.isActive ? `${nearMeBars.length} bars` : `${filteredBars.length} bars`}
          </span>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="scroll-mt-[92px] md:scroll-mt-[104px]">
        <MapSection
          bars={nearMe.isActive ? nearMeBars.slice(0, nearMeVisible) : filteredBars}
          cheapestBarId={cheapestBarId}
          highlightedBarId={highlightedBarId}
          hoveredBarId={hoveredBarId}
          onBarSelect={handleMapPinClick}
          className="w-full h-[280px] md:h-[480px]"
          showResetView
          userLocation={nearMe.userLocation}
        />
      </div>

      {/* Bar list */}
      <section className="max-w-6xl mx-auto px-3 py-6">
        <h2 className="text-base font-black text-[#1c1917] mb-4 px-1">
          {nearMe.isActive ? '📍 Closest Bars to You' : 'All Bars'}{' '}
          <span className="text-[#B34207]">({displayBars.length})</span>
        </h2>

        {displayBars.length === 0 && !nearMe.isLoading && (
          <p className="text-center text-stone-400 py-16">
            {nearMe.isActive ? 'Getting your location…' : 'No bars match your filters.'}
          </p>
        )}

        {nearMe.isActive ? (
          /* Near Me grid — sorted by distance, includes no-price bars */
          <>
            <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              {visibleBars.map((bar, idx) => {
                const b = bar as typeof bar & { distKm: number };
                const hasPrice = b.activePrice !== Infinity;
                const isHighlighted = b.id === highlightedBarId;

                return (
                  <button
                    key={b.id}
                    ref={el => { cardRefs.current[b.id] = el; }}
                    onClick={() => handleCardClick(b.id)}
                    onMouseEnter={() => setHoveredBarId(b.id)}
                    onMouseLeave={() => setHoveredBarId(null)}
                    className={`relative text-left bg-white rounded-xl border transition-all duration-200 p-2 sm:p-4 hover:border-[#B34207]/40 hover:shadow-md ${
                      isHighlighted
                        ? 'border-[#B34207] shadow-md shadow-[#B34207]/10'
                        : 'border-[#fde8c4]'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      {/* Distance badge */}
                      <span className="text-[9px] sm:text-[11px] font-bold text-stone-400 leading-none mb-0.5">
                        📍 {fmtDist(b.distKm)}
                      </span>

                      {/* Price */}
                      {hasPrice ? (
                        <span className="text-sm sm:text-xl font-black text-[#B34207] tabular-nums leading-none">
                          ${b.activePrice.toFixed(2)}
                          {formatPourSize(b.activePourSize) && (
                            <span className="text-[9px] sm:text-xs font-semibold text-stone-400 ml-0.5">
                              {formatPourSize(b.activePourSize)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-xs font-semibold text-stone-300 leading-none">
                          No price
                        </span>
                      )}

                      <h3 className="font-black text-[#1c1917] text-[10px] sm:text-sm leading-tight line-clamp-2 mt-0.5">
                        {getDisplayName(b.name)}
                      </h3>

                      {b.neighbourhood && (
                        <p className="text-stone-400 text-[9px] sm:text-xs truncate leading-tight">
                          {b.neighbourhood}
                        </p>
                      )}

                      {/* HH badge — desktop only */}
                      {b.isHappyHour && (
                        <span className="hidden sm:inline-flex mt-1 text-[10px] bg-[#F5A623]/15 text-[#b45309] font-bold px-1.5 py-0.5 rounded-full border border-[#F5A623]/30 w-fit">
                          🎉 HH
                        </span>
                      )}
                    </div>

                    {/* Mobile HH dot */}
                    {b.isHappyHour && (
                      <div className="sm:hidden absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#F5A623]" />
                    )}
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <button
                onClick={() => setNearMeVisible(v => v + NEAR_ME_PAGE_SIZE)}
                className="w-full py-3 text-sm font-black text-[#B34207] border-2 border-[#B34207]/30 rounded-xl hover:bg-[#B34207]/5 transition-colors mt-4"
              >
                View More ({nearMeBars.length - nearMeVisible} remaining)
              </button>
            )}
          </>
        ) : (
          /* Normal grid */
          <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {filteredBars.map((bar) => {
              const vibeTag = getVibeTag(bar);
              const isHighlighted = bar.id === highlightedBarId;

              return (
                <button
                  key={bar.id}
                  ref={el => { cardRefs.current[bar.id] = el; }}
                  onClick={() => handleCardClick(bar.id)}
                  onMouseEnter={() => setHoveredBarId(bar.id)}
                  onMouseLeave={() => setHoveredBarId(null)}
                  className={`relative text-left bg-white rounded-xl border transition-all duration-200
                    p-2 sm:p-4
                    hover:border-[#B34207]/40 hover:shadow-md ${
                    isHighlighted
                      ? 'border-[#B34207] shadow-md shadow-[#B34207]/10'
                      : 'border-[#fde8c4]'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm sm:text-xl font-black text-[#B34207] tabular-nums leading-none">
                      ${bar.activePrice.toFixed(2)}
                    </span>
                    <h3 className="font-black text-[#1c1917] text-[10px] sm:text-sm leading-tight line-clamp-2">
                      {getDisplayName(bar.name)}
                    </h3>
                    {bar.neighbourhood && (
                      <p className="text-stone-400 text-[9px] sm:text-xs truncate leading-tight">
                        {bar.neighbourhood}
                      </p>
                    )}
                    <div className="hidden sm:flex items-center gap-1 mt-1 flex-wrap">
                      {bar.isHappyHour && (
                        <span className="text-[10px] bg-[#F5A623]/15 text-[#b45309] font-bold px-1.5 py-0.5 rounded-full border border-[#F5A623]/30">
                          🎉 HH
                        </span>
                      )}
                      {vibeTag && (
                        <span className="text-[10px] text-stone-400 font-semibold px-1.5 py-0.5 rounded-full border border-stone-200 capitalize">
                          {vibeTag.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {bar.activeBeerName && (
                      <p className="hidden sm:block text-stone-400 text-xs mt-0.5 truncate">
                        {bar.activeBeerName}
                      </p>
                    )}
                  </div>
                  {bar.isHappyHour && (
                    <div className="sm:hidden absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#F5A623]" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Near Me toast */}
      {nearMe.toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1c1917] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          📍 {nearMe.toast}
        </div>
      )}
    </div>
  );
}
