'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { BarWithActivePrice } from '@/lib/types';
import { formatPourSize, getDisplayName } from '@/lib/priceUtils';

const MEDALS = [
  { rank: 1, emoji: '🥇', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
  { rank: 2, emoji: '🥈', badge: 'bg-stone-100 text-stone-600 border-stone-300' },
  { rank: 3, emoji: '🥉', badge: 'bg-orange-100 text-orange-700 border-orange-300' },
];

const ROTATE_MS = 4000;
const SCALE_SIDE = 0.85;
const PEEK_MOBILE = 60;
const PEEK_DESKTOP = 160;

const CURATED_PHOTOS = [
  { match: 'cambie',    src: '/bar-photos/cambie.jpg' },
  { match: 'coco rico', src: '/bar-photos/coco-rico.jpg' },
  { match: 'the main',  src: '/bar-photos/main.jpg' },
  { match: 'mangos',    src: '/bar-photos/mangoes.jpg' },
  { match: 'gallery',   src: '/bar-photos/gallery-ubc.jpg' },
];

function getCuratedPhoto(barName: string) {
  return CURATED_PHOTOS.find(p => barName.toLowerCase().includes(p.match))?.src ?? null;
}

function fmt12h(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function HeroSection({
  topBars,
  simulatedTime,
  onTimeChange,
}: {
  topBars: BarWithActivePrice[];
  simulatedTime?: string | null;
  onTimeChange?: (t: string | null) => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingTime, setPendingTime] = useState(simulatedTime ?? '');
  const [timeError, setTimeError] = useState('');
  const [shareOpenIdx, setShareOpenIdx] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shareOpenIdx === null) return;
    function handler(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpenIdx(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareOpenIdx]);

  function isValidBarTime(t: string): boolean {
    const h = parseInt(t.split(':')[0], 10);
    return h >= 11 || h <= 2; // 11 AM → 2 AM
  }
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = Math.min(topBars.length, 3);

  useEffect(() => {
    if (paused || count < 2) return;
    const t = setInterval(() => setIndex(i => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, count]);

  const getCardStyle = useCallback((diff: number): React.CSSProperties => {
    if (containerWidth === 0) return { opacity: 0 };

    const isMobile = containerWidth < 768;
    const peek = isMobile ? PEEK_MOBILE : PEEK_DESKTOP;
    const cardWidth = containerWidth - 2 * peek;
    const sideOffset = containerWidth / 2 - peek + (cardWidth * SCALE_SIDE) / 2;

    if (diff === 0) {
      return { transform: 'translateX(0) scale(1)', zIndex: 10, filter: 'brightness(1)', opacity: 1 };
    }
    if (diff === 1) {
      return { transform: `translateX(${sideOffset}px) scale(${SCALE_SIDE})`, zIndex: 5, filter: 'brightness(0.4)', opacity: 1 };
    }
    if (count >= 3 && diff === count - 1) {
      return { transform: `translateX(${-sideOffset}px) scale(${SCALE_SIDE})`, zIndex: 5, filter: 'brightness(0.4)', opacity: 1 };
    }
    return { transform: `translateX(${diff <= count / 2 ? containerWidth * 2 : -containerWidth * 2}px) scale(${SCALE_SIDE})`, zIndex: 1, opacity: 0 };
  }, [containerWidth, count]);

  if (topBars.length === 0) {
    return (
      <section className="px-4 py-16 text-center text-stone-400 text-lg bg-[#fff4e6]">
        No bar data yet — run the scraper to populate prices.
      </section>
    );
  }

  const bars = topBars.slice(0, count);
  const isMobile = containerWidth > 0 ? containerWidth < 768 : true;
  const peek = isMobile ? PEEK_MOBILE : PEEK_DESKTOP;
  const cardWidth = containerWidth > 0 ? containerWidth - 2 * peek : 280;

  return (
    <section
      className="relative bg-[#fef9f0] border-b border-[#fde8c4]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Live label + time picker */}
      <div className="flex items-center justify-center gap-2 pt-3 pb-1 flex-wrap">
        {!simulatedTime && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
          {simulatedTime
            ? `Cheapest pints at ${fmt12h(simulatedTime)}`
            : 'Cheapest pints in Vancouver right now'}
        </span>

        {/* Time picker pill */}
        <div ref={pickerRef} className="relative">
          <button
            onClick={() => setPickerOpen(o => !o)}
            className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
              simulatedTime
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-[#fde8c4] text-stone-400 hover:border-[#B34207]/40 hover:text-stone-600'
            }`}
          >
            <span>⏰</span>
            <span>{simulatedTime ? fmt12h(simulatedTime) : 'Now'}</span>
          </button>

          {pickerOpen && (
            <div className="absolute top-full mt-1 right-0 bg-white border border-[#fde8c4] rounded-xl shadow-lg z-50 overflow-hidden min-w-[170px]">
              <button
                onMouseDown={e => {
                  e.preventDefault();
                  onTimeChange?.(null);
                  setPendingTime('');
                  setPickerOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-[#fff4e6] transition-colors text-[#1c1917] border-b border-[#fde8c4] flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block shrink-0" />
                Right Now
              </button>
              <div className="px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Pick a time</p>
                <div className="flex gap-1.5">
                  <input
                    type="time"
                    value={pendingTime}
                    onChange={e => { setPendingTime(e.target.value); setTimeError(''); }}
                    className="flex-1 text-xs border border-[#fde8c4] rounded-lg px-2 py-1.5 outline-none focus:border-[#B34207]/50 text-[#1c1917] bg-[#fef9f0]"
                  />
                  <button
                    onMouseDown={e => {
                      e.preventDefault();
                      if (!pendingTime) return;
                      if (!isValidBarTime(pendingTime)) {
                        setTimeError('11 AM – 2 AM only');
                        return;
                      }
                      onTimeChange?.(pendingTime);
                      setPickerOpen(false);
                      setTimeError('');
                    }}
                    disabled={!pendingTime}
                    className="text-[11px] font-black px-2.5 py-1.5 bg-[#B34207] text-white rounded-lg disabled:opacity-30 transition-opacity"
                  >
                    Set
                  </button>
                </div>
                {timeError && (
                  <p className="text-[9px] text-red-500 font-semibold mt-1">{timeError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulated time banner */}
      {simulatedTime && (
        <div className="mx-4 mb-1 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-center">
          <span className="text-[10px] font-semibold text-amber-700">
            Showing prices for {fmt12h(simulatedTime)} — prices may differ from current offers
          </span>
        </div>
      )}

      {/* Carousel stage */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden h-[300px] md:h-[460px] mt-1"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchStartX.current === null) return;
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) < 50) return;
          setPaused(true);
          setIndex(i => delta < 0 ? (i + 1) % count : (i - 1 + count) % count);
        }}
      >
        {bars.map((bar, i) => {
          const diff = (i - index + count) % count;
          const medal = MEDALS[i];
          const isActive = diff === 0;
          const photoSrc = getCuratedPhoto(bar.name) ?? (bar.google_place_id
            ? `/api/bar-photo?placeId=${encodeURIComponent(bar.google_place_id)}`
            : null);

          return (
            <div
              key={bar.id}
              onClick={() => { if (!isActive) { setIndex(i); setPaused(true); } }}
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                width: cardWidth,
                height: '100%',
                marginLeft: -cardWidth / 2,
                transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.5s ease, opacity 0.3s ease',
                cursor: isActive ? 'default' : 'pointer',
                ...getCardStyle(diff),
              }}
            >
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#fde8c4]/60 shadow-2xl">
                {photoSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoSrc}
                    alt={bar.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-8xl opacity-20">🍺</span>
                </div>
                {/* Bottom gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                {/* Rank badge */}
                <div className="absolute top-3 left-3">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${medal.badge}`}>
                    {medal.emoji} #{medal.rank} Cheapest
                  </span>
                </div>

                {/* Card content */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <div className="text-[2.5rem] md:text-[4.5rem] font-black leading-none tabular-nums">
                    ${bar.activePrice.toFixed(2)}
                  </div>
                  <div className="text-base md:text-2xl font-black mt-1 leading-tight">
                    {getDisplayName(bar.name)}
                  </div>
                  <div className="text-sm font-semibold opacity-75 mt-0.5">
                    {bar.neighbourhood ?? ''}
                  </div>
                  {bar.activeBeerName && (
                    <div className="text-xs opacity-55 mt-0.5">
                      {bar.activeBeerName}{formatPourSize(bar.activePourSize) ? ` · ${formatPourSize(bar.activePourSize)}` : ''}
                    </div>
                  )}
                  {bar.isHappyHour && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 bg-[#F5A623]/30 text-[#ffd580] border border-[#F5A623]/40">
                      🎉 Happy Hour Active
                    </span>
                  )}
                  <div
                    className="mt-2.5 transition-opacity duration-500 flex items-center gap-2 flex-wrap"
                    style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none' }}
                  >
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bar.name + ' ' + (bar.address ?? 'Vancouver BC'))}&query_place_id=${bar.google_place_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-black text-xs px-4 py-1.5 rounded-full bg-[#B34207] hover:bg-[#8f3506] text-white shadow-lg transition-colors whitespace-nowrap"
                      onClick={e => e.stopPropagation()}
                    >
                      📍 Get Directions
                    </a>
                    <button
                      className="inline-flex items-center gap-1.5 font-black text-xs px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-colors whitespace-nowrap"
                      onClick={async e => {
                        e.stopPropagation();
                        const shareText = `Found a $${bar.activePrice.toFixed(2)} pint in Vancouver 🍺 ${getDisplayName(bar.name)}${bar.neighbourhood ? ', ' + bar.neighbourhood : ''}. You're welcome. getbrewscanner.com`;
                        if (navigator.share) {
                          await navigator.share({ title: 'Cheapest Pint in Vancouver Right Now', text: shareText, url: 'https://getbrewscanner.com' });
                        } else {
                          setShareOpenIdx(shareOpenIdx === i ? null : i);
                        }
                      }}
                    >
                      🔗 Share This Deal
                    </button>
                  </div>
                </div>
              </div>

              {/* Share dropdown — outside overflow-hidden so it isn't clipped */}
              {shareOpenIdx === i && (
                <div
                  ref={shareRef}
                  className="absolute bottom-[84px] left-4 right-4 bg-white border border-[#fde8c4] rounded-xl shadow-xl z-20 overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  {(() => {
                    const shareText = `Found a $${bar.activePrice.toFixed(2)} pint in Vancouver 🍺 ${getDisplayName(bar.name)}${bar.neighbourhood ? ', ' + bar.neighbourhood : ''}. You're welcome. getbrewscanner.com`;
                    return (
                      <>
                        <button
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#1c1917] hover:bg-[#fef9f0] transition-colors flex items-center gap-2 border-b border-[#fde8c4]"
                          onClick={async () => {
                            await navigator.clipboard.writeText('https://getbrewscanner.com');
                            setShareCopied(true);
                            setTimeout(() => { setShareCopied(false); setShareOpenIdx(null); }, 2000);
                          }}
                        >
                          📋 {shareCopied ? 'Copied!' : 'Copy Link'}
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(shareText + '\nhttps://getbrewscanner.com')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShareOpenIdx(null)}
                          className="w-full block px-4 py-2.5 text-xs font-bold text-[#1c1917] hover:bg-[#fef9f0] transition-colors border-b border-[#fde8c4]"
                        >
                          💬 Share on WhatsApp
                        </a>
                        <a
                          href={`mailto:?subject=${encodeURIComponent('Cheapest Pint in Vancouver Right Now')}&body=${encodeURIComponent(shareText + '\nhttps://getbrewscanner.com')}`}
                          onClick={() => setShareOpenIdx(null)}
                          className="w-full block px-4 py-2.5 text-xs font-bold text-[#1c1917] hover:bg-[#fef9f0] transition-colors"
                        >
                          ✉️ Share via Email
                        </a>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 py-3">
        {bars.map((_, i) => (
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
      </div>
    </section>
  );
}
