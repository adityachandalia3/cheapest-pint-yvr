'use client';

import { Filters, BeerCategory } from '@/lib/types';

interface Props {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  neighbourhoods: string[];
}

const BEER_TYPES: { value: BeerCategory; label: string }[] = [
  { value: 'cheapest_beer', label: 'Beer' },
  { value: 'cheapest_lager', label: 'Lager' },
  { value: 'cheapest_ipa', label: 'IPA' },
];

function pill(active: boolean) {
  return `shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
    active
      ? 'bg-[#B34207] text-white border-[#B34207]'
      : 'bg-transparent text-stone-500 border-[#e8dcc8] hover:border-[#B34207]/40 hover:text-[#1c1917]'
  }`;
}

export default function FilterBar({ filters, onFiltersChange, neighbourhoods }: Props) {
  return (
    <div className="bg-white border-b border-[#e8dcc8]">
      <div
        className="flex gap-2 px-4 py-2.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {/* Neighbourhood — pill wrapping a transparent native select */}
        <div className="relative shrink-0">
          <span className={pill(!!filters.neighbourhood)}>
            {filters.neighbourhood || 'All Neighbourhoods'}
          </span>
          <select
            value={filters.neighbourhood}
            onChange={e => onFiltersChange({ ...filters, neighbourhood: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
            aria-label="Neighbourhood"
          >
            <option value="">All Neighbourhoods</option>
            {neighbourhoods.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Beer type pills */}
        {BEER_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onFiltersChange({ ...filters, beerType: value })}
            className={pill(filters.beerType === value)}
          >
            {label}
          </button>
        ))}

        {/* Happy Hour */}
        <button
          onClick={() => onFiltersChange({ ...filters, happyHourOnly: !filters.happyHourOnly })}
          className={pill(filters.happyHourOnly)}
        >
          🎉 Happy Hour
        </button>

        {/* Sort */}
        <button
          onClick={() =>
            onFiltersChange({ ...filters, sortBy: filters.sortBy === 'price' ? 'name' : 'price' })
          }
          className={pill(false)}
        >
          Sort: {filters.sortBy === 'price' ? '$ Price' : 'A–Z'}
        </button>
      </div>
    </div>
  );
}
