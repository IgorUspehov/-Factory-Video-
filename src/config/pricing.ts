/**
 * Pricing placeholders. Final prices are configured in Polar and the backend;
 * the values here are only used for display on the landing and account pages.
 */
export const pricing = {
  currency: 'EUR',
  free: { price: 0, credits: 10 },
  pro: { priceMonthly: 19, creditsPerMonth: 120 },
  credits: { packPrice: 9, packCredits: 50 },
} as const;

/** Render cost in credits — same function the backend bills with. */
export { renderCost } from '../../server/src/shared/timeline.js';

export function formatPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: pricing.currency, maximumFractionDigits: 0 }).format(value);
}
