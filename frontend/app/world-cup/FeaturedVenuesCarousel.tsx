'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type VenueDetailSection = {
  title?: string;
  bullets: string[];
};

type FeaturedVenue = {
  id: string;
  badge: string;
  name: string;
  description: string;
  cta: string;
  ctaHref: string;
  image: string;
  placeholderColor: string;
  details?: {
    address?: string;
    sections: VenueDetailSection[];
  };
};

const FEATURED_VENUES: FeaturedVenue[] = [
  {
    id: 'canada-soccer-house',
    badge: '🍁 Official Canada House',
    name: 'Canada Soccer House',
    description: 'Free · The Shipyards, North Vancouver',
    cta: 'More Info →',
    ctaHref: 'https://news.canadasoccer.com/canada-soccer-announces-uber-eats-canada-soccer-house-north-vancouver-for-the-2026-fifa-world-cup',
    image: '/wc-featured/canada-soccer-house.jpg',
    placeholderColor: '#7b0000',
    details: {
      address: 'The Shipyards, North Vancouver',
      sections: [
        {
          title: '🏟️ The Venue',
          bullets: [
            '29-foot outdoor screen',
            'Free admission — no tickets needed',
            'Footie festival village atmosphere',
          ],
        },
        {
          title: '🎉 On-site Partners',
          bullets: [
            'White Spot — Canadian comfort food',
            'EB Games — gaming activations',
            'Player meet-and-greets throughout the tournament',
          ],
        },
      ],
    },
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
    details: {
      address: '68 Water Street, Gastown',
      sections: [
        {
          title: '🌎 Latin America Hub',
          bullets: [
            'Official Tribuna Latina watch party space',
            'Home base for all Latin American supporters',
            'All matches screened live',
          ],
        },
        {
          title: '🎉 What to Expect',
          bullets: [
            'Vibrant atmosphere with flags and drums',
            'Latin food & drinks',
            'Family-friendly outdoor space',
          ],
        },
      ],
    },
  },
  {
    id: 'alliance-francaise',
    badge: '🇫🇷 Les Bleus HQ',
    name: 'Alliance Française',
    description: 'Official France watch parties — Vancouver',
    cta: 'Get Directions →',
    ctaHref: 'https://www.google.com/maps/search/?api=1&query=Alliance+Francaise+Vancouver+BC',
    image: '',
    placeholderColor: '#00209F',
    details: {
      address: '6161 Cambie Street, Vancouver',
      sections: [
        {
          title: '🎭 Theater Hall',
          bullets: [
            'Large-format screen for France matches',
            'Seated viewing — book ahead for big games',
            'Bilingual commentary & atmosphere',
          ],
        },
        {
          title: '🍷 Bar Lounge',
          bullets: [
            'French wines, beers & classic cocktails',
            'Open before and after every match',
            'Walk-in friendly for smaller games',
          ],
        },
      ],
    },
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
    details: {
      address: 'Hastings Park, Vancouver · Jun 11 – Jul 19',
      sections: [
        {
          title: '🎟️ Admission',
          bullets: [
            'Free access to the main festival grounds',
            'Premium seating tickets available for purchase',
            'All World Cup matches screened live',
          ],
        },
        {
          title: '🍺 Food & Drink',
          bullets: [
            'Beer from $9.50–$10.50',
            'Multiple food vendors on-site',
            'Non-alcoholic options available',
          ],
        },
        {
          title: '🎉 Activities',
          bullets: [
            'FIFA interactive fan experiences',
            'Live entertainment between matches',
            'Merchandise & sponsor activations',
          ],
        },
      ],
    },
  },
];

const SCALE_SIDE = 0.92;
const OPACITY_SIDE = 0.55;

// ── Detail sheet ──────────────────────────────────────────────────────────────

function FeaturedVenueSheet({ venue, onClose }: { venue: FeaturedVenue; onClose: () => void }) {
  return (
    <>
      <style>{`@keyframes fvSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div className="fixed inset-0 z-[500] bg-black/50" onClick={onClose} />
      <div
        className="fixed left-0 right-0 bottom-0 z-[501] max-h-[85vh] flex flex-col rounded-t-2xl shadow-2xl"
        style={{ background: '#fffbeb', animation: 'fvSlideUp 0.25s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-3 border-b border-[#e8dcc8] shrink-0">
          <div className="min-w-0 pr-3">
            <span style={{
              display: 'inline-block',
              background: 'rgba(0,0,0,0.06)',
              border: '1px solid #e8dcc8',
              color: '#5C4A2A',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
              padding: '2px 8px',
              borderRadius: 999,
              marginBottom: 6,
            }}>
              {venue.badge}
            </span>
            <h2 className="font-black text-[#1c1917] leading-tight" style={{ fontSize: 18 }}>
              {venue.name}
            </h2>
            {venue.details?.address && (
              <p style={{ fontSize: 12, color: '#a0855a', marginTop: 3 }}>📍 {venue.details.address}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-[#1c1917] hover:bg-stone-100 transition-all text-sm mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {venue.details?.sections.map((section, i) => (
            <div key={i} style={{ marginBottom: i < (venue.details?.sections.length ?? 0) - 1 ? 16 : 0 }}>
              {section.title && (
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1410', marginBottom: 6 }}>
                  {section.title}
                </p>
              )}
              {section.bullets.map((b, j) => (
                <p key={j} style={{ fontSize: 13, color: '#5C4A2A', margin: '0 0 5px', lineHeight: 1.5 }}>
                  • {b}
                </p>
              ))}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className="px-5 py-4 border-t border-[#e8dcc8] shrink-0"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        >
          <a
            href={venue.ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center py-2.5 rounded-xl font-black text-sm text-white transition-colors hover:opacity-90"
            style={{ background: '#B34207' }}
          >
            {venue.cta}
          </a>
        </div>
      </div>
    </>
  );
}

// ── Carousel ──────────────────────────────────────────────────────────────────

export default function FeaturedVenuesCarousel() {
  const [index, setIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [detailVenueId, setDetailVenueId] = useState<string | null>(null);
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

  const detailVenue = detailVenueId ? FEATURED_VENUES.find(v => v.id === detailVenueId) ?? null : null;

  return (
    <div className="pt-2 pb-1">
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
            Featured Screenings
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Swipe to explore →</span>
      </div>

      {/* Carousel */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden h-[180px]"
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
              onClick={() => {
                if (!isActive) { setIndex(i); return; }
                if (venue.details) setDetailVenueId(venue.id);
              }}
              style={{
                position: 'absolute', top: 0, left: '50%',
                width: cardWidth, height: '100%', marginLeft: -cardWidth / 2,
                transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s ease',
                cursor: 'pointer',
                ...getCardStyle(diff),
              }}
            >
              <VenueCard venue={venue} />
            </div>
          );
        })}

        {/* Arrow buttons */}
        <button
          onClick={() => go(-1)}
          className="flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full transition-colors z-20"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
          aria-label="Previous venue"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={() => go(1)}
          className="flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full transition-colors z-20"
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

      {detailVenue && (
        <FeaturedVenueSheet venue={detailVenue} onClose={() => setDetailVenueId(null)} />
      )}
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
        backgroundImage: venue.image
          ? `linear-gradient(to top, rgba(20,17,12,0.9) 0%, rgba(20,17,12,0.55) 40%, rgba(20,17,12,0.1) 100%), url(${venue.image})`
          : `linear-gradient(to top, rgba(20,17,12,0.85) 0%, rgba(20,17,12,0.4) 60%, transparent 100%)`,
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
        {venue.details ? (
          <span
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
            More Info →
          </span>
        ) : (
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
        )}
      </div>
    </div>
  );
}
