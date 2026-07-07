/**
 * useSubscriptionPrice — live subscription pricing from Stripe.
 *
 * Fetches the real price via GET /api/stripe/price so the site always shows
 * whatever is configured in Stripe (single source of truth). Starts from the
 * static fallback so there is never a blank price, and quietly upgrades when
 * the live value arrives. `isLive` tells callers whether the shown price came
 * from Stripe or the fallback.
 */

import { useEffect, useState } from 'react';
import {
  fetchSubscriptionPrice,
  FALLBACK_PRICE,
  formatPriceLabel,
  resolveLocalizedPrice,
  formatPriceAmount,
  type SubscriptionPrice,
} from '../utils/billing';

export interface UseSubscriptionPriceResult {
  /** The active price (live from Stripe, or the static fallback). */
  price: SubscriptionPrice;
  /** True once the price has been confirmed against Stripe. */
  isLive: boolean;
  /** e.g. "$5/year" — localized to the viewer's currency when available. */
  label: string;
  /** e.g. "$5" — amount only, localized. */
  amount: string;
  /** Uppercase ISO code of the displayed currency, e.g. "AUD". */
  currency: string;
}

export function useSubscriptionPrice(): UseSubscriptionPriceResult {
  const [price, setPrice] = useState<SubscriptionPrice>(FALLBACK_PRICE);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSubscriptionPrice().then((live) => {
      if (live && !cancelled) {
        setPrice(live);
        setIsLive(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = resolveLocalizedPrice(price);
  return {
    price,
    isLive,
    label: formatPriceLabel(price),
    amount: formatPriceAmount(resolved.unitAmount, resolved.currency),
    currency: resolved.currency.toUpperCase(),
  };
}
