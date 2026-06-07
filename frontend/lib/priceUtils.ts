import { Bar, PintPrice, BarWithActivePrice, BeerCategory } from './types';

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  'the main - best sports bar restaurant on main st vancouver': 'The Main on Main',
};

export function getDisplayName(name: string): string {
  return DISPLAY_NAME_OVERRIDES[name.toLowerCase()] ?? name;
}

function getVancouverTimeString(now?: Date): string {
  return (now ?? new Date()).toLocaleTimeString('sv-SE', {
    timeZone: 'America/Vancouver',
  });
}

function getVancouverDayShort(now?: Date): string {
  return (now ?? new Date()).toLocaleDateString('en-US', {
    timeZone: 'America/Vancouver',
    weekday: 'short',
  }).toLowerCase(); // 'mon', 'tue', ...
}

function windowActive(start: string, end: string, timeStr: string): boolean {
  const s = start.slice(0, 8);
  const e = end.slice(0, 8);
  if (s <= e) return timeStr >= s && timeStr <= e;
  return timeStr >= s || timeStr <= e; // spans midnight
}

export function isHappyHourActive(bar: Bar, now?: Date): boolean {
  const timeStr = getVancouverTimeString(now);

  if (!bar.happy_hour_windows?.length) return false;
  const day = getVancouverDayShort(now);
  return bar.happy_hour_windows.some(
    w => w.days.includes(day) && windowActive(w.start_time, w.end_time, timeStr)
  );
}

export function getActivePriceForPint(bar: Bar, pint: PintPrice, now?: Date): number {
  const regular = pint.price_cad !== null ? Number(pint.price_cad) : null;
  if (pint.happy_hour_price_cad !== null && isHappyHourActive(bar, now)) {
    const hh = Number(pint.happy_hour_price_cad);
    return regular !== null ? Math.min(regular, hh) : hh;
  }
  return regular ?? Infinity;
}

export function formatPourSize(size: number | null): string | null {
  if (size === null) return null;
  return size >= 100 ? `${size}ml` : `${size}oz`;
}

export function enrichBarForPourSize(
  bar: Bar,
  now?: Date,
  pourSize?: number,
): BarWithActivePrice {
  const prices = pourSize
    ? (bar.pint_prices ?? []).filter(p => p.pour_size_oz === pourSize)
    : (bar.pint_prices ?? []);

  let activePrice = Infinity;
  let activeBeerName: string | null = null;
  let activePourSize: number | null = pourSize ?? null;

  for (const pint of prices) {
    const p = getActivePriceForPint(bar, pint, now);
    if (p < activePrice) {
      activePrice = p;
      activeBeerName = pint.beer_name;
      activePourSize = pint.pour_size_oz ?? null;
    }
  }

  return { ...bar, activePrice, activeBeerName, activePourSize, isHappyHour: isHappyHourActive(bar, now) };
}

export function enrichBarWithActivePrice(
  bar: Bar,
  now?: Date,
  category?: BeerCategory
): BarWithActivePrice {
  let prices = category
    ? (bar.pint_prices ?? []).filter(p => p.category === category)
    : (bar.pint_prices ?? []);

  // If no entries for the requested category, fall back to cheapest across all categories
  if (category && prices.length === 0) {
    prices = bar.pint_prices ?? [];
  }

  let activePrice = Infinity;
  let activeBeerName: string | null = null;
  let activePourSize: number | null = null;

  for (const pint of prices) {
    const p = getActivePriceForPint(bar, pint, now);
    if (p < activePrice) {
      activePrice = p;
      activeBeerName = pint.beer_name;
      activePourSize = pint.pour_size_oz ?? null;
    }
  }

  return {
    ...bar,
    activePrice,
    activeBeerName,
    activePourSize,
    isHappyHour: isHappyHourActive(bar, now),
  };
}
