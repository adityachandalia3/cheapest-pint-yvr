'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import HeroSection from './HeroSection';
import FilterBar from './FilterBar';
import BarList from './BarList';
import VibeSearch from './VibeSearch';

const Leaderboard = dynamic(() => import('./Leaderboard'), { ssr: false });
import { Bar, Filters } from '@/lib/types';
import { enrichBarWithActivePrice, enrichBarForPourSize } from '@/lib/priceUtils';

const MapSection = dynamic(() => import('./MapSection'), { ssr: false });

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
  const [vibeOpen, setVibeOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  // Set time on mount and update every minute — null during SSR so server/client HTML matches
  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  // Refresh bar data every 5 minutes
  useEffect(() => {
    const refresh = setInterval(async () => {
      try {
        const res = await fetch('/api/bars');
        const { bars: fresh } = await res.json();
        if (fresh) setBars(fresh);
      } catch {
        // silently skip on network error
      }
    }, 5 * 60_000);
    return () => clearInterval(refresh);
  }, []);

  const HERO_POUR_SIZES = new Set([14, 15, 16]);

  // Top 3 cheapest bars — hero only shows standard draught pours (14/15/16oz)
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

  const leaderboard16oz = useMemo(() => {
    return bars
      .map(b => enrichBarForPourSize(b, now, 16))
      .filter(b => b.activePrice !== Infinity)
      .sort((a, b) => a.activePrice - b.activePrice)
      .slice(0, 10);
  }, [bars, now]);

  const leaderboard20oz = useMemo(() => {
    return bars
      .map(b => enrichBarForPourSize(b, now, 20))
      .filter(b => b.activePrice !== Infinity)
      .sort((a, b) => a.activePrice - b.activePrice)
      .slice(0, 5);
  }, [bars, now]);

  // Bars filtered and sorted for the current beer type selection
  const filteredBars = useMemo(() => {
    return bars
      .map(b => enrichBarWithActivePrice(b, now, filters.beerType))
      .filter(b => {
        if (b.activePrice === Infinity) return false;
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

  const neighbourhoods = useMemo(
    () => Array.from(new Set(bars.map(b => b.neighbourhood).filter(Boolean))).sort() as string[],
    [bars]
  );

  const handleBarCardClick = useCallback((barId: string) => {
    setHighlightedBarId(barId);
    mapRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white" suppressHydrationWarning>
      <header className="px-4 py-3 flex items-center gap-4 border-b border-[#F5A623]/10 bg-[#0d0d1a]">
        <span className="text-2xl shrink-0">🍺</span>
        <span className="font-black text-lg tracking-tight text-[#F5A623] shrink-0 hidden sm:block">PINT MAP YVR</span>

        {/* Fake search bar — opens vibe modal on click */}
        <button
          onClick={() => setVibeOpen(true)}
          className="ml-auto max-w-lg flex items-center gap-3 bg-[#16213e] hover:bg-[#1a2a4a] border border-[#F5A623]/25 hover:border-[#F5A623]/60 rounded-full px-4 py-2.5 transition-all duration-200 hover:shadow-[0_0_20px_rgba(245,166,35,0.15)] group"
        >
          <span className="text-[#F5A623]/60 text-base">✨</span>
          <span className="flex-1 text-left text-sm text-gray-500 group-hover:text-gray-400 transition-colors truncate">
            What&apos;s your vibe tonight? Cheap pregame, cozy date, sports bar...
          </span>
          <span className="shrink-0 bg-[#F5A623] text-[#1a1a2e] font-black text-xs px-3 py-1.5 rounded-full">
            Find
          </span>
        </button>
      </header>

      <VibeSearch
        isOpen={vibeOpen}
        onClose={() => setVibeOpen(false)}
        onShowOnMap={handleBarCardClick}
      />

      <HeroSection topBars={topThreeBars} />

      {/* Crawl Builder CTA */}
      <div className="flex justify-center px-4 py-6 bg-[#0d0d1a]">
        <Link
          href="/crawl-builder"
          className="inline-flex items-center gap-3 bg-[#F5A623] hover:bg-[#e8961a] text-[#0d0d1a] font-black text-lg px-8 py-4 rounded-2xl transition-all duration-200 shadow-[0_0_30px_rgba(245,166,35,0.35)] hover:shadow-[0_0_40px_rgba(245,166,35,0.55)] hover:scale-105"
        >
          🍺 Build My Crawl
        </Link>
      </div>

      <Leaderboard
        bars16oz={leaderboard16oz}
        bars20oz={leaderboard20oz}
        onBarClick={handleBarCardClick}
      />

      <div className="sticky top-0 z-50">
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          neighbourhoods={neighbourhoods}
        />
      </div>

      <div ref={mapRef}>
        <MapSection
          bars={filteredBars}
          cheapestBarId={topThreeBars[0]?.id ?? null}
          highlightedBarId={highlightedBarId}
          onBarSelect={setHighlightedBarId}
        />
      </div>

      <BarList
        bars={filteredBars}
        highlightedBarId={highlightedBarId}
        onBarClick={handleBarCardClick}
        beerType={filters.beerType}
      />

      <footer className="text-center py-8 text-gray-700 text-xs border-t border-[#F5A623]/10 mt-4">
        🍺 Pint Map YVR · Vancouver, BC
      </footer>
    </div>
  );
}
