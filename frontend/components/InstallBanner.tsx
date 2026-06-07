'use client';

import { useEffect, useState } from 'react';

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
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
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
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [ios]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(STORAGE_KEY, '1');
    }
    setVisible(false);
    setDeferredPrompt(null);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[72px] md:bottom-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-[#1c1917] text-white rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3">
        <span className="text-2xl leading-none shrink-0 mt-0.5">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Add Brewscanner to your home screen</p>
          {ios ? (
            <p className="text-xs text-stone-400 mt-0.5">
              Tap <span className="font-semibold text-stone-300">Share</span> then{' '}
              <span className="font-semibold text-stone-300">Add to Home Screen</span>
            </p>
          ) : (
            <p className="text-xs text-stone-400 mt-0.5">Quick access, works offline</p>
          )}
          {!ios && deferredPrompt && (
            <button
              onClick={install}
              className="mt-2 text-xs font-black bg-[#B34207] px-3 py-1.5 rounded-lg"
            >
              Install
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-stone-500 hover:text-stone-300 transition-colors p-0.5 -mt-0.5 -mr-1"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
