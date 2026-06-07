'use client';

import { BarWithActivePrice } from '@/lib/types';
import { getDisplayName, formatPourSize } from '@/lib/priceUtils';

interface Props {
  bars: BarWithActivePrice[];
  highlightedBarId: string | null;
  onBarClick: (id: string) => void;
  onBarHover: (id: string | null) => void;
  nearMeActive?: boolean;
  nearMeRadiusKm?: number | null;
  nearMeExpandedFrom?: number | null;
  nearMeFallback?: boolean;
  remainingBars?: BarWithActivePrice[];
}

const RANK_STYLES: Record<number, { bg: string; border: string; rankColor: string }> = {
  1: { bg: 'bg-amber-50 hover:bg-amber-100/70', border: 'border-amber-200', rankColor: '#b45309' },
  2: { bg: 'bg-stone-50 hover:bg-stone-100/70', border: 'border-stone-200', rankColor: '#6b7280' },
  3: { bg: 'bg-orange-50 hover:bg-orange-100/60', border: 'border-orange-200', rankColor: '#92400e' },
};

const RANK_LABEL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function BarRow({
  bar,
  rank,
  isHighlighted,
  onBarClick,
  onBarHover,
}: {
  bar: BarWithActivePrice;
  rank: number;
  isHighlighted: boolean;
  onBarClick: (id: string) => void;
  onBarHover: (id: string | null) => void;
}) {
  const style = RANK_STYLES[rank];
  const defaultBg = style?.bg ?? 'bg-white hover:bg-[#fef9f0]';
  const defaultBorder = style?.border ?? 'border-[#fde8c4]';
  const rankColor = style?.rankColor ?? '#a8a29e';

  return (
    <button
      key={bar.id}
      onClick={() => onBarClick(bar.id)}
      onMouseEnter={() => onBarHover(bar.id)}
      onMouseLeave={() => onBarHover(null)}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 ${
        isHighlighted
          ? 'bg-[#B34207]/5 border-[#B34207]/40 shadow-sm'
          : `${defaultBg} ${defaultBorder}`
      }`}
    >
      <span className="shrink-0 w-8 text-center text-sm font-black tabular-nums" style={{ color: rankColor }}>
        {RANK_LABEL[rank] ?? `#${rank}`}
      </span>

      <div className="flex-1 min-w-0">
        <p className={`font-black text-sm leading-tight truncate transition-colors ${isHighlighted ? 'text-[#B34207]' : 'text-[#1c1917]'}`}>
          {getDisplayName(bar.name)}
        </p>
        <p className="text-xs text-stone-400 truncate mt-0.5">
          {[bar.neighbourhood, bar.activeBeerName].filter(Boolean).join(' · ')}
        </p>
      </div>

      {bar.isHappyHour && (
        <span className="shrink-0 text-[10px] font-bold text-[#b45309] bg-[#F5A623]/10 border border-[#F5A623]/25 px-1.5 py-0.5 rounded-full">
          HH
        </span>
      )}

      <div className="shrink-0 text-right">
        <span className="text-base font-black tabular-nums text-[#B34207]">
          ${bar.activePrice.toFixed(2)}
        </span>
        {formatPourSize(bar.activePourSize) && (
          <p className="text-[10px] text-stone-400 font-semibold leading-none mt-0.5">
            {formatPourSize(bar.activePourSize)}
          </p>
        )}
      </div>
    </button>
  );
}

export default function Leaderboard({
  bars,
  highlightedBarId,
  onBarClick,
  onBarHover,
  nearMeActive,
  nearMeRadiusKm,
  nearMeExpandedFrom,
  nearMeFallback,
  remainingBars = [],
}: Props) {
  if (bars.length === 0) return null;

  const showNearMe = nearMeActive && !nearMeFallback;

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl md:text-2xl font-black text-[#1c1917]">
          {showNearMe ? '📍' : '🏆'}{' '}
          <span className="ml-1">
            {showNearMe ? 'Cheapest Pints Near You' : 'Cheapest Pints Right Now'}
          </span>
        </h2>
        <span className="text-xs text-stone-400 font-semibold">Top {bars.length}</span>
      </div>

      {/* Near Me fallback note */}
      {nearMeFallback && (
        <p className="text-xs text-stone-400 font-semibold mb-4 -mt-2">
          Not many bars nearby — showing all Vancouver
        </p>
      )}

      {/* Nearby count + expansion note */}
      {showNearMe && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#B34207] bg-[#B34207]/8 border border-[#B34207]/20 px-2.5 py-1 rounded-full">
            📍 {bars.length} bar{bars.length !== 1 ? 's' : ''} near you
          </span>
          {nearMeExpandedFrom !== null && nearMeRadiusKm !== null && (
            <span className="text-[11px] text-stone-400 font-semibold">
              Only {bars.length} within {nearMeExpandedFrom}km — showing nearest within {nearMeRadiusKm}km
            </span>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {bars.map((bar, idx) => (
          <BarRow
            key={bar.id}
            bar={bar}
            rank={idx + 1}
            isHighlighted={bar.id === highlightedBarId}
            onBarClick={onBarClick}
            onBarHover={onBarHover}
          />
        ))}
      </div>

      {/* Divider + remaining bars when Near Me is active */}
      {showNearMe && remainingBars.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#e8dcc8]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              More bars in Vancouver
            </span>
            <div className="flex-1 h-px bg-[#e8dcc8]" />
          </div>
          <div className="space-y-1.5">
            {remainingBars.map((bar, idx) => (
              <BarRow
                key={bar.id}
                bar={bar}
                rank={bars.length + idx + 1}
                isHighlighted={bar.id === highlightedBarId}
                onBarClick={onBarClick}
                onBarHover={onBarHover}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
