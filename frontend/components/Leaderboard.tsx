'use client';

import { BarWithActivePrice } from '@/lib/types';

interface Props {
  bars16oz: BarWithActivePrice[];
  bars20oz: BarWithActivePrice[];
  onBarClick: (id: string) => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function LeaderboardTable({
  bars,
  title,
  onBarClick,
}: {
  bars: BarWithActivePrice[];
  title: string;
  onBarClick: (id: string) => void;
}) {
  if (bars.length === 0) return null;

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-black uppercase tracking-widest text-[#F5A623] mb-3">{title}</h3>
      <div className="space-y-1">
        {bars.map((bar, idx) => {
          const rank = idx + 1;
          const isMedal = rank <= 3;
          const rankColor = isMedal ? MEDAL_COLORS[idx] : '#4a4a6a';

          return (
            <button
              key={bar.id}
              onClick={() => onBarClick(bar.id)}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0d0d1a] hover:bg-[#16213e] border border-[#F5A623]/5 hover:border-[#F5A623]/20 transition-all duration-150 group"
            >
              {/* Rank */}
              <span
                className="text-sm font-black tabular-nums w-7 shrink-0 text-center"
                style={{ color: rankColor }}
              >
                {isMedal ? MEDALS[idx] : `#${rank}`}
              </span>

              {/* Bar info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate group-hover:text-[#F5A623] transition-colors">
                  {bar.name}
                </p>
                {bar.neighbourhood && (
                  <p className="text-gray-600 text-xs truncate">{bar.neighbourhood}</p>
                )}
              </div>

              {/* HH badge */}
              {bar.isHappyHour && (
                <span className="shrink-0 text-[10px] font-bold text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/20 px-1.5 py-0.5 rounded-full">
                  HH
                </span>
              )}

              {/* Price */}
              <span
                className="shrink-0 text-base font-black tabular-nums"
                style={{ color: isMedal ? rankColor : '#F5A623' }}
              >
                ${bar.activePrice.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Leaderboard({ bars16oz, bars20oz, onBarClick }: Props) {
  if (bars16oz.length === 0 && bars20oz.length === 0) return null;

  return (
    <section className="px-4 py-10 max-w-6xl mx-auto">
      <h2 className="text-xl md:text-2xl font-black text-white mb-6">
        🏆 Leaderboard{' '}
        <span className="text-[#F5A623] text-base font-semibold">Cheapest Pints Right Now</span>
      </h2>

      <div className="flex flex-col md:flex-row gap-6">
        <LeaderboardTable
          bars={bars16oz}
          title="Top 10 · 16 oz"
          onBarClick={onBarClick}
        />
        <div className="hidden md:block w-px bg-[#F5A623]/10 self-stretch" />
        <LeaderboardTable
          bars={bars20oz}
          title="Top 5 · 20 oz"
          onBarClick={onBarClick}
        />
      </div>
    </section>
  );
}
