import { describe, it, expect } from 'vitest';
import {
  resolveLocalizedPrice,
  formatPriceAmount,
  formatPriceLabel,
  FALLBACK_PRICE,
  type SubscriptionPrice,
} from '../billing';

const multiCurrency: SubscriptionPrice = {
  unitAmount: 500,
  currency: 'aud',
  interval: 'year',
  currencyOptions: { usd: 350, eur: 300, jpy: 500 },
};

describe('resolveLocalizedPrice', () => {
  it('returns the base currency when no options exist', () => {
    expect(resolveLocalizedPrice(FALLBACK_PRICE, 'en-US')).toEqual({ unitAmount: 500, currency: 'aud' });
  });

  it('picks the viewer-region currency when the price offers it', () => {
    expect(resolveLocalizedPrice(multiCurrency, 'en-US')).toEqual({ unitAmount: 350, currency: 'usd' });
    expect(resolveLocalizedPrice(multiCurrency, 'de-DE')).toEqual({ unitAmount: 300, currency: 'eur' });
    expect(resolveLocalizedPrice(multiCurrency, 'ja-JP')).toEqual({ unitAmount: 500, currency: 'jpy' });
  });

  it('falls back to the base currency for unmapped or option-less regions', () => {
    expect(resolveLocalizedPrice(multiCurrency, 'en-AU')).toEqual({ unitAmount: 500, currency: 'aud' });
    expect(resolveLocalizedPrice(multiCurrency, 'pt-BR')).toEqual({ unitAmount: 500, currency: 'aud' });
    // GB maps to gbp, but this price has no gbp option → base currency.
    expect(resolveLocalizedPrice(multiCurrency, 'en-GB')).toEqual({ unitAmount: 500, currency: 'aud' });
  });

  it('handles locales without a region subtag', () => {
    expect(resolveLocalizedPrice(multiCurrency, 'en')).toEqual({ unitAmount: 500, currency: 'aud' });
  });
});

describe('formatPriceAmount', () => {
  it('divides two-decimal currencies by 100 and drops trailing .00', () => {
    expect(formatPriceAmount(500, 'usd', 'en-US')).toBe('$5');
    expect(formatPriceAmount(550, 'usd', 'en-US')).toBe('$5.50');
  });

  it('treats zero-decimal currencies as whole units', () => {
    // 500 JPY is ¥500, not ¥5.
    expect(formatPriceAmount(500, 'jpy', 'en-US')).toBe('¥500');
  });
});

describe('formatPriceLabel', () => {
  it('combines amount and interval', () => {
    expect(formatPriceLabel(FALLBACK_PRICE, 'en-AU')).toBe('$5/year');
  });

  it('localizes to the viewer currency when offered', () => {
    expect(formatPriceLabel(multiCurrency, 'en-US')).toBe('$3.50/year');
  });
});
