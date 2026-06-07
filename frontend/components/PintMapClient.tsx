'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import HeroSection from './HeroSection';
import FilterBar from './FilterBar';
import VibeSearch, { VIBE_CHIPS } from './VibeSearch';
import { useMyNightContext } from '@/lib/myNightContext';
import { useNearMe } from '@/lib/useNearMe';

const Leaderboard = dynamic(() => import('./Leaderboard'), { ssr: false });
const MapSection = dynamic(() => import('./MapSection'), { ssr: false });

import { Bar, Filters } from '@/lib/types';
import { enrichBarWithActivePrice } from '@/lib/priceUtils';

const PINT_POUR_SIZES = new Set([14, 15, 16]);

export default function PintMapClient({ initialBars }: { initialBars: Bar[] }) {
  const [bars, setBars] = useState<Bar[]>(initialBars);
  const [now, setNow] = useState(() => new Date());
  const [filters, setFilters] = useState<Filters>({
    neighbourhood: '',
    beerType: 'cheapest_beer',
    happyHourOnly: false,
    sortBy: 'price',
  });
  const [simulatedTime, setSimulatedTime] = useState<string | null>(null);
  const [simulatedDay, setSimulatedDay] = useState<number | null>(null);
  const [highlightedBarId, setHighlightedBarId] = useState<string | null>(null);
  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null);
  const [vibeOpen, setVibeOpen] = useState(false);
  const [vibeQuery, setVibeQuery] = useState('');
  const { addBar } = useMyNightContext();

  const nearMe = useNearMe(bars);

  const effectiveNow = useMemo(() => {
    const d = new Date(now);
    if (simulatedDay !== null) {
      const diff = simulatedDay - d.getDay();
      d.setDate(d.getDate() + diff);
    }
    if (simulatedTime) {
      const [h, m] = simulatedTime.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  }, [now, simulatedTime, simulatedDay]);

  const mapRef = useRef<HTMLDivElement>(null);
  const leaderboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const refresh = setInterval(async () => {
      try {
        const res = await fetch('/api/bars');
        const { bars: fresh } = await res.json();
        if (fresh) setBars(fresh);
      } catch { /* silently skip */ }
    }, 5 * 60_000);
    return () => clearInterval(refresh);
  }, []);

  const handleBarCardClick = useCallback((barId: string) => {
    setHighlightedBarId(barId);
    mapRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const barId = (e as CustomEvent<string>).detail;
      if (barId) handleBarCardClick(barId);
    };
    window.addEventListener('pintmap:showBar', handler);
    return () => window.removeEventListener('pintmap:showBar', handler);
  }, [handleBarCardClick]);

  const topThreeBars = useMemo(() => {
    return bars
      .map(b => enrichBarWithActivePrice(b, effectiveNow, 'cheapest_beer'))
      .filter(b =>
        b.activePrice !== Infinity &&
        b.activePourSize !== null &&
        PINT_POUR_SIZES.has(b.activePourSize)
      )
      .sort((a, b) => a.activePrice - b.activePrice)
      .slice(0, 3);
  }, [bars, effectiveNow]);

  // Cheapest bars near the user — only computed when Near Me is active with a known radius
  const nearTopBars = useMemo(() => {
    if (!nearMe.isActive || nearMe.nearbyBarIds === null) return null;
    return bars
      .map(b => enrichBarWithActivePrice(b, effectiveNow, 'cheapest_beer'))
      .filter(b =>
        b.activePrice !== Infinity &&
        b.activePourSize !== null &&
        PINT_POUR_SIZES.has(b.activePourSize) &&
        nearMe.nearbyBarIds!.has(b.id)
      )
      .sort((a, b) => a.activePrice - b.activePrice)
      .slice(0, 3);
  }, [bars, effectiveNow, nearMe.isActive, nearMe.nearbyBarIds]);

  // Show nearby bars in hero only when radius ≤ 2km
  const heroNearMeActive = nearMe.isActive && !!nearMe.radiusKm && nearMe.radiusKm <= 2;
  // Show Vancouver fallback note when Near Me active but radius > 2km or all-Vancouver fallback
  const heroNearMeFallback = nearMe.isActive && (!nearMe.radiusKm || nearMe.radiusKm > 2);
  const heroTopBars = heroNearMeActive && nearTopBars && nearTopBars.length > 0
    ? nearTopBars
    : topThreeBars;

  const filteredBars = useMemo(() => {
    return bars
      .map(b => enrichBarWithActivePrice(b, effectiveNow, filters.beerType))
      .filter(b => {
        if (b.activePrice === Infinity) return false;
        if (b.activePourSize === null || !PINT_POUR_SIZES.has(b.activePourSize)) return false;
        if (filters.neighbourhood && b.neighbourhood !== filters.neighbourhood) return false;
        if (filters.happyHourOnly && !b.isHappyHour) return false;
        // Near Me filter — nearbyBarIds null means all-Vancouver fallback (no extra filter)
        if (nearMe.isActive && nearMe.nearbyBarIds !== null && !nearMe.nearbyBarIds.has(b.id)) return false;
        return true;
      })
      .sort((a, b) =>
        filters.sortBy === 'name'
          ? a.name.localeCompare(b.name)
          : a.activePrice - b.activePrice
      );
  }, [bars, effectiveNow, filters, nearMe.isActive, nearMe.nearbyBarIds]);

  const leaderboardBars = useMemo(() => filteredBars.slice(0, 10), [filteredBars]);

  // Bars that pass all filters but are NOT nearby — shown below the divider when Near Me is active
  const remainingBars = useMemo(() => {
    if (!nearMe.isActive || nearMe.nearbyBarIds === null) return [];
    return bars
      .map(b => enrichBarWithActivePrice(b, effectiveNow, filters.beerType))
      .filter(b => {
        if (b.activePrice === Infinity) return false;
        if (b.activePourSize === null || !PINT_POUR_SIZES.has(b.activePourSize)) return false;
        if (filters.neighbourhood && b.neighbourhood !== filters.neighbourhood) return false;
        if (filters.happyHourOnly && !b.isHappyHour) return false;
        return !nearMe.nearbyBarIds!.has(b.id);
      })
      .sort((a, b) =>
        filters.sortBy === 'name'
          ? a.name.localeCompare(b.name)
          : a.activePrice - b.activePrice
      )
      .slice(0, 10);
  }, [bars, effectiveNow, filters, nearMe.isActive, nearMe.nearbyBarIds]);

  const leaderboardRanks = useMemo(() => {
    const map: Record<string, number> = {};
    leaderboardBars.forEach((b, i) => { map[b.id] = i + 1; });
    return map;
  }, [leaderboardBars]);

  const neighbourhoods = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bars) {
      if (b.neighbourhood) counts[b.neighbourhood] = (counts[b.neighbourhood] ?? 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, n]) => n > 3)
      .map(([name]) => name)
      .sort();
  }, [bars]);

  const handleMapPinClick = useCallback((barId: string | null) => {
    if (!barId) return;
    setHighlightedBarId(barId);
    leaderboardRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleLeaderboardRowClick = useCallback((barId: string) => {
    setHighlightedBarId(barId);
    mapRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#fef9f0] text-[#1c1917]" suppressHydrationWarning>
      <HeroSection
        topBars={heroTopBars}
        simulatedTime={simulatedTime}
        simulatedDay={simulatedDay}
        onTimeChange={setSimulatedTime}
        onDayChange={setSimulatedDay}
        nearMeActive={heroNearMeActive}
        nearMeFallback={heroNearMeFallback}
        onNearMeToggle={nearMe.toggle}
        nearMeLoading={nearMe.isLoading}
      />

      {/* Find Your Vibe inline card */}
      <div className="px-4 pt-4 pb-1">
        <div className="bg-white rounded-2xl border border-[#fde8c4] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-[#B34207] flex items-center justify-center shrink-0 shadow-md">
              <span className="text-xl leading-none">✨</span>
            </div>
            <div>
              <h2 className="font-black text-[#1c1917] text-base leading-tight">Find Your Vibe</h2>
              <p className="text-xs text-[#B34207] mt-0.5">Describe your night, we&apos;ll find the bar</p>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 bg-[#fef9f0] border border-[#fde8c4] focus-within:border-[#B34207]/50 rounded-xl px-3 py-2.5 transition-all">
            <input
              value={vibeQuery}
              onChange={e => setVibeQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && vibeQuery.trim()) setVibeOpen(true); }}
              placeholder="e.g. lively sports bar with cheap pint..."
              className="flex-1 bg-transparent outline-none text-sm text-[#1c1917] placeholder-stone-400 min-w-0"
            />
            <button
              onClick={() => { if (vibeQuery.trim()) setVibeOpen(true); }}
              disabled={!vibeQuery.trim()}
              className="shrink-0 bg-[#1c1917] disabled:opacity-30 text-white font-black text-sm px-4 py-1.5 rounded-lg transition-colors"
            >
              Find
            </button>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {VIBE_CHIPS.map(chip => {
              const active = vibeQuery === chip.label;
              return (
                <button
                  key={chip.label}
                  onClick={() => { setVibeQuery(chip.label); setVibeOpen(true); }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-150"
                  style={active
                    ? { background: '#B34207', color: '#fff', borderColor: '#B34207' }
                    : { background: '#fef9f0', color: '#78716c', borderColor: '#fde8c4' }
                  }
                >
                  {chip.emoji} {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* FilterBar */}
      <div className="sticky top-12 md:top-14 z-40">
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          neighbourhoods={neighbourhoods}
          nearMe={nearMe.isActive}
          nearMeLoading={nearMe.isLoading}
          onNearMeToggle={nearMe.toggle}
        />
      </div>

      {/* Live Map divider */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#faf5eb] border-b border-[#e8dcc8]">
        <div className="flex-1 h-px bg-[#e8dcc8]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Live Map</span>
        <div className="flex-1 h-px bg-[#e8dcc8]" />
      </div>

      {/* Map */}
      <div ref={mapRef}>
        <MapSection
          bars={leaderboardBars}
          cheapestBarId={topThreeBars[0]?.id ?? null}
          highlightedBarId={highlightedBarId}
          hoveredBarId={hoveredBarId}
          ranks={leaderboardRanks}
          onBarSelect={handleMapPinClick}
          userLocation={nearMe.userLocation}
          showResetView
        />
      </div>

      {/* Leaderboard */}
      <div ref={leaderboardRef}>
        <Leaderboard
          bars={leaderboardBars}
          highlightedBarId={highlightedBarId}
          onBarClick={handleLeaderboardRowClick}
          onBarHover={setHoveredBarId}
          nearMeActive={nearMe.isActive}
          nearMeRadiusKm={nearMe.radiusKm}
          nearMeExpandedFrom={nearMe.expandedFrom}
          nearMeFallback={nearMe.isActive && nearMe.nearbyBarIds === null}
          remainingBars={remainingBars}
        />
      </div>

      {/* See all bars */}
      <div className="flex justify-center pb-8">
        <a
          href="/bar-map"
          className="inline-flex items-center gap-2 font-black text-sm px-7 py-3 rounded-full border-2 border-[#B34207] text-[#B34207] hover:bg-[#B34207] hover:text-white transition-all duration-200"
        >
          🗺 See all bars
        </a>
      </div>

      <VibeSearch
        isOpen={vibeOpen}
        onClose={() => { setVibeOpen(false); setVibeQuery(''); }}
        initialQuery={vibeQuery}
        bars={bars}
        onAddToMyNight={addBar}
        onShowOnMap={barId => {
          setVibeOpen(false);
          handleBarCardClick(barId);
        }}
      />

      {/* Near Me toast */}
      {nearMe.toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1c1917] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg pointer-events-none">
          📍 {nearMe.toast}
        </div>
      )}
    </div>
  );
}
