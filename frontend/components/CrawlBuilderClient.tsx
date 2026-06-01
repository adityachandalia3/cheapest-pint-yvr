'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { CrawlResult } from '@/app/api/crawl-builder/route';
import type { BarOption } from '@/app/crawl-builder/page';

const CrawlOutput = dynamic(() => import('./CrawlOutput'), { ssr: false });

const START_TIMES = [
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00',
];

const DAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export default function CrawlBuilderClient({
  bars,
  neighbourhoods,
}: {
  bars: BarOption[];
  neighbourhoods: string[];
}) {
  const [mode, setMode] = useState<'bar' | 'neighbourhood'>('neighbourhood');

  // Option A — start from a specific bar
  const [barSearch, setBarSearch] = useState('');
  const [selectedBar, setSelectedBar] = useState<BarOption | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Option B — pick a neighbourhood
  const [neighbourhood, setNeighbourhood] = useState('');

  // Shared
  const [barCount, setBarCount] = useState(4);
  const [startTime, setStartTime] = useState('18:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crawl, setCrawl] = useState<CrawlResult | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions =
    barSearch.length > 1
      ? bars
          .filter(
            b =>
              b.name.toLowerCase().includes(barSearch.toLowerCase()) ||
              (b.neighbourhood ?? '').toLowerCase().includes(barSearch.toLowerCase()),
          )
          .slice(0, 6)
      : [];

  function selectBar(bar: BarOption) {
    setSelectedBar(bar);
    setBarSearch(bar.name);
    setShowSuggestions(false);
  }

  function handleGPS() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        let closest: BarOption | null = null;
        let closestDist = Infinity;
        for (const bar of bars) {
          if (!bar.latitude || !bar.longitude) continue;
          const d = haversineKm(latitude, longitude, bar.latitude, bar.longitude);
          if (d < closestDist) { closestDist = d; closest = bar; }
        }
        if (closest) selectBar(closest);
        else setError('No nearby bars found.');
        setGpsLoading(false);
      },
      () => {
        setError('Could not get your location. Please search manually.');
        setGpsLoading(false);
      },
    );
  }

  const canBuild =
    !loading && (mode === 'neighbourhood' ? !!neighbourhood : !!selectedBar);

  async function handleBuild() {
    if (!canBuild) return;
    setLoading(true);
    setError(null);
    setCrawl(null);
    try {
      const day = DAY_SHORT[new Date().getDay()];
      const body =
        mode === 'neighbourhood'
          ? { neighbourhood, barCount, startTime, day }
          : { fixedBarId: selectedBar!.id, barCount, startTime, day };

      const res = await fetch('/api/crawl-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCrawl(data.crawl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      <header className="px-4 py-3 flex items-center gap-4 border-b border-[#F5A623]/10 bg-[#0d0d1a]">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-semibold shrink-0"
        >
          <span className="text-base">←</span>
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍺</span>
          <span className="font-black text-lg tracking-tight text-[#F5A623]">PINT MAP YVR</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none mb-3">
            Build My <span className="text-[#F5A623]">Crawl</span>
          </h1>
          <p className="text-gray-500 text-base">
            Tell us where and when — we'll plan your perfect bar crawl.
          </p>
        </div>

        <div className="bg-[#0d0d1a] border border-[#F5A623]/15 rounded-2xl p-6 sm:p-8 space-y-8">

          {/* Mode toggle */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-[#F5A623] mb-3">
              How do you want to start?
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#16213e] p-1.5 rounded-xl">
              <button
                onClick={() => setMode('bar')}
                className={`py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 ${
                  mode === 'bar'
                    ? 'bg-[#F5A623] text-[#0d0d1a] shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                📍 From a bar
              </button>
              <button
                onClick={() => setMode('neighbourhood')}
                className={`py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 ${
                  mode === 'neighbourhood'
                    ? 'bg-[#F5A623] text-[#0d0d1a] shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                🗺 By neighbourhood
              </button>
            </div>
          </div>

          {/* Option A: bar search + GPS */}
          {mode === 'bar' && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-[#F5A623] mb-3">
                Where are you starting?
              </label>
              <div className="flex gap-2">
                <div ref={searchRef} className="relative flex-1">
                  <input
                    type="text"
                    value={barSearch}
                    onChange={e => {
                      setBarSearch(e.target.value);
                      setSelectedBar(null);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Search bars..."
                    className="w-full bg-[#16213e] border border-[#F5A623]/20 focus:border-[#F5A623]/60 rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-colors placeholder-gray-600"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#16213e] border border-[#F5A623]/20 rounded-xl overflow-hidden z-10 shadow-2xl">
                      {suggestions.map(bar => (
                        <button
                          key={bar.id}
                          onMouseDown={() => selectBar(bar)}
                          className="w-full px-4 py-3 text-left hover:bg-[#1e2d4a] transition-colors border-b border-[#F5A623]/5 last:border-0"
                        >
                          <div className="text-white text-sm font-semibold">{bar.name}</div>
                          {bar.neighbourhood && (
                            <div className="text-gray-500 text-xs mt-0.5">{bar.neighbourhood}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* GPS button */}
                <button
                  onClick={handleGPS}
                  disabled={gpsLoading}
                  title="Use my current location"
                  className="shrink-0 bg-[#16213e] border border-[#F5A623]/20 hover:border-[#F5A623]/60 px-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {gpsLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-[#F5A623]/30 border-t-[#F5A623] rounded-full animate-spin" />
                  ) : (
                    <span className="text-lg leading-none">📍</span>
                  )}
                </button>
              </div>

              {selectedBar && (
                <p className="text-xs text-emerald-400 mt-2 font-semibold">
                  ✓ Starting at {selectedBar.name}
                  {selectedBar.neighbourhood ? ` · ${selectedBar.neighbourhood}` : ''}
                </p>
              )}
            </div>
          )}

          {/* Option B: neighbourhood dropdown */}
          {mode === 'neighbourhood' && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-[#F5A623] mb-3">
                Neighbourhood
              </label>
              <select
                value={neighbourhood}
                onChange={e => setNeighbourhood(e.target.value)}
                className="w-full bg-[#16213e] border border-[#F5A623]/20 focus:border-[#F5A623]/60 rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="">Pick a neighbourhood...</option>
                {neighbourhoods.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {/* Number of stops */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-black uppercase tracking-widest text-[#F5A623]">
                Number of Stops
              </label>
              <span className="text-2xl font-black text-white tabular-nums">
                {barCount} <span className="text-sm font-semibold text-gray-500">bars</span>
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={6}
              step={1}
              value={barCount}
              onChange={e => setBarCount(Number(e.target.value))}
              className="w-full accent-[#F5A623] cursor-pointer h-2 rounded-full"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1.5 px-0.5">
              <span>3</span><span>4</span><span>5</span><span>6</span>
            </div>
          </div>

          {/* Start time */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-[#F5A623] mb-3">
              Start Time
            </label>
            <div className="grid grid-cols-5 gap-2">
              {START_TIMES.map(t => (
                <button
                  key={t}
                  onClick={() => setStartTime(t)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all duration-150 border ${
                    startTime === t
                      ? 'bg-[#F5A623] text-[#0d0d1a] border-[#F5A623]'
                      : 'bg-[#16213e] text-gray-400 border-[#F5A623]/10 hover:border-[#F5A623]/40 hover:text-white'
                  }`}
                >
                  {formatTime(t)}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleBuild}
            disabled={!canBuild}
            className="w-full bg-[#F5A623] hover:bg-[#e8961a] disabled:opacity-40 disabled:cursor-not-allowed text-[#0d0d1a] font-black text-lg py-4 rounded-2xl transition-all duration-200 shadow-[0_0_30px_rgba(245,166,35,0.3)] hover:shadow-[0_0_40px_rgba(245,166,35,0.5)] hover:scale-[1.02]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-[#0d0d1a]/30 border-t-[#0d0d1a] rounded-full animate-spin" />
                Building your crawl...
              </span>
            ) : (
              '🍺 Build My Crawl'
            )}
          </button>
        </div>

        {error && (
          <p className="text-center text-red-400 text-sm mt-4">{error}</p>
        )}

        {!crawl && !loading && (
          <p className="text-center text-gray-700 text-xs mt-6">
            We'll pick the best bars, calculate happy hours, and map your route.
          </p>
        )}

        {crawl && <CrawlOutput crawl={crawl} onRebuild={() => setCrawl(null)} />}
      </div>
    </div>
  );
}
