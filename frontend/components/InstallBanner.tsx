'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { installPrompt } from '@/lib/installPrompt';

const STORAGE_KEY = 'brewscanner_install_dismissed';

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
}

export default function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const ios = isIOS();

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    if (ios) {
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      installPrompt.set(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [ios]);

  function dismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[72px] md:bottom-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm">
      <Link href="/install" className="block" onClick={() => { localStorage.setItem(STORAGE_KEY, '1'); setVisible(false); }}>
        <div className="bg-[#1c1917] text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl leading-none shrink-0">📱</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">Add Brewscanner to your home screen</p>
            <p className="text-xs text-stone-400 mt-0.5">Tap for step-by-step instructions →</p>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 text-stone-500 hover:text-stone-300 transition-colors p-1"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>
      </Link>
    </div>
  );
}
