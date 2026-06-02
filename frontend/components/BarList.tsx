'use client';

import { BarWithActivePrice, BeerCategory } from '@/lib/types';
import { formatPourSize } from '@/lib/priceUtils';

interface Props {
  bars: BarWithActivePrice[];
  highlightedBarId: string | null;
  onBarClick: (id: string) => void;
  beerType: BeerCategory;
}

const CATEGORY_LABELS: Record<BeerCategory, string> = {
  cheapest_beer: 'Beer',
  cheapest_lager: 'Lager',
  cheapest_ipa: 'IPA',
};

export default function BarList({ bars, highlightedBarId, onBarClick, beerType }: Props) {
  return (
    <section className="px-4 py-10 max-w-6xl mx-auto">
      <h2 className="text-xl md:text-2xl font-black text-[#1c1917] mb-6">
        All Bars{' '}
        <span className="text-[#B34207]">({bars.length})</span>
      </h2>

      {bars.length === 0 && (
        <div className="text-center text-stone-400 py-16 text-lg">
          No bars match your current filters.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bars.map((bar, idx) => (
          <button
            key={bar.id}
            onClick={() => onBarClick(bar.id)}
            className={`text-left bg-white rounded-xl p-5 border transition-all duration-200 hover:border-[#B34207]/40 hover:shadow-lg hover:shadow-[#B34207]/5 hover:-translate-y-0.5 ${
              highlightedBarId === bar.id
                ? 'border-[#B34207] shadow-lg shadow-[#B34207]/10 -translate-y-0.5'
                : 'border-[#fde8c4]'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-stone-400 font-bold tabular-nums">#{idx + 1}</span>
              {bar.isHappyHour && (
                <span className="text-xs bg-[#F5A623]/15 text-[#b45309] font-bold px-2 py-1 rounded-full border border-[#F5A623]/30">
                  🎉 Happy Hour
                </span>
              )}
            </div>

            <h3 className="font-black text-[#1c1917] text-lg leading-tight mb-1">{bar.name}</h3>

            {bar.neighbourhood && (
              <p className="text-stone-500 text-sm mb-4">{bar.neighbourhood}</p>
            )}

            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-[#B34207] tabular-nums">
                ${bar.activePrice.toFixed(2)}
              </span>
              {formatPourSize(bar.activePourSize) && (
                <span className="text-stone-400 text-sm mb-1">{formatPourSize(bar.activePourSize)}</span>
              )}
              <span className="text-stone-400 text-sm mb-1">{CATEGORY_LABELS[beerType]}</span>
            </div>

            {bar.activeBeerName && (
              <p className="text-stone-400 text-xs mt-1 truncate">{bar.activeBeerName}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
