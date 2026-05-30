'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface VibeResult {
  bar_id: string;
  bar_name: string;
  neighbourhood: string | null;
  match_reason: string;
  cheapest_price: number | null;
  is_happy_hour: boolean;
  tag: string | null;
}

function formatTag(tag: string): string {
  return tag.replace(/_/g, ' ');
}

export default function VibeSearch({
  isOpen,
  onClose,
  onShowOnMap,
}: {
  isOpen: boolean;
  onClose: () => void;
  onShowOnMap: (barId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VibeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
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
  }, [query, loading]);

  const handleShowOnMap = (barId: string) => {
    onShowOnMap(barId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-16 pb-6 px-4 bg-black/75 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-[#0d0d1a] rounded-2xl border border-[#F5A623]/25 shadow-2xl shadow-black/60 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F5A623]/10 shrink-0">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Find Your Vibe</h2>
            <p className="text-xs text-white/30 mt-0.5">Describe your night — we'll pick your bar</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {/* Search input */}
          <div className="flex items-center gap-3 bg-[#16213e] rounded-xl border border-[#F5A623]/20 focus-within:border-[#F5A623]/50 focus-within:shadow-[0_0_20px_rgba(245,166,35,0.1)] transition-all duration-300 px-4 py-3">
            <span className="text-xl flex-shrink-0 select-none">🍺</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="cheap pregame, cozy first date, loud sports bar..."
              className="flex-1 bg-transparent outline-none text-white placeholder-white/20 text-sm min-w-0"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="flex-shrink-0 bg-[#F5A623] hover:bg-[#e8961a] disabled:opacity-40 disabled:cursor-not-allowed text-black font-black px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Scanning
                </span>
              ) : 'Find My Bar'}
            </button>
          </div>

          {loading && (
            <p className="mt-4 text-center text-white/30 text-xs animate-pulse">
              Scanning bars across Vancouver for your perfect vibe...
            </p>
          )}

          {error && (
            <p className="mt-4 text-center text-red-400 text-sm">{error}</p>
          )}

          {results && results.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-xs text-white/25 text-center">Top {results.length} picks for tonight</p>
              {results.map((r, i) => (
                <div
                  key={r.bar_id}
                  className="bg-[#16213e] border border-[#F5A623]/15 hover:border-[#F5A623]/35 rounded-xl p-4 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-white text-sm leading-tight">{r.bar_name}</h3>
                        {r.tag && (
                          <span className="text-[10px] bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/25 px-1.5 py-0.5 rounded-full font-semibold capitalize">
                            {formatTag(r.tag)}
                          </span>
                        )}
                      </div>
                      {r.neighbourhood && (
                        <p className="text-xs text-white/30 mt-0.5">{r.neighbourhood}</p>
                      )}
                    </div>
                    <span className="shrink-0 w-6 h-6 rounded-full bg-[#F5A623]/10 flex items-center justify-center text-xs font-black text-[#F5A623]">
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-xs text-white/55 leading-relaxed mb-3">{r.match_reason}</p>
                  <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      {r.cheapest_price != null && (
                        <span className="text-[#F5A623] font-black text-lg leading-none">
                          ${Number(r.cheapest_price).toFixed(2)}
                        </span>
                      )}
                      <span className="text-[10px] text-white/25">cheapest pint</span>
                      {r.is_happy_hour && (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full font-semibold">
                          🍻 HH
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleShowOnMap(r.bar_id)}
                      className="text-xs text-[#F5A623]/60 hover:text-[#F5A623] border border-[#F5A623]/20 hover:border-[#F5A623]/50 px-2.5 py-1 rounded-lg transition-all font-semibold"
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
