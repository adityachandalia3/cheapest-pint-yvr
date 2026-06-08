'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body style={{ background: '#fef9f0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🍺</p>
          <h2 style={{ fontWeight: 900, fontSize: '1.25rem', marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: '#78716c', marginBottom: '1.5rem' }}>We hit a snag. Give it another shot.</p>
          <button
            onClick={reset}
            style={{ background: '#B34207', color: 'white', fontWeight: 900, padding: '0.75rem 1.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
