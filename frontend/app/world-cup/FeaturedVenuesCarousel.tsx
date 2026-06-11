'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type FeaturedVenue = {
  id: string;
  badge: string;
  name: string;
  description: string;
  cta: string;
  ctaHref: string;
  image: string;
  placeholderColor: string;
};

const FEATURED_VENUES: FeaturedVenue[] = [
  {
    id: 'blarney-stone',
    badge: '🤝 Partner',
    name: 'The Blarney Stone',
    description: "Gastown's home of the Southsiders 🇮🇪",
    cta: 'View Bar →',
    ctaHref: 'https://www.google.com/maps/search/?api=1&query=The+Blarney+Stone+Vancouver+BC',
    image: '/wc-featured/blarney-stone.jpg',
    placeholderColor: '#1a3a1a',
  },
  {
    id: 'latincouver',
    badge: '🌎 Community Hub',
    name: 'Latin Plaza Hub',
    description: 'Tribuna Latina — home for all Latin fans',
    cta: 'Get Directions →',
    ctaHref: 'https://www.google.com/maps/search/?api=1&query=Latin+Plaza+Hub+68+Water+Street+Vancouver+BC',
    image: '/wc-featured/latincouver.jpg',
    placeholderColor: '#6b1515',
  },
  {
    id: 'fifa-fan-festival',
    badge: '🏟️ Official FIFA',
    name: 'FIFA Fan Festival',
    description: 'Free entry · Hastings Park · Jun 11–Jul 19',
    cta: 'More Info →',
    ctaHref: 'https://www.vancouverfwc26.ca/fifa-fan-festival',
    image: '/wc-featured/fifa-fan-festival.webp',
    placeholderColor: '#0a1628',
  },
];

const SCALE_SIDE = 0.92;
const OPACITY_SIDE = 0.55;

export default function FeaturedVenuesCarousel() {
  const [index, setIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const hasSwiped = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(e => setContainerWidth(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = FEATURED_VENUES.length;
  // Mobile: card = 88% → peek = 6% each side
  // Desktop: card = 76% → peek = 12% each side
  const isMobile = containerWidth > 0 ? containerWidth < 768 : true;
  const peekFraction = isMobile ? 0.06 : 0.12;
  const peek = containerWidth * peekFraction;
  const cardWidth = containerWidth > 0 ? containerWidth - 2 * peek : 300;

  const getCardStyle = useCallback((diff: number): React.CSSProperties => {
    if (containerWidth === 0) return { opacity: 0 };
    const sideOffset = containerWidth / 2 - peek + (cardWidth * SCALE_SIDE) / 2;
    if (diff === 0) return { transform: 'translateX(0) scale(1)', opacity: 1, zIndex: 10 };
    if (diff === 1) return { transform: `translateX(${sideOffset}px) scale(${SCALE_SIDE})`, opacity: OPACITY_SIDE, zIndex: 5 };
    if (count >= 3 && diff === count - 1) return { transform: `translateX(-${sideOffset}px) scale(${SCALE_SIDE})`, opacity: OPACITY_SIDE, zIndex: 5 };
    return { transform: `translateX(${diff <= count / 2 ? containerWidth * 2 : -containerWidth * 2}px) scale(${SCALE_SIDE})`, opacity: 0, zIndex: 1 };
  }, [containerWidth, peek, cardWidth, count]);

  const go = useCallback((dir: 1 | -1) => {
    setIndex(i => (i + dir + count) % count);
  }, [count]);

  return (
    <div className="pt-2 pb-1 md:flex md:flex-col md:flex-1">
      {/* Section header — desktop only */}
      <div className="hidden md:flex items-center justify-between pb-2 max-w-2xl md:max-w-3xl mx-auto px-4">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.92)' }}
          >
            Featured Venues
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Swipe to explore →</span>
      </div>

      {/* Carousel */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden h-[180px] md:flex-1"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; hasSwiped.current = false; }}
        onTouchMove={e => {
          if (touchStartX.current === null) return;
          if (Math.abs(e.touches[0].clientX - touchStartX.current) > 10) hasSwiped.current = true;
        }}
        onTouchEnd={e => {
          if (touchStartX.current === null) return;
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (!hasSwiped.current || Math.abs(delta) < 40) return;
          go(delta < 0 ? 1 : -1);
        }}
      >
        {FEATURED_VENUES.map((venue, i) => {
          const diff = (i - index + count) % count;
          const isActive = diff === 0;
          return (
            <div
              key={venue.id}
              onClick={() => { if (!isActive) setIndex(i); }}
              style={{
                position: 'absolute', top: 0, left: '50%',
                width: cardWidth, height: '100%', marginLeft: -cardWidth / 2,
                transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s ease',
                cursor: isActive ? 'default' : 'pointer',
                ...getCardStyle(diff),
              }}
            >
              <VenueCard venue={venue} />
            </div>
          );
        })}

        {/* Arrow buttons — desktop only */}
        <button
          onClick={() => go(-1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full transition-colors z-20"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
          aria-label="Previous venue"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={() => go(1)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full transition-colors z-20"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
          aria-label="Next venue"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 pt-2">
        {FEATURED_VENUES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className="transition-all duration-300 rounded-full"
            style={{
              width: i === index ? 20 : 7,
              height: 7,
              background: i === index ? '#FFD966' : 'rgba(255,255,255,0.3)',
            }}
            aria-label={`Venue ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function VenueCard({ venue }: { venue: FeaturedVenue }) {
  return (
    <div
      style={{
        width: '100%', height: '100%',
        borderRadius: 14, overflow: 'hidden',
        position: 'relative',
        backgroundColor: venue.placeholderColor,
        backgroundImage: `linear-gradient(to top, rgba(20,17,12,0.9) 0%, rgba(20,17,12,0.55) 40%, rgba(20,17,12,0.1) 100%), url(${venue.image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Top-left category badge */}
      <div style={{ position: 'absolute', top: 10, left: 10 }}>
        <span style={{
          display: 'inline-block',
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.25)',
          color: 'white',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '3px 8px',
          borderRadius: 999,
          whiteSpace: 'nowrap',
        }}>
          {venue.badge}
        </span>
      </div>

      {/* Bottom row: name/description left, CTA right */}
      <div style={{
        position: 'absolute', bottom: 10, left: 12, right: 12,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            color: 'white', fontWeight: 700, fontSize: 16, margin: 0,
            lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {venue.name}
          </p>
          <p style={{
            color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: '2px 0 0',
            lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {venue.description}
          </p>
        </div>
        <a
          href={venue.ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            display: 'inline-block',
            background: '#FFD966',
            color: '#14110c',
            borderRadius: 999,
            padding: '6px 14px',
            fontSize: 11,
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {venue.cta}
        </a>
      </div>
    </div>
  );
}
