'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Bar } from '@/lib/types';
import type { MyNightBar } from '@/lib/myNightContext';

interface VibeResult {
  bar_id: string;
  bar_name: string;
  neighbourhood: string | null;
  match_reason: string;
  cheapest_price: number | null;
  is_happy_hour: boolean;
  tag: string | null;
  expense_rating: string | null;
}

function formatExpenseRating(rating: string): string | null {
  const lower = rating.toLowerCase();
  if (lower.includes('budget') || lower.includes('cheap') || lower.includes('inexpensive')) return '$ Budget';
  if (lower.includes('moderate') || lower.includes('mid')) return '$$ Moderate';
  if (lower.includes('pricey') || lower.includes('expensive') || lower.includes('premium')) return '$$$ Pricey';
  return null;
}

function formatTag(tag: string): string {
  return tag.replace(/_/g, ' ');
}

const VIBE_CHIPS = [
  { emoji: '🍺', label: 'Cheap pregame before Granville' },
  { emoji: '💫', label: 'Cozy first date, not too loud' },
  { emoji: '💎', label: 'Hidden local gem, no tourists' },
];

export { VIBE_CHIPS };

export default function VibeSearch({
  isOpen,
  onClose,
  onShowOnMap,
  initialQuery,
  bars,
  onAddToMyNight,
}: {
  isOpen: boolean;
  onClose: () => void;
  onShowOnMap: (barId: string) => void;
  initialQuery?: string;
  bars?: Bar[];
  onAddToMyNight?: (bar: MyNightBar) => 'added' | 'duplicate';
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VibeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setQuery(initialQuery);
        runSearch(initialQuery);
      } else {
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const runSearch = useCallback(async (q: string) => {
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch('/api/vibe-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.recommendations);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleSearch = useCallback(() => runSearch(query.trim()), [query, runSearch]);

  const handleShowOnMap = (barId: string) => {
    onShowOnMap(barId);
    onClose();
  };

  function directionsUrl(r: VibeResult): string {
    const rawBar = bars?.find(b => b.id === r.bar_id);
    if (rawBar?.latitude && rawBar?.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${rawBar.latitude},${rawBar.longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.bar_name + ' Vancouver BC')}`;
  }

  function handleAddToMyNight(r: VibeResult) {
    if (!onAddToMyNight) return;
    const rawBar = bars?.find(b => b.id === r.bar_id);
    const result = onAddToMyNight({
      id: r.bar_id,
      name: r.bar_name,
      neighbourhood: r.neighbourhood,
      price: r.cheapest_price,
      lat: rawBar?.latitude ?? null,
      lng: rawBar?.longitude ?? null,
    });
    if (result === 'added') {
      setAddedIds(prev => new Set(prev).add(r.bar_id));
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-16 pb-6 px-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-[#fde8c4] shadow-2xl shadow-black/20 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#fde8c4] shrink-0">
          <div>
            <h2 className="text-xl font-black text-[#1c1917] tracking-tight">Find Your Vibe</h2>
            <p className="text-xs text-stone-400 mt-0.5">Describe your night — we&apos;ll pick your bar</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-[#1c1917] hover:bg-stone-100 transition-all text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {/* Search input */}
          <div className="flex items-center gap-3 bg-[#fef9f0] rounded-xl border border-[#fde8c4] focus-within:border-[#B34207]/50 focus-within:shadow-[0_0_0_3px_rgba(179,66,7,0.08)] transition-all duration-300 px-4 py-3">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="cheap pregame, cozy first date, loud sports bar..."
              className="flex-1 bg-transparent outline-none text-[#1c1917] placeholder-stone-400 text-sm min-w-0"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="flex-shrink-0 bg-[#B34207] hover:bg-[#8f3506] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning
                </span>
              ) : 'Find My Bar'}
            </button>
          </div>

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {VIBE_CHIPS.map(chip => {
              const active = query === `${chip.emoji} ${chip.label}`;
              return (
                <button
                  key={chip.label}
                  onClick={() => {
                    setQuery(`${chip.emoji} ${chip.label}`);
                    inputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-200"
                  style={active
                    ? { background: '#B34207', color: '#fff', borderColor: '#B34207' }
                    : { background: '#fef9f0', color: '#78716c', borderColor: '#fde8c4' }
                  }
                >
                  <span>{chip.emoji}</span>
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {loading && (
            <p className="mt-4 text-center text-stone-400 text-xs animate-pulse">
              Scanning bars across Vancouver for your perfect vibe...
            </p>
          )}

          {error && (
            <p className="mt-4 text-center text-red-500 text-sm">{error}</p>
          )}

          {results && results.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-xs text-stone-400 text-center">Top {results.length} picks for tonight</p>
              {results.map((r, i) => (
                <div
                  key={r.bar_id}
                  className="vibe-card bg-[#fef9f0] border border-[#fde8c4] hover:border-[#B34207]/30 rounded-xl p-4 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-[#1c1917] text-sm leading-tight">{r.bar_name}</h3>
                        {r.tag && (
                          <span className="text-[10px] bg-[#F5A623]/10 text-[#b45309] border border-[#F5A623]/25 px-1.5 py-0.5 rounded-full font-semibold capitalize">
                            {formatTag(r.tag)}
                          </span>
                        )}
                      </div>
                      {r.neighbourhood && (
                        <p className="text-xs text-stone-400 mt-0.5">{r.neighbourhood}</p>
                      )}
                    </div>
                    <span className="shrink-0 w-6 h-6 rounded-full bg-[#B34207]/10 flex items-center justify-center text-xs font-black text-[#B34207]">
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed mb-2.5">{r.match_reason}</p>

                  {/* Price / HH badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-2.5">
                    {r.cheapest_price != null ? (
                      <>
                        <span className="text-[#B34207] font-black text-lg leading-none">
                          ${Number(r.cheapest_price).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-stone-400">cheapest pint</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] text-stone-400 italic">Price info unavailable</span>
                        {r.expense_rating && (
                          <span className="text-[10px] bg-stone-100 text-stone-500 border border-stone-200 px-1.5 py-0.5 rounded-full font-semibold">
                            {formatExpenseRating(r.expense_rating)}
                          </span>
                        )}
                      </>
                    )}
                    {r.is_happy_hour && (
                      <span className="text-[10px] bg-[#F5A623]/10 text-[#b45309] border border-[#F5A623]/25 px-1.5 py-0.5 rounded-full font-semibold">
                        🍻 HH
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-[#fde8c4]">
                    <a
                      href={directionsUrl(r)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg bg-[#B34207] hover:bg-[#8f3506] text-white transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      📍 Directions
                    </a>
                    {onAddToMyNight && (
                      <button
                        onClick={() => handleAddToMyNight(r)}
                        disabled={addedIds.has(r.bar_id)}
                        className={`inline-flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg border transition-all ${
                          addedIds.has(r.bar_id)
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-[#fef9f0] border-[#fde8c4] text-[#1c1917] hover:border-[#B34207]/40'
                        }`}
                      >
                        {addedIds.has(r.bar_id) ? '✓ Added' : '+ My Picks'}
                      </button>
                    )}
                    <button
                      onClick={() => handleShowOnMap(r.bar_id)}
                      className="ml-auto text-xs text-stone-400 hover:text-[#B34207] transition-colors font-semibold"
                    >
                      Show on map ↑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
