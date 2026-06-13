import Link from 'next/link';

function isWcSeason(): boolean {
  const vanDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Vancouver' });
  return vanDate >= '2026-06-11' && vanDate <= '2026-07-19';
}

export default function WcPromoBanner() {
  if (!isWcSeason()) return null;

  return (
    <Link href="/world-cup" style={{ display: 'block', textDecoration: 'none' }}>
      <div style={{ background: 'linear-gradient(135deg, #0E1B3D 0%, #16275A 100%)' }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, #006847, #CE1126, #FFB612, #007749, #2A4FD7, #B34207)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 42 }}>
          <span style={{ color: 'white', fontSize: 10.6, fontWeight: 500 }}>
            ⚽ Where are YOU watching tonight?
          </span>
          <span style={{ background: '#FFD966', color: '#14110c', borderRadius: 999, padding: '5px 12px', fontSize: 9.7, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
            Enter World Cup mode →
          </span>
        </div>
      </div>
    </Link>
  );
}
