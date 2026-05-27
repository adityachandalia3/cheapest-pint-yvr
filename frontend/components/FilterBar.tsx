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

export default function FilterBar({ filters, onFiltersChange, neighbourhoods }: Props) {
  return (
    <div className="bg-[#16213e] border-b border-[#F5A623]/20 px-4 py-3 shadow-lg shadow-black/30">
      <div className="max-w-6xl mx-auto flex flex-wrap gap-2 md:gap-3 items-center">
        {/* Neighbourhood */}
        <select
          value={filters.neighbourhood}
          onChange={e => onFiltersChange({ ...filters, neighbourhood: e.target.value })}
          className="bg-[#1a1a2e] text-white border border-[#F5A623]/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F5A623] cursor-pointer"
        >
          <option value="">All Neighbourhoods</option>
          {neighbourhoods.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        {/* Beer type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-[#F5A623]/30">
          {BEER_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onFiltersChange({ ...filters, beerType: value })}
              className={`px-4 py-2 text-sm font-bold transition-colors ${
                filters.beerType === value
                  ? 'bg-[#F5A623] text-[#1a1a2e]'
                  : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Happy hour toggle */}
        <button
          onClick={() => onFiltersChange({ ...filters, happyHourOnly: !filters.happyHourOnly })}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border transition-colors ${
            filters.happyHourOnly
              ? 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]'
              : 'bg-[#1a1a2e] text-gray-400 border-[#F5A623]/30 hover:text-white'
          }`}
        >
          🎉 Happy Hour Only
        </button>

        {/* World Cup Mode */}
        <div className="relative flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border border-white/10 text-gray-600 bg-[#1a1a2e] cursor-not-allowed select-none">
          ⚽ World Cup Mode
          <span className="text-[10px] font-black uppercase tracking-wide bg-white/10 text-gray-500 px-1.5 py-0.5 rounded-full">
            Coming Soon
          </span>
        </div>

        {/* Sort toggle */}
        <button
          onClick={() =>
            onFiltersChange({ ...filters, sortBy: filters.sortBy === 'price' ? 'name' : 'price' })
          }
          className="ml-auto px-4 py-2 text-sm font-bold rounded-lg border border-[#F5A623]/30 text-gray-400 hover:text-white bg-[#1a1a2e] transition-colors"
        >
          Sort: {filters.sortBy === 'price' ? '$ Price' : 'A–Z'}
        </button>
      </div>
    </div>
  );
}
