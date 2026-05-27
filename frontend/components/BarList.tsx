'use client';

import { BarWithActivePrice, BeerCategory } from '@/lib/types';

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
      <h2 className="text-xl md:text-2xl font-black text-white mb-6">
        All Bars{' '}
        <span className="text-[#F5A623]">({bars.length})</span>
      </h2>

      {bars.length === 0 && (
        <div className="text-center text-gray-600 py-16 text-lg">
          No bars match your current filters.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bars.map((bar, idx) => (
          <button
            key={bar.id}
            onClick={() => onBarClick(bar.id)}
            className={`text-left bg-[#16213e] rounded-xl p-5 border transition-all duration-200 hover:border-[#F5A623]/60 hover:shadow-xl hover:shadow-[#F5A623]/5 hover:-translate-y-0.5 ${
              highlightedBarId === bar.id
                ? 'border-[#F5A623] shadow-xl shadow-[#F5A623]/10 -translate-y-0.5'
                : 'border-[#F5A623]/10'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-gray-600 font-bold tabular-nums">#{idx + 1}</span>
              {bar.isHappyHour && (
                <span className="text-xs bg-[#F5A623]/15 text-[#F5A623] font-bold px-2 py-1 rounded-full border border-[#F5A623]/25">
                  🎉 Happy Hour
                </span>
              )}
            </div>

            <h3 className="font-black text-white text-lg leading-tight mb-1">{bar.name}</h3>

            {bar.neighbourhood && (
              <p className="text-gray-500 text-sm mb-4">{bar.neighbourhood}</p>
            )}

            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-[#F5A623] tabular-nums">
                ${bar.activePrice.toFixed(2)}
              </span>
              <span className="text-gray-600 text-sm mb-1">{CATEGORY_LABELS[beerType]}</span>
            </div>

            {bar.activeBeerName && (
              <p className="text-gray-600 text-xs mt-1 truncate">{bar.activeBeerName}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
