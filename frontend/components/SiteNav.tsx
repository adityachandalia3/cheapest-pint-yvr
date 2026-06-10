'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconBeer } from '@tabler/icons-react';
import MyNightDrawer from './MyNightDrawer';
import CommunityPopup from './CommunityPopup';
import { useMyNightContext } from '@/lib/myNightContext';

const NAV_LINKS = [
  { emoji: '🏆', label: 'World Cup Mode', href: '/world-cup', comingSoon: false },
  { emoji: '🗺', label: 'Bar Map', href: '/bar-map', comingSoon: false },
  { emoji: '📢', label: 'Advertise With Us', href: '/advertise', comingSoon: false },
  { emoji: '🍺', label: 'Submit a Price', href: '/submit-price', comingSoon: false },
  { emoji: 'ℹ️', label: 'About', href: '/about', comingSoon: false },
  { emoji: '✉️', label: 'Contact Us', href: '/contact', comingSoon: false },
];

function Wordmark({ mobile }: { mobile?: boolean }) {
  return (
    <span style={{ fontSize: mobile ? 16 : 18, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em' }}>
      <span style={{ color: '#B34207' }}>Brew</span>
      <span style={{ color: '#1c1410' }}>scanner</span>
    </span>
  );
}

export default function SiteNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);
  const [myPicksOpen, setMyPicksOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const pathname = usePathname();
  const { myNight } = useMyNightContext();
  const desktopMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [moreOpen]);

  useEffect(() => {
    if (!desktopMoreOpen) return;
    const handler = (e: MouseEvent) => {
      if (desktopMoreRef.current && !desktopMoreRef.current.contains(e.target as Node)) {
        setDesktopMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [desktopMoreOpen]);

  return (
    <>
      {/* ── Mobile top header ──────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 h-12 bg-[#faf5eb]" style={{ borderBottom: '0.5px solid #e8dcc8' }}>
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg leading-none">🍺</span>
          <Wordmark mobile />
        </Link>
        <div className="flex items-center gap-1">
          {/* My Picks — icon only on mobile */}
          <button
            onClick={() => setMyPicksOpen(true)}
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-stone-500 hover:bg-[#fde8c4]/50 transition-colors"
            aria-label="My Picks"
          >
            <IconBeer size={20} stroke={1.75} />
            {myNight.length > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-[#B34207] text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                {myNight.length}
              </span>
            )}
          </button>
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
        </div>
      </header>

      {/* ── Desktop navbar ─────────────────────────────────────────────── */}
      <header className="hidden md:flex sticky top-0 z-50 items-center px-6 h-14 bg-[#faf5eb] border-b border-[#e8dcc8]">
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-auto">
          <span className="text-xl leading-none">🍺</span>
          <Wordmark />
        </Link>

        <nav className="flex items-center gap-1">
          {/* More dropdown */}
          <div ref={desktopMoreRef} className="relative">
            <button
              onClick={() => setDesktopMoreOpen(o => !o)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-stone-600 hover:text-[#B34207] hover:bg-[#fde8c4]/40 transition-all text-sm font-semibold whitespace-nowrap"
            >
              More
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${desktopMoreOpen ? 'rotate-180' : ''}`}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {desktopMoreOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-[#e8dcc8] shadow-lg shadow-black/10 overflow-hidden z-[100]">
                {/* Join the Community — always first */}
                <button
                  onClick={() => { setDesktopMoreOpen(false); setCommunityOpen(true); }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-[#B34207] text-sm font-semibold hover:bg-[#fef9f0] transition-colors border-b border-[#fde8c4]/60 text-left"
                >
                  <span>🍺</span>
                  Join the Community
                </button>
                {NAV_LINKS.map(link => link.comingSoon ? (
                  <div
                    key="world-cup"
                    className="flex items-center justify-between px-4 py-3 text-stone-400 border-b border-[#fde8c4]/60 select-none"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span>{link.emoji}</span>
                      {link.label}
                    </span>
                    <span className="text-[10px] font-black bg-[#F5A623]/15 text-[#b45309] border border-[#F5A623]/30 px-1.5 py-0.5 rounded-full">
                      Soon
                    </span>
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href!}
                    onClick={() => setDesktopMoreOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 text-[#1c1917] text-sm font-semibold hover:bg-[#fef9f0] transition-colors border-b border-[#fde8c4]/60 last:border-0"
                  >
                    <span>{link.emoji}</span>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* My Picks — icon + label on desktop */}
          <button
            onClick={() => setMyPicksOpen(true)}
            className="relative ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-stone-600 hover:text-[#B34207] hover:bg-[#fde8c4]/40 transition-all whitespace-nowrap"
            aria-label="My Picks"
          >
            <span className="relative">
              <IconBeer size={22} stroke={1.75} />
              {myNight.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-[#B34207] text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                  {myNight.length}
                </span>
              )}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>My Picks</span>
          </button>

          {/* Build a Crawl — pill CTA */}
          <Link
            href="/crawl-builder"
            className="ml-1 flex items-center gap-1.5 text-sm font-black text-[#B34207] border border-[#B34207] hover:bg-[#B34207] hover:text-white px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap"
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
          <Link
            href="/find-your-vibe"
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0 text-xs font-black transition-colors ${
              pathname === '/find-your-vibe' ? 'text-[#B34207]' : 'text-[#1c1917]'
            }`}
          >
            <span className="relative inline-block leading-none">
              <span className="text-[20px]">✨</span>
              {pathname !== '/find-your-vibe' && (
                <span className="absolute -top-0.5 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                </span>
              )}
            </span>
            <span className="mt-0.5">Find Your Vibe</span>
            <span className="text-[9px] text-stone-300 leading-none mt-0.5">Try me!</span>
          </Link>

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

          <Link
            href="/world-cup"
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0 text-xs font-black transition-colors ${
              pathname === '/world-cup' ? 'text-[#B34207]' : 'text-[#1c1917]'
            }`}
          >
            <span className="text-[20px] leading-none">⚽</span>
            <span className="mt-0.5">World Cup</span>
          </Link>
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
            {/* Join the Community — always first */}
            <button
              onClick={() => { setMoreOpen(false); setCommunityOpen(true); }}
              className="w-full flex items-center gap-2.5 px-6 py-3.5 text-[#B34207] text-sm font-semibold hover:bg-[#fef9f0] transition-colors border-b border-[#fde8c4]/60 text-left"
            >
              <span>🍺</span>
              Join the Community
            </button>
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

      {/* ── My Picks Drawer ─────────────────────────────────────────────── */}
      <MyNightDrawer isOpen={myPicksOpen} onClose={() => setMyPicksOpen(false)} />

      {/* ── Community Popup (manual trigger from menu) ──────────────────── */}
      {communityOpen && (
        <CommunityPopup manualOpen onClose={() => setCommunityOpen(false)} />
      )}
    </>
  );
}
