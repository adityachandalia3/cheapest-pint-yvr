'use client';

import { BarWithActivePrice } from '@/lib/types';
import { getDisplayName } from '@/lib/priceUtils';

interface Props {
  bars: BarWithActivePrice[];
  highlightedBarId: string | null;
  onBarClick: (id: string) => void;
  onBarHover: (id: string | null) => void;
}

const RANK_STYLES: Record<number, { bg: string; border: string; rankColor: string; badge: string }> = {
  1: {
    bg: 'bg-amber-50 hover:bg-amber-100/70',
    border: 'border-amber-200',
    rankColor: '#b45309',
    badge: 'bg-amber-100 text-amber-700 border-amber-300',
  },
  2: {
    bg: 'bg-stone-50 hover:bg-stone-100/70',
    border: 'border-stone-200',
    rankColor: '#6b7280',
    badge: 'bg-stone-100 text-stone-500 border-stone-300',
  },
  3: {
    bg: 'bg-orange-50 hover:bg-orange-100/60',
    border: 'border-orange-200',
    rankColor: '#92400e',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
  },
};

const RANK_LABEL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ bars, highlightedBarId, onBarClick, onBarHover }: Props) {
  if (bars.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl md:text-2xl font-black text-[#1c1917]">
          🏆 <span className="ml-1">Cheapest Pints Right Now</span>
        </h2>
        <span className="text-xs text-stone-400 font-semibold">Top {bars.length}</span>
      </div>

      <div className="space-y-1.5">
        {bars.map((bar, idx) => {
          const rank = idx + 1;
          const style = RANK_STYLES[rank];
          const isHighlighted = bar.id === highlightedBarId;
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
              {/* Rank */}
              <span
                className="shrink-0 w-8 text-center text-sm font-black tabular-nums"
                style={{ color: rankColor }}
              >
                {RANK_LABEL[rank] ?? `#${rank}`}
              </span>

              {/* Bar info */}
              <div className="flex-1 min-w-0">
                <p className={`font-black text-sm leading-tight truncate transition-colors ${isHighlighted ? 'text-[#B34207]' : 'text-[#1c1917]'}`}>
                  {getDisplayName(bar.name)}
                </p>
                <p className="text-xs text-stone-400 truncate mt-0.5">
                  {[bar.neighbourhood, bar.activeBeerName].filter(Boolean).join(' · ')}
                </p>
              </div>

              {/* HH badge */}
              {bar.isHappyHour && (
                <span className="shrink-0 text-[10px] font-bold text-[#b45309] bg-[#F5A623]/10 border border-[#F5A623]/25 px-1.5 py-0.5 rounded-full">
                  HH
                </span>
              )}

              {/* Price */}
              <span className="shrink-0 text-base font-black tabular-nums text-[#B34207]">
                ${bar.activePrice.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
