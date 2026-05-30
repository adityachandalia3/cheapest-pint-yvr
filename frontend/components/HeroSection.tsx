'use client';

import { useEffect, useState } from 'react';
import { BarWithActivePrice } from '@/lib/types';
import { formatPourSize } from '@/lib/priceUtils';

const MEDALS = [
  {
    rank: 1,
    emoji: '🥇',
    label: 'Gold',
    color: '#FFD700',
    bg: 'from-[#3a2e00] to-[#1a1a2e]',
    badge: 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/40',
    price: 'text-[#FFD700]',
    button: 'bg-[#FFD700] text-[#1a1a2e] hover:bg-yellow-300',
    shadow: 'shadow-[#FFD700]/20',
  },
  {
    rank: 2,
    emoji: '🥈',
    label: 'Silver',
    color: '#C0C0C0',
    bg: 'from-[#252525] to-[#1a1a2e]',
    badge: 'bg-[#C0C0C0]/20 text-[#C0C0C0] border-[#C0C0C0]/40',
    price: 'text-[#C0C0C0]',
    button: 'bg-[#C0C0C0] text-[#1a1a2e] hover:bg-gray-300',
    shadow: 'shadow-[#C0C0C0]/10',
  },
  {
    rank: 3,
    emoji: '🥉',
    label: 'Bronze',
    color: '#CD7F32',
    bg: 'from-[#2e1a00] to-[#1a1a2e]',
    badge: 'bg-[#CD7F32]/20 text-[#CD7F32] border-[#CD7F32]/40',
    price: 'text-[#CD7F32]',
    button: 'bg-[#CD7F32] text-[#1a1a2e] hover:bg-amber-600',
    shadow: 'shadow-[#CD7F32]/10',
  },
];

const ROTATE_MS = 4000;

export default function HeroSection({ topBars }: { topBars: BarWithActivePrice[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || topBars.length < 2) return;
    const t = setInterval(() => setIndex(i => (i + 1) % Math.min(topBars.length, 3)), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, topBars.length]);

  if (topBars.length === 0) {
    return (
      <section className="px-4 py-16 text-center text-gray-500 text-lg bg-[#0d0d1a]">
        No bar data yet — run the scraper to populate prices.
      </section>
    );
  }

  const bar = topBars[index];
  const medal = MEDALS[index];

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    bar.name + ' ' + (bar.address ?? 'Vancouver BC')
  )}&query_place_id=${bar.google_place_id}`;

  return (
    <section
      className={`relative bg-gradient-to-b ${medal.bg} px-4 py-12 md:py-20 text-center overflow-hidden transition-all duration-700`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <span className="absolute top-6 left-6 text-7xl opacity-[0.04]">🍺</span>
        <span className="absolute bottom-6 right-6 text-7xl opacity-[0.04]">🍺</span>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Medal badge */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${medal.badge}`}
          >
            {medal.emoji} {medal.label} · #{medal.rank} Cheapest Pint Right Now
          </span>
        </div>

        {/* Price */}
        <div
          className={`text-[5rem] sm:text-[7rem] md:text-[9rem] font-black leading-none mb-5 tabular-nums transition-colors duration-700 ${medal.price}`}
        >
          ${bar.activePrice.toFixed(2)}
        </div>

        {/* Bar name */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-2 leading-tight">
          {bar.name}
        </h2>

        {bar.neighbourhood && (
          <p className="text-sm md:text-base font-semibold mb-2" style={{ color: medal.color + 'aa' }}>
            {bar.neighbourhood}
          </p>
        )}

        {bar.activeBeerName && (
          <p className="text-gray-500 text-sm mb-5">
            {bar.activeBeerName}
            {formatPourSize(bar.activePourSize) && (
              <span className="ml-2 text-gray-600">· {formatPourSize(bar.activePourSize)}</span>
            )}
          </p>
        )}

        {bar.isHappyHour && (
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full mb-5 border ${medal.badge}`}
          >
            🎉 Happy Hour Active
          </div>
        )}

        <div className="mt-2">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 font-black text-base px-7 py-3.5 rounded-full transition-colors shadow-lg ${medal.button} ${medal.shadow}`}
          >
            📍 Get Directions
          </a>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-3 mt-8">
          {topBars.slice(0, 3).map((_, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setPaused(true); }}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === index ? 24 : 8,
                height: 8,
                background: i === index ? MEDALS[i].color : '#ffffff22',
              }}
              aria-label={`Show #${i + 1}`}
            />
          ))}
        </div>

        <p className="text-gray-700 text-xs mt-5">Live prices · Auto-refreshes every 5 min</p>
      </div>
    </section>
  );
}
