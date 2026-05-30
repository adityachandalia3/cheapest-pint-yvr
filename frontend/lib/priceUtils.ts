import { Bar, PintPrice, BarWithActivePrice, BeerCategory } from './types';

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
  const regular = Number(pint.price_cad);
  if (pint.happy_hour_price_cad !== null && isHappyHourActive(bar, now)) {
    return Math.min(regular, Number(pint.happy_hour_price_cad));
  }
  return regular;
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
  const prices = category
    ? (bar.pint_prices ?? []).filter(p => p.category === category)
    : (bar.pint_prices ?? []);

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
