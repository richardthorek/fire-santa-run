/**
 * Client helpers for the Stripe subscription flow. These call the server, which
 * creates the Checkout / billing-portal session and returns a URL we redirect
 * to. The client never handles card data or asserts payment state.
 */

import { getApiAuthHeaders } from '../auth/apiToken';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function postForRedirectUrl(path: string, brigadeId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
    body: JSON.stringify({ brigadeId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
  }
  return payload.url as string;
}

/** Start Stripe Checkout for a brigade subscription and redirect the browser. */
export async function startBrigadeCheckout(brigadeId: string): Promise<void> {
  const url = await postForRedirectUrl('/stripe/create-checkout-session', brigadeId);
  window.location.assign(url);
}

/** Open the Stripe billing portal (manage / cancel) and redirect the browser. */
export async function openBillingPortal(brigadeId: string): Promise<void> {
  const url = await postForRedirectUrl('/stripe/create-portal-session', brigadeId);
  window.location.assign(url);
}

// ---------------------------------------------------------------------------
// Live pricing — the displayed price comes from Stripe, so changing it in the
// Stripe dashboard updates the site automatically. Every consumer falls back
// to this static default when the endpoint is unavailable (dev mode, outage).
// ---------------------------------------------------------------------------

export interface SubscriptionPrice {
  /** Amount in the currency's smallest unit (cents for AUD/USD, yen for JPY). */
  unitAmount: number;
  /** Lowercase ISO currency code, e.g. 'aud'. */
  currency: string;
  /** Billing interval, e.g. 'year'. */
  interval: string;
  /** Additional currencies configured on the Stripe price (multi-currency). */
  currencyOptions: Record<string, number>;
}

/** Static fallback matching the configured Stripe price ($5 AUD / year). */
export const FALLBACK_PRICE: SubscriptionPrice = {
  unitAmount: 500,
  currency: 'aud',
  interval: 'year',
  currencyOptions: {},
};

/** Fetch the live subscription price; null when billing isn't configured. */
export async function fetchSubscriptionPrice(): Promise<SubscriptionPrice | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/stripe/price`);
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data?.unitAmount !== 'number' || typeof data?.currency !== 'string') return null;
    return {
      unitAmount: data.unitAmount,
      currency: data.currency,
      interval: typeof data.interval === 'string' ? data.interval : 'year',
      currencyOptions: data.currencyOptions && typeof data.currencyOptions === 'object' ? data.currencyOptions : {},
    };
  } catch {
    return null;
  }
}

/** Currencies whose Stripe unit_amount is already the whole unit (no cents). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

/** Minimal region → currency map for choosing among a price's currency_options. */
const REGION_CURRENCIES: Record<string, string> = {
  AU: 'aud', NZ: 'nzd', US: 'usd', CA: 'cad', GB: 'gbp', JP: 'jpy', SG: 'sgd', ZA: 'zar',
  IE: 'eur', DE: 'eur', FR: 'eur', ES: 'eur', IT: 'eur', NL: 'eur', AT: 'eur', BE: 'eur', PT: 'eur', FI: 'eur', GR: 'eur',
};

/**
 * Pick the best currency/amount for the viewer: their region's currency when
 * the Stripe price carries a matching currency option, else the base currency.
 * `locale` defaults to the browser locale (e.g. "en-US" → USD when offered).
 */
export function resolveLocalizedPrice(
  price: SubscriptionPrice,
  locale?: string
): { unitAmount: number; currency: string } {
  const resolved = locale ?? (typeof navigator !== 'undefined' ? navigator.language : undefined);
  const region = resolved?.split('-')[1]?.toUpperCase();
  const preferred = region ? REGION_CURRENCIES[region] : undefined;
  if (preferred && preferred !== price.currency && typeof price.currencyOptions[preferred] === 'number') {
    return { unitAmount: price.currencyOptions[preferred], currency: preferred };
  }
  return { unitAmount: price.unitAmount, currency: price.currency };
}

/** Format a Stripe amount for display, e.g. (500, 'aud') → "A$5" / "$5". */
export function formatPriceAmount(unitAmount: number, currency: string, locale?: string): string {
  const upper = currency.toUpperCase();
  const value = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? unitAmount : unitAmount / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: upper,
      // $5.00 → $5: whole prices read cleaner on marketing surfaces.
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${upper} ${value}`;
  }
}

/** One-liner used by UI surfaces, e.g. "$5/year". */
export function formatPriceLabel(price: SubscriptionPrice, locale?: string): string {
  const { unitAmount, currency } = resolveLocalizedPrice(price, locale);
  return `${formatPriceAmount(unitAmount, currency, locale)}/${price.interval}`;
}
