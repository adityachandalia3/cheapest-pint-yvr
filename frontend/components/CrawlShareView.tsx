'use client';

import dynamic from 'next/dynamic';
import type { CrawlResult, CrawlStop } from './CrawlOutput';

const CrawlMap = dynamic(
  () => import('./CrawlOutput').then(m => m.CrawlMap),
  { ssr: false }
);
const StopCard = dynamic(
  () => import('./CrawlOutput').then(m => m.StopCard),
  { ssr: false }
);

function googleMapsRouteUrl(stops: CrawlStop[]): string {
  const valid = stops.filter(s => s.bar.latitude && s.bar.longitude);
  if (valid.length === 0) return 'https://maps.google.com';
  const coords = valid.map(s => `${s.bar.latitude},${s.bar.longitude}`).join('/');
  return `https://www.google.com/maps/dir/${coords}`;
}

export default function CrawlShareView({ crawl }: { crawl: CrawlResult }) {
  const priceStops = crawl.stops.filter(s => s.active_price != null);
  const totalHours = Math.floor(crawl.total_duration_min / 60);
  const totalMins = crawl.total_duration_min % 60;
  const durationStr = totalHours > 0
    ? `${totalHours}h${totalMins > 0 ? ` ${totalMins}m` : ''}`
    : `${totalMins}m`;

  return (
    <main className="min-h-screen bg-[#fef9f0]">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <a href="/" className="text-xs font-black text-[#B34207] hover:underline tracking-wide">
              🍺 BREWSCANNER
            </a>
            <span className="text-stone-300">·</span>
            <span className="text-xs text-stone-400 font-semibold">Bar Crawl</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1c1917] leading-tight mb-2">
            {crawl.title}
          </h1>
          <p className="text-sm text-stone-400">
            {crawl.stops.length} stops · {durationStr} · {crawl.total_walking_km} km on foot
          </p>
        </div>

        {/* Map */}
        <div className="h-[300px] sm:h-[400px] rounded-2xl overflow-hidden border border-[#fde8c4] mb-6">
          <CrawlMap stops={crawl.stops} />
        </div>

        {/* Open in Google Maps */}
        <a
          href={googleMapsRouteUrl(crawl.stops)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 mb-8 rounded-xl bg-white border border-[#fde8c4] hover:border-[#B34207]/40 text-sm font-black text-[#1c1917] hover:text-[#B34207] transition-all"
        >
          📍 Open Full Route in Google Maps
        </a>

        {/* Stops */}
        <div className="space-y-0 mb-8">
          {crawl.stops.map(stop => (
            <StopCard key={stop.bar.id} stop={stop} />
          ))}
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <div className="bg-white border border-[#fde8c4] rounded-xl p-3 text-center">
            <p className="text-[#B34207] font-black text-lg">
              {priceStops.length > 0 ? `$${crawl.total_spend.toFixed(2)}` : '—'}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">
              {priceStops.length > 0 ? `est. spend (${priceStops.length} bars)` : 'no price data'}
            </p>
          </div>
          <div className="bg-white border border-[#fde8c4] rounded-xl p-3 text-center">
            <p className="text-[#B34207] font-black text-lg">{crawl.total_walking_km} km</p>
            <p className="text-[10px] text-stone-400 mt-0.5">total walking</p>
          </div>
          <div className="bg-white border border-[#fde8c4] rounded-xl p-3 text-center">
            <p className="text-[#B34207] font-black text-lg">{durationStr}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">total night</p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-white border border-[#fde8c4] rounded-2xl p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-[#B34207] mb-2">
            Want your own crawl?
          </p>
          <p className="text-stone-500 text-sm mb-4">
            Build a personalised bar crawl based on your vibe, budget, and neighbourhood.
          </p>
          <a
            href="/crawl-builder"
            className="inline-flex items-center gap-2 bg-[#B34207] hover:bg-[#8f3506] text-white font-black text-sm px-6 py-3 rounded-xl transition-colors shadow-[0_4px_16px_rgba(179,66,7,0.3)]"
          >
            🍺 Build Your Own Crawl
          </a>
        </div>

      </div>
    </main>
  );
}
