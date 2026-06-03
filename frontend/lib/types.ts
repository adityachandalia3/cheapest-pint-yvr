export interface PintPrice {
  id: string;
  bar_id: string;
  category: 'cheapest_beer' | 'cheapest_lager' | 'cheapest_ipa';
  beer_name: string | null;
  price_cad: number | null;
  happy_hour_price_cad: number | null;
  pour_size_oz: number | null;
}

export interface HappyHourWindow {
  id: string;
  bar_id: string;
  days: string[];
  start_time: string;
  end_time: string;
  notes: string | null;
}

export interface Bar {
  id: string;
  google_place_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  neighbourhood: string | null;
  is_permanently_closed: boolean;
  pint_prices: PintPrice[];
  happy_hour_windows: HappyHourWindow[];
}

export interface BarWithActivePrice extends Bar {
  activePrice: number;
  activeBeerName: string | null;
  activePourSize: number | null;
  isHappyHour: boolean;
}

export type BeerCategory = 'cheapest_beer' | 'cheapest_lager' | 'cheapest_ipa';

export interface Filters {
  neighbourhood: string;
  beerType: BeerCategory;
  happyHourOnly: boolean;
  sortBy: 'price' | 'name';
}
