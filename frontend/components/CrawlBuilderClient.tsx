'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import posthog from 'posthog-js';
import type { CrawlResult } from '@/app/api/crawl-builder/route';
import type { BarOption } from '@/app/crawl-builder/page';

const CrawlOutput = dynamic(() => import('./CrawlOutput'), { ssr: false });

// ─── Constants ────────────────────────────────────────────────────────────────

const VIBES = [
  { id: 'cheapest', emoji: '🍺', label: 'Cheapest Round' },
  { id: 'rowdy',    emoji: '⚡', label: 'Rowdy'          },
  { id: 'chill',    emoji: '😌', label: 'Chill'          },
  { id: 'sports',   emoji: '🏆', label: 'Sports'         },
  { id: 'mixed',    emoji: '🎲', label: 'Mixed'          },
] as const;
type VibeId = (typeof VIBES)[number]['id'];

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function CrawlBuilderClient({
  bars,
  neighbourhoods,
}: {
  bars: BarOption[];
  neighbourhoods: string[];
}) {
  const [mode, setMode] = useState<'bar' | 'neighbourhood'>('bar');

  // Option A
  const [barSearch, setBarSearch] = useState('');
  const [selectedBar, setSelectedBar] = useState<BarOption | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Option B
  const [neighbourhood, setNeighbourhood] = useState('');

  // Filters
  const [vibe, setVibe] = useState<VibeId>('mixed');
  const [budget, setBudget] = useState(30);

  // Shared
  const [barCount, setBarCount] = useState(4);
  const [startTime, setStartTime] = useState('18:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crawl, setCrawl] = useState<CrawlResult | null>(null);

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

  const budgetPerStop = Math.round(budget / barCount);
  const canBuild = !loading && (mode === 'neighbourhood' ? !!neighbourhood : !!selectedBar);

  async function handleBuild() {
    if (!canBuild) return;
    setLoading(true);
    setError(null);
    setCrawl(null);
    try {
      const day = DAY_SHORT[new Date().getDay()];
      const shared = { barCount, startTime, day, vibe, budget };
      const body =
        mode === 'neighbourhood'
          ? { ...shared, neighbourhood }
          : { ...shared, fixedBarId: selectedBar!.id };

      const res = await fetch('/api/crawl-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCrawl(data.crawl);
      posthog.capture('crawl_built', {
        neighbourhood: data.crawl.neighbourhood,
        stops: data.crawl.stops?.length ?? 0,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fef9f0] text-[#1c1917]">

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-black text-[#1c1917] tracking-tight leading-none mb-3">
            Build My <span className="text-[#B34207]">Crawl</span>
          </h1>
          <p className="text-stone-500 text-base">
            Tell us where and when — we&apos;ll plan your perfect bar crawl.
          </p>
        </div>

        <div className="bg-white border border-[#fde8c4] rounded-2xl p-6 sm:p-8 space-y-8 shadow-sm">

          {/* ── Mode toggle ────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-[#B34207] mb-3">
              How do you want to start?
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#fef9f0] p-1.5 rounded-xl border border-[#fde8c4]">
              <button
                onClick={() => setMode('bar')}
                className={`py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 ${
                  mode === 'bar'
                    ? 'bg-[#B34207] text-white shadow-sm'
                    : 'text-stone-500 hover:text-[#1c1917]'
                }`}
              >
                📍 From a bar
              </button>
              <button
                onClick={() => setMode('neighbourhood')}
                className={`py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 ${
                  mode === 'neighbourhood'
                    ? 'bg-[#B34207] text-white shadow-sm'
                    : 'text-stone-500 hover:text-[#1c1917]'
                }`}
              >
                🗺 By neighbourhood
              </button>
            </div>
          </div>

          {/* ── Option A: bar search + GPS ──────────────────────────────── */}
          {mode === 'bar' && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-[#B34207] mb-3">
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
                    className="w-full bg-[#fef9f0] border border-[#fde8c4] focus:border-[#B34207]/50 rounded-xl px-4 py-3.5 text-[#1c1917] text-sm outline-none transition-colors placeholder-stone-400"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#fde8c4] rounded-xl overflow-hidden z-10 shadow-lg">
                      {suggestions.map(bar => (
                        <button
                          key={bar.id}
                          onMouseDown={() => selectBar(bar)}
                          className="w-full px-4 py-3 text-left hover:bg-[#fff4e6] transition-colors border-b border-[#fde8c4] last:border-0"
                        >
                          <div className="text-[#1c1917] text-sm font-semibold">{bar.name}</div>
                          {bar.neighbourhood && (
                            <div className="text-stone-400 text-xs mt-0.5">{bar.neighbourhood}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleGPS}
                  disabled={gpsLoading}
                  title="Use my current location"
                  className="shrink-0 bg-[#fef9f0] border border-[#fde8c4] hover:border-[#B34207]/50 px-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {gpsLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-[#B34207]/30 border-t-[#B34207] rounded-full animate-spin" />
                  ) : (
                    <span className="text-lg leading-none">📍</span>
                  )}
                </button>
              </div>
              {selectedBar && (
                <p className="text-xs text-emerald-600 mt-2 font-semibold">
                  ✓ Starting at {selectedBar.name}
                  {selectedBar.neighbourhood ? ` · ${selectedBar.neighbourhood}` : ''}
                </p>
              )}
            </div>
          )}

          {/* ── Option B: neighbourhood dropdown ──────────────────────── */}
          {mode === 'neighbourhood' && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-[#B34207] mb-3">
                Neighbourhood
              </label>
              <select
                value={neighbourhood}
                onChange={e => setNeighbourhood(e.target.value)}
                className="w-full bg-[#fef9f0] border border-[#fde8c4] focus:border-[#B34207]/50 rounded-xl px-4 py-3.5 text-[#1c1917] text-sm outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="">Pick a neighbourhood...</option>
                {neighbourhoods.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── Vibe filter ────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-[#B34207] mb-3">
              What&apos;s the vibe tonight?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {VIBES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVibe(v.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all duration-150 ${
                    vibe === v.id
                      ? 'bg-[#B34207]/8 border-[#B34207]/60 text-[#1c1917] shadow-sm'
                      : 'bg-[#fef9f0] border-[#fde8c4] text-stone-500 hover:border-[#B34207]/30 hover:text-[#1c1917]'
                  } ${v.id === 'mixed' ? 'col-span-2 sm:col-span-1' : ''}`}
                >
                  <span className="text-xl leading-none">{v.emoji}</span>
                  <span className="text-[11px] font-black leading-tight">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Budget ─────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-black uppercase tracking-widest text-[#B34207]">
                Budget per person
              </label>
              <span className="text-2xl font-black text-[#1c1917] tabular-nums">${budget}</span>
            </div>
            <input
              type="range"
              min={15}
              max={80}
              step={5}
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              className="w-full accent-[#B34207] cursor-pointer h-2 rounded-full"
            />
            <div className="flex justify-between items-center text-xs mt-2">
              <span className="text-stone-400">$15</span>
              <span className="text-[#B34207]/70 font-semibold">
                Est. {barCount} rounds · ~${budgetPerStop}/pint
              </span>
              <span className="text-stone-400">$80</span>
            </div>
          </div>

          {/* ── Number of stops ────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-black uppercase tracking-widest text-[#B34207]">
                Number of Stops
              </label>
              <span className="text-2xl font-black text-[#1c1917] tabular-nums">
                {barCount} <span className="text-sm font-semibold text-stone-400">bars</span>
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={6}
              step={1}
              value={barCount}
              onChange={e => setBarCount(Number(e.target.value))}
              className="w-full accent-[#B34207] cursor-pointer h-2 rounded-full"
            />
            <div className="flex justify-between text-xs text-stone-400 mt-1.5 px-0.5">
              <span>3</span><span>4</span><span>5</span><span>6</span>
            </div>
          </div>

          {/* ── Start time ─────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-[#B34207] mb-3">
              Start Time
            </label>
            <div className="grid grid-cols-5 gap-2">
              {START_TIMES.map(t => (
                <button
                  key={t}
                  onClick={() => setStartTime(t)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all duration-150 border ${
                    startTime === t
                      ? 'bg-[#B34207] text-white border-[#B34207]'
                      : 'bg-[#fef9f0] text-stone-500 border-[#fde8c4] hover:border-[#B34207]/30 hover:text-[#1c1917]'
                  }`}
                >
                  {formatTime(t)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Submit ─────────────────────────────────────────────────── */}
          <button
            onClick={handleBuild}
            disabled={!canBuild}
            className="w-full bg-[#B34207] hover:bg-[#8f3506] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-2xl transition-all duration-200 shadow-[0_4px_24px_rgba(179,66,7,0.3)] hover:shadow-[0_6px_32px_rgba(179,66,7,0.45)] hover:scale-[1.02]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Building your crawl...
              </span>
            ) : (
              '🍺 Build My Crawl'
            )}
          </button>
        </div>

        {error && (
          <p className="text-center text-red-500 text-sm mt-4">{error}</p>
        )}

        {!crawl && !loading && (
          <p className="text-center text-stone-400 text-xs mt-6">
            We&apos;ll pick the best bars, calculate happy hours, and map your route.
          </p>
        )}

        {crawl && <CrawlOutput crawl={crawl} onRebuild={() => setCrawl(null)} />}
      </div>
    </div>
  );
}
