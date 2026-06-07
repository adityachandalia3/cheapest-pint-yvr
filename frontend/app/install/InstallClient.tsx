'use client';

import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { installPrompt } from '@/lib/installPrompt';

function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
  if (/android/i.test(navigator.userAgent)) return 'android';
  return 'other';
}

function Step({ n, text, sub }: { n: number; text: string; sub?: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="shrink-0 w-8 h-8 rounded-full bg-[#B34207] text-white font-black text-sm flex items-center justify-center">
        {n}
      </div>
      <div className="pt-1">
        <p className="text-sm font-bold text-[#1c1917] leading-snug">{text}</p>
        {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function InstallClient() {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [installed, setInstalled] = useState(false);
  const [tab, setTab] = useState<'ios' | 'android'>('ios');
  const [iosBrowser, setIosBrowser] = useState<'safari' | 'chrome'>('safari');
  const hasNativePrompt = !!installPrompt.get();

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setTab(p === 'android' ? 'android' : 'ios');
    if (p === 'ios' && /CriOS/i.test(navigator.userAgent)) setIosBrowser('chrome');

    if (typeof window !== 'undefined') {
      setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    }

    // Also catch prompt if it fires while on this page
    const handler = (e: Event) => {
      e.preventDefault();
      installPrompt.set(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Track when browser confirms the install completed (Android)
    const onInstalled = () => posthog.capture('pwa_app_installed');
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    const prompt = installPrompt.get();
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      posthog.capture('pwa_install_accepted');
      installPrompt.clear();
      setInstalled(true);
    }
  }

  if (installed) {
    return (
      <div className="min-h-screen bg-[#fef9f0] flex flex-col items-center justify-center px-6 text-center gap-4">
        <span className="text-5xl">🎉</span>
        <h1 className="text-2xl font-black text-[#1c1917]">Already installed!</h1>
        <p className="text-stone-400 text-sm">Brewscanner is on your home screen.</p>
        <a href="/" className="mt-2 inline-flex items-center gap-2 bg-[#B34207] text-white font-black text-sm px-6 py-3 rounded-full">
          Open Brewscanner
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fef9f0] text-[#1c1917]">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-16">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#B34207] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🍺</span>
          </div>
          <h1 className="text-2xl font-black text-[#1c1917]">Add to Home Screen</h1>
          <p className="text-stone-400 text-sm mt-1">Quick access to the cheapest pint near you</p>
        </div>

        {/* Android native prompt */}
        {platform === 'android' && hasNativePrompt && (
          <div className="mb-6 bg-white rounded-2xl border border-[#fde8c4] p-5 shadow-sm">
            <p className="text-sm font-bold mb-3 text-center">Your browser supports one-tap install</p>
            <button
              onClick={handleInstall}
              className="w-full bg-[#B34207] text-white font-black text-sm py-3 rounded-xl"
            >
              📲 Install Brewscanner
            </button>
          </div>
        )}

        {/* Platform tabs */}
        <div className="flex bg-white rounded-xl border border-[#e8dcc8] p-1 mb-6">
          {(['ios', 'android'] as const).map(p => (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`flex-1 py-2 text-sm font-black rounded-lg transition-colors ${
                tab === p ? 'bg-[#B34207] text-white' : 'text-stone-400 hover:text-[#1c1917]'
              }`}
            >
              {p === 'ios' ? '🍎 iPhone / iPad' : '🤖 Android'}
            </button>
          ))}
        </div>

        {/* iOS instructions */}
        {tab === 'ios' && (
          <div className="space-y-4">
            {/* Browser toggle */}
            <div className="flex bg-white rounded-xl border border-[#e8dcc8] p-1">
              {(['safari', 'chrome'] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setIosBrowser(b)}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-colors ${
                    iosBrowser === b ? 'bg-[#1c1917] text-white' : 'text-stone-400 hover:text-[#1c1917]'
                  }`}
                >
                  {b === 'safari' ? '🧭 Safari' : '🌐 Chrome'}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#fde8c4] p-5 shadow-sm space-y-5">
              {iosBrowser === 'safari' ? (
                <>
                  <Step
                    n={1}
                    text='Open getbrewscanner.com in Safari'
                    sub='Safari is the browser with the compass icon'
                  />
                  <Step
                    n={2}
                    text='Tap the ••• button at the bottom of the screen'
                    sub='The three-dot button in the bottom toolbar'
                  />
                  <Step
                    n={3}
                    text='Tap "Share"'
                    sub='This opens the share sheet'
                  />
                  <Step
                    n={4}
                    text='Tap "Add to Home Screen"'
                    sub="If you don't see it, tap View More to find it in the list"
                  />
                  <Step
                    n={5}
                    text='Tap "Add" in the top right corner'
                    sub='Brewscanner will appear on your home screen like an app'
                  />
                </>
              ) : (
                <>
                  <Step
                    n={1}
                    text='Open getbrewscanner.com in Chrome'
                    sub='Chrome is the browser with the colourful circle icon'
                  />
                  <Step
                    n={2}
                    text='Tap the Share button at the top right'
                    sub='The box with an upward arrow — next to the address bar'
                  />
                  <Step
                    n={3}
                    text='Tap "Add to Home Screen"'
                    sub="Scroll down in the share sheet if you don't see it"
                  />
                  <Step
                    n={4}
                    text='Tap "Add" to confirm'
                    sub='Brewscanner will appear on your home screen like an app'
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Android instructions */}
        {tab === 'android' && (
          <div className="bg-white rounded-2xl border border-[#fde8c4] p-5 shadow-sm space-y-5">
            <p className="text-xs font-bold text-[#B34207] uppercase tracking-wide">Works in Chrome (recommended)</p>

            {hasNativePrompt ? (
              <div className="text-center py-4">
                <p className="text-sm text-stone-500 mb-4">Use the install button above, or follow the manual steps:</p>
              </div>
            ) : null}

            <Step
              n={1}
              text='Open getbrewscanner.com in Chrome'
              sub='Chrome is the app with the coloured circle icon'
            />
            <Step
              n={2}
              text='Tap the three-dot menu in the top right'
              sub='The ⋮ icon in the address bar area'
            />
            <Step
              n={3}
              text='Tap "Add to Home screen" or "Install app"'
              sub='The option name may vary by device and Chrome version'
            />
            <Step
              n={4}
              text='Tap "Add" or "Install" to confirm'
              sub='Brewscanner will appear on your home screen like an app'
            />
          </div>
        )}

        {/* Back link */}
        <div className="text-center mt-8">
          <a href="/" className="text-sm font-bold text-[#B34207] underline underline-offset-2">
            ← Back to Brewscanner
          </a>
        </div>
      </div>
    </div>
  );
}
