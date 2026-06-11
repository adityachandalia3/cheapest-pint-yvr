'use client';

import { useState, useEffect } from 'react';

const EMOJIS = ['🇲🇽', '🇨🇦', '🇺🇸', '🇧🇷', '🇩🇪', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇦🇷', '🏆'];

export default function WorldCupLoading() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setIdx(i => (i + 1) % EMOJIS.length), 150);
    const stop = setTimeout(() => {
      clearInterval(interval);
      setIdx(EMOJIS.length - 1);
    }, 7000);
    return () => { clearInterval(interval); clearTimeout(stop); };
  }, []);

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #0E1B3D 0%, #16275A 55%, #1B2C5C 100%)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 56, lineHeight: 1 }}>{EMOJIS[idx]}</span>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
        Entering World Cup mode...
      </p>
    </div>
  );
}
