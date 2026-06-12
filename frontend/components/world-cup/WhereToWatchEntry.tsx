'use client';

export default function WhereToWatchEntry({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-4 pt-3">
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between gap-3 text-left active:scale-[0.99] transition-all"
        style={{ background: '#eff6ff', border: '1px solid #e8dcc8', borderRadius: 14, padding: 16 }}
      >
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1c1410', margin: 0 }}>
            🍺 Where should I watch?
          </p>
          <p style={{ fontSize: 11, color: '#a0855a', margin: '3px 0 0' }}>
            Find the best bar for tonight&apos;s match
          </p>
        </div>
        <span
          style={{
            background: '#B34207',
            color: 'white',
            borderRadius: 999,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Find my spot →
        </span>
      </button>
    </div>
  );
}
