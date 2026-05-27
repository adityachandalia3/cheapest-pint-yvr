'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import HeroSection from './HeroSection';
import FilterBar from './FilterBar';
import BarList from './BarList';
import { Bar, Filters } from '@/lib/types';
import { enrichBarWithActivePrice } from '@/lib/priceUtils';

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
  const mapRef = useRef<HTMLDivElement>(null);

  // Update current time every minute so happy hour status stays accurate
  useEffect(() => {
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

  // Globally cheapest bar across all categories — drives the hero
  const cheapestBar = useMemo(() => {
    return bars
      .map(b => enrichBarWithActivePrice(b, now))
      .filter(b => b.activePrice !== Infinity)
      .sort((a, b) => a.activePrice - b.activePrice)[0] ?? null;
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
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      <header className="px-4 py-3 flex items-center gap-2 border-b border-[#F5A623]/10 bg-[#0d0d1a]">
        <span className="text-2xl">🍺</span>
        <span className="font-black text-xl tracking-tight text-[#F5A623]">PINT MAP YVR</span>
        <span className="ml-auto text-xs text-gray-600 font-medium">Vancouver, BC</span>
      </header>

      <HeroSection cheapestBar={cheapestBar} />

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
          cheapestBarId={filteredBars[0]?.id ?? null}
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
