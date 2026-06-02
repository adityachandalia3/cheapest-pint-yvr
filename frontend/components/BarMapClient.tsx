'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Bar, BeerCategory } from '@/lib/types';
import { enrichBarWithActivePrice, getDisplayName } from '@/lib/priceUtils';

const MapSection = dynamic(() => import('./MapSection'), { ssr: false });

const BEER_TYPES: { value: BeerCategory; label: string }[] = [
  { value: 'cheapest_beer', label: 'Beer' },
  { value: 'cheapest_lager', label: 'Lager' },
  { value: 'cheapest_ipa', label: 'IPA' },
];

function getVibeTag(bar: Bar): string | null {
  const vp = (bar as any).vibe_profile;
  if (!vp) return null;
  const tags: string[] = Array.isArray(vp) ? (vp[0]?.tags ?? []) : (vp.tags ?? []);
  return tags[0] ?? null;
}

function pill(active: boolean) {
  return `shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
    active
      ? 'bg-[#B34207] text-white border-[#B34207]'
      : 'bg-transparent text-stone-500 border-[#e8dcc8] hover:border-[#B34207]/40 hover:text-[#1c1917]'
  }`;
}

export default function BarMapClient({ initialBars }: { initialBars: Bar[] }) {
  const [now, setNow] = useState(() => new Date());
  const [neighbourhood, setNeighbourhood] = useState('');
  const [beerType, setBeerType] = useState<BeerCategory>('cheapest_beer');
  const [highlightedBarId, setHighlightedBarId] = useState<string | null>(null);
  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

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

  return (
    <div className="min-h-screen bg-[#fef9f0] text-[#1c1917]">
      {/* Page title */}
      <div className="px-4 pt-6 pb-3 max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-black text-[#1c1917] mb-0.5">🗺 All Bars</h1>
        <p className="text-stone-400 text-sm">Vancouver bars with live pint prices</p>
      </div>

      {/* Filter bar — pill row */}
      <div className="bg-white border-b border-[#e8dcc8] sticky top-12 md:top-14 z-40">
        <div
          className="flex gap-2 px-4 py-2.5 overflow-x-auto max-w-6xl mx-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          {/* Neighbourhood pill */}
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

          {BEER_TYPES.map(({ value, label }) => (
            <button key={value} onClick={() => setBeerType(value)} className={pill(beerType === value)}>
              {label}
            </button>
          ))}

          <span className="shrink-0 ml-auto self-center text-xs text-stone-400 font-semibold pr-1">
            {filteredBars.length} bars
          </span>
        </div>
      </div>

      {/* Map — scroll-margin-top clears the sticky headers when scrollIntoView fires */}
      <div ref={mapRef} className="scroll-mt-[92px] md:scroll-mt-[104px]">
        <MapSection
          bars={filteredBars}
          cheapestBarId={cheapestBarId}
          highlightedBarId={highlightedBarId}
          hoveredBarId={hoveredBarId}
          onBarSelect={handleMapPinClick}
          className="w-full h-[280px] md:h-[480px]"
        />
      </div>

      {/* Bar card grid */}
      <section className="max-w-6xl mx-auto px-3 py-6">
        <h2 className="text-base font-black text-[#1c1917] mb-4 px-1">
          All Bars <span className="text-[#B34207]">({filteredBars.length})</span>
        </h2>

        {filteredBars.length === 0 && (
          <p className="text-center text-stone-400 py-16">No bars match your filters.</p>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {filteredBars.map((bar, idx) => {
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
                {/* Mobile layout: price + name stacked tight */}
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

                  {/* Badges — hidden on mobile to save space */}
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

                {/* Mobile HH dot indicator */}
                {bar.isHappyHour && (
                  <div className="sm:hidden absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#F5A623]" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <footer className="text-center py-8 text-stone-400 text-xs border-t border-[#fde8c4] mt-4 bg-white">
        🍺 Pint Map YVR · Vancouver, BC
      </footer>
    </div>
  );
}
