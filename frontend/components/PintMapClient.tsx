'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import HeroSection from './HeroSection';
import FilterBar from './FilterBar';

const Leaderboard = dynamic(() => import('./Leaderboard'), { ssr: false });
const MapSection = dynamic(() => import('./MapSection'), { ssr: false });

import { Bar, Filters } from '@/lib/types';
import { enrichBarWithActivePrice } from '@/lib/priceUtils';

export default function PintMapClient({ initialBars }: { initialBars: Bar[] }) {
  const [bars, setBars] = useState<Bar[]>(initialBars);
  const [now, setNow] = useState(() => new Date());
  const [filters, setFilters] = useState<Filters>({
    neighbourhood: '',
    beerType: 'cheapest_beer',
    happyHourOnly: false,
    sortBy: 'price',
  });
  const [highlightedBarId, setHighlightedBarId] = useState<string | null>(null);
  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null);

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

  // Listen for show-on-map events from SiteNav's VibeSearch
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

  const HERO_POUR_SIZES = new Set([14, 15, 16]);
  const PINT_POUR_SIZES = HERO_POUR_SIZES;

  const topThreeBars = useMemo(() => {
    return bars
      .map(b => enrichBarWithActivePrice(b, now))
      .filter(b =>
        b.activePrice !== Infinity &&
        b.activePourSize !== null &&
        HERO_POUR_SIZES.has(b.activePourSize)
      )
      .sort((a, b) => a.activePrice - b.activePrice)
      .slice(0, 3);
  }, [bars, now]);

  const filteredBars = useMemo(() => {
    return bars
      .map(b => enrichBarWithActivePrice(b, now, filters.beerType))
      .filter(b => {
        if (b.activePrice === Infinity) return false;
        if (b.activePourSize === null || !PINT_POUR_SIZES.has(b.activePourSize)) return false;
        if (filters.neighbourhood && b.neighbourhood !== filters.neighbourhood) return false;
        if (filters.happyHourOnly && !b.isHappyHour) return false;
        return true;
      })
      .sort((a, b) =>
        filters.sortBy === 'name'
          ? a.name.localeCompare(b.name)
          : a.activePrice - b.activePrice
      );
  }, [bars, now, filters]);

  const leaderboardBars = useMemo(() => filteredBars.slice(0, 10), [filteredBars]);

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

  // Map pin click → scroll down to leaderboard
  const handleMapPinClick = useCallback((barId: string | null) => {
    if (!barId) return;
    setHighlightedBarId(barId);
    leaderboardRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Leaderboard row click → scroll up to map
  const handleLeaderboardRowClick = useCallback((barId: string) => {
    setHighlightedBarId(barId);
    mapRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#fef9f0] text-[#1c1917]" suppressHydrationWarning>
      <HeroSection topBars={topThreeBars} />

      {/* FilterBar — sticky, sits below top nav on both mobile and desktop */}
      <div className="sticky top-12 md:top-14 z-40">
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          neighbourhoods={neighbourhoods}
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
        />
      </div>

      {/* Leaderboard */}
      <div ref={leaderboardRef}>
        <Leaderboard
          bars={leaderboardBars}
          highlightedBarId={highlightedBarId}
          onBarClick={handleLeaderboardRowClick}
          onBarHover={setHoveredBarId}
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

      <footer className="text-center py-8 text-stone-400 text-xs border-t border-[#fde8c4] mt-4 bg-white">
        🍺 Pint Map YVR · Vancouver, BC
      </footer>
    </div>
  );
}
