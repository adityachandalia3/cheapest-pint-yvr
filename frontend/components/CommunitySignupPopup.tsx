'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pintmap_signup_seen';
const DELAY_MS = 25000;
const SCROLL_THRESHOLD = 400;

export default function CommunitySignupPopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    let scrolled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tryShow = () => {
      if (scrolled && !localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    };

    const onScroll = () => {
      if (!scrolled && window.scrollY > SCROLL_THRESHOLD) {
        scrolled = true;
        timer = setTimeout(tryShow, DELAY_MS);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/community-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDone(true);
      localStorage.setItem(STORAGE_KEY, '1');
      setTimeout(() => setVisible(false), 2500);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#fde8c4] shadow-2xl shadow-black/20 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[#F5A623] to-[#B34207]" />

        <div className="p-6">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🍺</div>
              <h3 className="font-black text-[#1c1917] text-lg mb-1">You&apos;re in!</h3>
              <p className="text-sm text-stone-500">Welcome to the Brewscanner community.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#B34207] flex items-center justify-center shrink-0">
                    <span className="text-lg leading-none">🍺</span>
                  </div>
                  <div>
                    <h3 className="font-black text-[#1c1917] text-base leading-tight">Join the community</h3>
                    <p className="text-xs text-[#B34207] mt-0.5">Free · No spam</p>
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="text-stone-400 hover:text-stone-600 transition-colors text-lg leading-none mt-0.5"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-stone-600 leading-relaxed mb-5">
                We&apos;re constantly adding new bars, new features, and better deals across Vancouver. Be the first to know.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full bg-[#fef9f0] border border-[#fde8c4] focus:border-[#B34207]/50 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-[#1c1917] placeholder-stone-400 transition-colors"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-[#B34207] hover:bg-[#8f3506] disabled:opacity-40 text-white font-black text-sm py-2.5 rounded-xl transition-colors"
                >
                  {loading ? 'Signing up…' : 'Sign me up'}
                </button>
              </form>

              <button
                onClick={dismiss}
                className="w-full mt-2 text-xs text-stone-400 hover:text-stone-500 transition-colors py-1"
              >
                No thanks
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
