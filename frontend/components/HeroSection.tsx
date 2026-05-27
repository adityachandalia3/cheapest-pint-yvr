'use client';

import { useEffect, useState } from 'react';
import { BarWithActivePrice } from '@/lib/types';

export default function HeroSection({ cheapestBar }: { cheapestBar: BarWithActivePrice | null }) {
  const [bar, setBar] = useState(cheapestBar);

  useEffect(() => {
    setBar(cheapestBar);
  }, [cheapestBar]);

  const directionsUrl = bar
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        bar.name + ' ' + (bar.address ?? 'Vancouver BC')
      )}&query_place_id=${bar.google_place_id}`
    : '#';

  return (
    <section className="relative bg-gradient-to-b from-[#0d0d1a] to-[#1a1a2e] px-4 py-14 md:py-24 text-center overflow-hidden">
      {/* Background beer mugs */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <span className="absolute top-6 left-6 text-7xl opacity-5">🍺</span>
        <span className="absolute bottom-6 right-6 text-7xl opacity-5">🍺</span>
        <span className="absolute top-1/2 left-4 -translate-y-1/2 text-5xl opacity-[0.03]">🍻</span>
        <span className="absolute top-1/2 right-4 -translate-y-1/2 text-5xl opacity-[0.03]">🍻</span>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        <p className="text-[#F5A623] font-bold text-xs tracking-[0.25em] uppercase mb-6">
          Cheapest Pint in Vancouver Right Now
        </p>

        {bar ? (
          <>
            <div className="text-[5.5rem] sm:text-[7rem] md:text-[10rem] font-black text-[#F5A623] leading-none mb-6 tabular-nums">
              ${bar.activePrice.toFixed(2)}
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-2 leading-tight">
              {bar.name}
            </h2>

            {bar.neighbourhood && (
              <p className="text-[#F5A623]/70 text-base md:text-lg font-semibold mb-3">
                {bar.neighbourhood}
              </p>
            )}

            {bar.activeBeerName && (
              <p className="text-gray-500 text-sm md:text-base mb-6">{bar.activeBeerName}</p>
            )}

            {bar.isHappyHour && (
              <div className="inline-flex items-center gap-2 bg-[#F5A623]/15 text-[#F5A623] text-sm font-bold px-4 py-2 rounded-full mb-6 border border-[#F5A623]/30">
                🎉 Happy Hour Active
              </div>
            )}

            <div className="mt-4">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#F5A623] text-[#1a1a2e] font-black text-base md:text-lg px-8 py-4 rounded-full hover:bg-amber-400 transition-colors shadow-lg shadow-[#F5A623]/20"
              >
                📍 Get Directions
              </a>
            </div>
          </>
        ) : (
          <div className="text-gray-500 text-xl py-12">
            No bar data yet — run the scraper to populate prices.
          </div>
        )}

        <p className="text-gray-700 text-xs mt-10">Live prices · Auto-refreshes every 5 min</p>
      </div>
    </section>
  );
}
