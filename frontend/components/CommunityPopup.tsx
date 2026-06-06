'use client';

import { useEffect, useState } from 'react';
import posthog from 'posthog-js';

const STORAGE_KEY = 'popupShown';
const AUTO_DELAY_MS = 30000;

interface Props {
  manualOpen?: boolean;
  onClose?: () => void;
}

export default function CommunityPopup({ manualOpen = false, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  // Auto-trigger after 30s — only once ever
  useEffect(() => {
    if (manualOpen) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(() => {
      setVisible(true);
      localStorage.setItem(STORAGE_KEY, '1');
    }, AUTO_DELAY_MS);

    return () => clearTimeout(timer);
  }, [manualOpen]);

  // Manual trigger always works
  useEffect(() => {
    if (manualOpen) setVisible(true);
  }, [manualOpen]);

  const close = () => {
    setVisible(false);
    onClose?.();
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
      posthog.capture('popup_signup');
      setDone(true);
      setTimeout(() => close(), 2500);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={close}
    >
      <div
        style={{
          width: '90%', maxWidth: '480px',
          background: '#faf5eb',
          border: '1px solid #e8dcc8',
          borderRadius: '20px',
          padding: '28px 28px 24px',
          position: 'relative',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: 'absolute', top: '14px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '18px', color: '#78716c', lineHeight: 1,
            padding: '4px',
          }}
        >
          ✕
        </button>

        {done ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍺</div>
            <p style={{ fontWeight: 900, fontSize: '18px', color: '#1c1917', margin: '0 0 6px' }}>
              You&apos;re in! Cheers!
            </p>
            <p style={{ fontSize: '14px', color: '#78716c', margin: 0 }}>
              Welcome to the Brewscanner community.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontWeight: 900, fontSize: '22px', color: '#1c1917', margin: '0 0 14px', lineHeight: 1.2 }}>
              Welcome to Brewscanner! 🍺
            </h2>

            <p style={{ fontSize: '14px', color: '#57534e', lineHeight: 1.65, margin: '0 0 20px' }}>
              Thank you so much for visiting. We&apos;re constantly improving — adding new bars, new features, and more killer deals across Vancouver. We&apos;d love to hear what you think via our{' '}
              <a href="/about" style={{ color: '#B34207', textDecoration: 'underline' }}>Contact Us</a>{' '}
              page. Sign up and become part of our community — be the first to know about new features, the best happy hour deals, and our World Cup screening guides.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#ffffff', border: '1px solid #e8dcc8',
                  borderRadius: '12px', padding: '11px 14px',
                  fontSize: '14px', color: '#1c1917',
                  outline: 'none',
                }}
              />
              {error && (
                <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  background: loading || !email.trim() ? '#d4a57a' : '#B34207',
                  color: '#ffffff', border: 'none', borderRadius: '12px',
                  padding: '12px', fontSize: '14px', fontWeight: 900,
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {loading ? 'Signing up…' : 'Join the Community'}
              </button>
            </form>

            <button
              onClick={close}
              style={{
                display: 'block', width: '100%', marginTop: '10px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '13px', color: '#a8a29e', textAlign: 'center',
                padding: '6px',
              }}
            >
              Maybe later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
