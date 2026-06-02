'use client';

import { useEffect, useState } from 'react';
import { BarWithActivePrice } from '@/lib/types';
import { formatPourSize, getDisplayName } from '@/lib/priceUtils';

const MEDALS = [
  {
    rank: 1,
    emoji: '🥇',
    label: 'Gold',
    bg: 'from-[#fff9eb] to-[#fef9f0]',
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
    rankColor: '#b45309',
  },
  {
    rank: 2,
    emoji: '🥈',
    label: 'Silver',
    bg: 'from-[#f5f5f5] to-[#fef9f0]',
    badge: 'bg-stone-100 text-stone-600 border-stone-300',
    rankColor: '#6b7280',
  },
  {
    rank: 3,
    emoji: '🥉',
    label: 'Bronze',
    bg: 'from-[#fff0e6] to-[#fef9f0]',
    badge: 'bg-orange-100 text-orange-700 border-orange-300',
    rankColor: '#92400e',
  },
];

const ROTATE_MS = 4000;

const CURATED_PHOTOS: { match: string; src: string }[] = [
  { match: 'cambie',    src: '/bar-photos/cambie.jpg' },
  { match: 'coco rico', src: '/bar-photos/coco-rico.jpg' },
  { match: 'the main',  src: '/bar-photos/main.jpg' },
  { match: 'mangos',    src: '/bar-photos/mangoes.jpg' },
  { match: 'gallery',   src: '/bar-photos/gallery-ubc.jpg' },
];

function getCuratedPhoto(barName: string): string | null {
  const lower = barName.toLowerCase();
  return CURATED_PHOTOS.find(p => lower.includes(p.match))?.src ?? null;
}

export default function HeroSection({ topBars }: { topBars: BarWithActivePrice[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || topBars.length < 2) return;
    const t = setInterval(() => setIndex(i => (i + 1) % Math.min(topBars.length, 3)), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, topBars.length]);

  const bar = topBars[index];
  const medal = MEDALS[index];
  const photoSrc = bar
    ? (getCuratedPhoto(bar.name) ?? (bar.google_place_id
        ? `/api/bar-photo?placeId=${encodeURIComponent(bar.google_place_id)}`
        : null))
    : null;

  if (topBars.length === 0) {
    return (
      <section className="px-4 py-16 text-center text-stone-400 text-lg bg-[#fff4e6]">
        No bar data yet — run the scraper to populate prices.
      </section>
    );
  }

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    bar.name + ' ' + (bar.address ?? 'Vancouver BC')
  )}&query_place_id=${bar.google_place_id}`;

  return (
    <section
      className={`relative bg-gradient-to-br ${medal.bg} border-b border-[#fde8c4] transition-colors duration-700 overflow-hidden`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Mobile layout ─────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col px-4 pt-3 pb-4">
        {/* Live label */}
        <div className="shrink-0 flex items-center justify-center gap-2 mb-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
            Cheapest pints in Vancouver right now
          </span>
        </div>

        {/* Photo — fixed 220px, crops proportionally */}
        <div className="h-[220px] w-full shrink-0 relative rounded-2xl overflow-hidden bg-[#fde8c4]/60 shadow-lg">
          {photoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photoSrc}
              src={photoSrc}
              alt={bar.name}
              className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-6xl opacity-20">🍺</span>
          </div>
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${medal.badge}`}>
              {medal.emoji} #{medal.rank} Cheapest
            </span>
          </div>
        </div>

        {/* Details — compact, tight spacing so everything fits above the fold */}
        <div className="text-center mt-2.5">
          <div className="text-[2.75rem] font-black leading-none tabular-nums text-[#B34207]">
            ${bar.activePrice.toFixed(2)}
          </div>
          <h2 className="text-base font-black text-[#1c1917] leading-tight mt-0.5">
            {getDisplayName(bar.name)}
          </h2>
          <p className="text-sm font-black text-[#B34207] mt-0.5">{bar.neighbourhood ?? ''}</p>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {bar.activeBeerName
              ? `${bar.activeBeerName}${formatPourSize(bar.activePourSize) ? ` · ${formatPourSize(bar.activePourSize)}` : ''}`
              : ''}
          </p>

          {bar.isHappyHour && (
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full mt-1 bg-[#F5A623]/15 text-[#b45309] border border-[#F5A623]/40">
              🎉 Happy Hour Active
            </div>
          )}

          <div className="mt-2">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-black text-xs px-5 py-2 rounded-full bg-[#B34207] hover:bg-[#8f3506] text-white shadow-[0_4px_16px_rgba(179,66,7,0.3)] transition-colors"
            >
              📍 Get Directions
            </a>
          </div>

          <div className="flex items-center justify-center gap-2.5 mt-2">
            {topBars.slice(0, 3).map((_, i) => (
              <button
                key={i}
                onClick={() => { setIndex(i); setPaused(true); }}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: i === index ? 20 : 7,
                  height: 7,
                  background: i === index ? '#B34207' : '#1c191722',
                }}
                aria-label={`Show #${i + 1}`}
              />
            ))}
            <span className="text-[10px] text-stone-400 ml-1">Live prices</span>
          </div>
        </div>
      </div>

      {/* ── Desktop layout: original two-column ───────────────────────── */}
      <div className="hidden md:block max-w-5xl mx-auto px-4 py-20">
        <div className="flex flex-row gap-14 items-center">

          {/* Photo */}
          <div className="w-[44%] shrink-0">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#fde8c4]/60 shadow-xl">
              {photoSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photoSrc}
                  src={photoSrc}
                  alt={bar.name}
                  className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-6xl opacity-20">🍺</span>
              </div>
              <div className="absolute top-3 left-3">
                <span className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${medal.badge}`}>
                  {medal.emoji} #{medal.rank} Cheapest
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 text-left flex flex-col justify-center gap-0">
            <div className="flex items-center justify-start gap-2 mb-1">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-stone-500">
                Cheapest pints in Vancouver right now
              </span>
            </div>

            <div className="text-[9rem] font-black leading-none tabular-nums text-[#B34207]">
              ${bar.activePrice.toFixed(2)}
            </div>

            <h2 className="text-5xl font-black text-[#1c1917] leading-tight mt-1">
              {getDisplayName(bar.name)}
            </h2>

            <p className="text-base font-black mt-1 min-h-[22px] text-[#B34207]">
              {bar.neighbourhood ?? ''}
            </p>

            <p className="text-xs text-stone-400 mt-0.5 min-h-[16px]">
              {bar.activeBeerName
                ? `${bar.activeBeerName}${formatPourSize(bar.activePourSize) ? ` · ${formatPourSize(bar.activePourSize)}` : ''}`
                : ''}
            </p>

            {bar.isHappyHour && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full mt-2 bg-[#F5A623]/15 text-[#b45309] border border-[#F5A623]/40 self-start">
                🎉 Happy Hour Active
              </div>
            )}

            <div className="mt-3">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-black text-sm px-6 py-3 rounded-full transition-all duration-200 bg-[#B34207] hover:bg-[#8f3506] text-white shadow-[0_4px_20px_rgba(179,66,7,0.3)]"
              >
                📍 Get Directions
              </a>
            </div>

            <div className="flex items-center justify-start gap-3 mt-4">
              {topBars.slice(0, 3).map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setIndex(i); setPaused(true); }}
                  className="transition-all duration-300 rounded-full"
                  style={{
                    width: i === index ? 24 : 8,
                    height: 8,
                    background: i === index ? '#B34207' : '#1c191722',
                  }}
                  aria-label={`Show #${i + 1}`}
                />
              ))}
              <span className="text-[10px] text-stone-400 ml-1">Live prices</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
