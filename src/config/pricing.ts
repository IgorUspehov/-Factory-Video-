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

/** Estimated render cost in credits: 1 credit per started 30 seconds of video. */
export function renderCost(durationSec: number): number {
  return Math.max(1, Math.ceil(durationSec / 30));
}

export function formatPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: pricing.currency, maximumFractionDigits: 0 }).format(value);
}
