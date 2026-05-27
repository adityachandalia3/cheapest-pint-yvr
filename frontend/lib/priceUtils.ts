import { Bar, PintPrice, BarWithActivePrice, BeerCategory } from './types';

function getVancouverTimeString(now?: Date): string {
  return (now ?? new Date()).toLocaleTimeString('sv-SE', {
    timeZone: 'America/Vancouver',
  });
}

export function isHappyHourActive(bar: Bar, now?: Date): boolean {
  if (!bar.happy_hour_start || !bar.happy_hour_end) return false;
  const timeStr = getVancouverTimeString(now);
  const start = bar.happy_hour_start.slice(0, 8);
  const end = bar.happy_hour_end.slice(0, 8);
  if (start <= end) {
    return timeStr >= start && timeStr <= end;
  }
  // Spans midnight
  return timeStr >= start || timeStr <= end;
}

export function getActivePriceForPint(bar: Bar, pint: PintPrice, now?: Date): number {
  const regular = Number(pint.price_cad);
  if (pint.happy_hour_price_cad !== null && isHappyHourActive(bar, now)) {
    return Math.min(regular, Number(pint.happy_hour_price_cad));
  }
  return regular;
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

  for (const pint of prices) {
    const p = getActivePriceForPint(bar, pint, now);
    if (p < activePrice) {
      activePrice = p;
      activeBeerName = pint.beer_name;
    }
  }

  return {
    ...bar,
    activePrice,
    activeBeerName,
    isHappyHour: isHappyHourActive(bar, now),
  };
}
