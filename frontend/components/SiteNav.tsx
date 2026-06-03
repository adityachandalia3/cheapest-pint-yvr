'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import VibeSearch from './VibeSearch';

const NAV_LINKS = [
  { emoji: '🏆', label: 'World Cup Mode', href: null, comingSoon: true },
  { emoji: '🗺', label: 'Bar Map', href: '/bar-map', comingSoon: false },
  { emoji: '📢', label: 'Advertise With Us', href: '/advertise', comingSoon: false },
  { emoji: '🍺', label: 'Submit a Price', href: '/submit-price', comingSoon: false },
  { emoji: 'ℹ️', label: 'About', href: '/about', comingSoon: false },
];

export default function SiteNav() {
  const [vibeOpen, setVibeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [moreOpen]);

  const handleShowOnMap = (barId: string) => {
    if (pathname === '/') {
      window.dispatchEvent(new CustomEvent('pintmap:showBar', { detail: barId }));
    } else {
      router.push('/');
    }
  };

  return (
    <>
      {/* ── Mobile top header ──────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 h-12 bg-[#faf5eb]" style={{ borderBottom: '0.5px solid #e8dcc8' }}>
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg leading-none">🍺</span>
          <span className="font-black text-sm tracking-tight text-[#B34207]">PINT MAP YVR</span>
        </Link>
        <button
          onClick={() => setMoreOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-stone-500"
          aria-label="Menu"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <rect y="0" width="18" height="2" rx="1" fill="currentColor"/>
            <rect y="6" width="18" height="2" rx="1" fill="currentColor"/>
            <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
      </header>

      {/* ── Desktop navbar ─────────────────────────────────────────────── */}
      <header className="hidden md:flex sticky top-0 z-50 items-center px-6 h-14 bg-[#faf5eb] border-b border-[#e8dcc8]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-auto">
          <span className="text-xl leading-none">🍺</span>
          <span className="font-black text-base tracking-tight text-[#B34207] whitespace-nowrap">
            PINT MAP YVR
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(link => link.comingSoon ? (
            <span
              key="world-cup"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-400 cursor-default select-none"
            >
              {link.emoji} {link.label}
              <span className="text-[10px] font-black bg-[#F5A623]/15 text-[#b45309] border border-[#F5A623]/30 px-1.5 py-0.5 rounded-full ml-1">
                Soon
              </span>
            </span>
          ) : (
            <Link
              key={link.href}
              href={link.href!}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-stone-600 hover:text-[#B34207] rounded-lg hover:bg-[#fde8c4]/40 transition-all whitespace-nowrap"
            >
              {link.emoji} {link.label}
            </Link>
          ))}

          {/* Build a Crawl — pill CTA */}
          <Link
            href="/crawl-builder"
            className="ml-2 flex items-center gap-1.5 text-sm font-black text-[#B34207] border border-[#B34207] hover:bg-[#B34207] hover:text-white px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap"
          >
            🗺 Build a Crawl
          </Link>
        </nav>
      </header>

      {/* ── Mobile bottom tab bar ───────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#faf5eb] border-t border-[#e8dcc8]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {/* Find Vibe — pulsing amber badge */}
          <button
            onClick={() => setVibeOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0 text-xs font-black transition-colors ${
              vibeOpen ? 'text-[#B34207]' : 'text-[#1c1917]'
            }`}
          >
            <span className="relative inline-block leading-none">
              <span className="text-[20px]">✨</span>
              <span className="absolute -top-0.5 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
            </span>
            <span className="mt-0.5">Find Your Vibe</span>
            <span className="text-[9px] text-stone-300 leading-none mt-0.5">Try me!</span>
          </button>

          {/* Crawl — pulsing amber badge */}
          <Link
            href="/crawl-builder"
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0 text-xs font-black transition-colors ${
              pathname === '/crawl-builder' ? 'text-[#B34207]' : 'text-[#1c1917]'
            }`}
          >
            <span className="relative inline-block leading-none">
              <span className="text-[20px]">🗺</span>
              <span className="absolute -top-0.5 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
            </span>
            <span className="mt-0.5">Crawl</span>
            <span className="text-[9px] text-stone-300 leading-none mt-0.5">Try me!</span>
          </Link>

          {/* World Cup — coming soon, non-interactive */}
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0 text-xs font-black text-stone-400 cursor-default select-none opacity-50">
            <span className="text-[20px] leading-none">⚽</span>
            <span className="mt-0.5">World Cup</span>
            <span className="text-[9px] leading-none mt-0.5">Coming Soon!</span>
          </div>
        </div>
      </nav>

      {/* ── Mobile "More" slide-up sheet ────────────────────────────────── */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-[#e8dcc8]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mt-3 mb-4" />
            <p className="text-xs font-black text-stone-400 uppercase tracking-widest px-6 mb-2">Menu</p>
            {NAV_LINKS.map(link => link.comingSoon ? (
              <div
                key="world-cup"
                className="flex items-center justify-between px-6 py-3.5 text-stone-400 border-b border-[#fde8c4]/60 select-none"
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  <span>{link.emoji}</span>
                  {link.label}
                </span>
                <span className="text-[10px] font-black bg-[#F5A623]/15 text-[#b45309] border border-[#F5A623]/30 px-1.5 py-0.5 rounded-full">
                  Coming Soon
                </span>
              </div>
            ) : (
              <Link
                key={link.href}
                href={link.href!}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-2.5 px-6 py-3.5 text-[#1c1917] text-sm font-semibold hover:bg-[#fef9f0] transition-colors border-b border-[#fde8c4]/60 last:border-0"
              >
                <span>{link.emoji}</span>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Vibe Search Modal ───────────────────────────────────────────── */}
      <VibeSearch
        isOpen={vibeOpen}
        onClose={() => setVibeOpen(false)}
        onShowOnMap={handleShowOnMap}
      />
    </>
  );
}
