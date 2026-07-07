import { describe, it, expect } from 'vitest';
import { isBrigadeEntitled } from '../subscription';

const future = () => new Date(Date.now() + 86_400_000).toISOString();
const past = () => new Date(Date.now() - 86_400_000).toISOString();

describe('isBrigadeEntitled', () => {
  it('is false for null/undefined', () => {
    expect(isBrigadeEntitled(null)).toBe(false);
    expect(isBrigadeEntitled(undefined)).toBe(false);
  });

  it('is false when never subscribed', () => {
    expect(isBrigadeEntitled({})).toBe(false);
    expect(isBrigadeEntitled({ subscriptionStatus: 'none' })).toBe(false);
  });

  it('is true for active with a future period end', () => {
    expect(isBrigadeEntitled({ subscriptionStatus: 'active', subscribedUntil: future() })).toBe(true);
  });

  it('is true for active with no period end recorded', () => {
    expect(isBrigadeEntitled({ subscriptionStatus: 'active' })).toBe(true);
    expect(isBrigadeEntitled({ subscriptionStatus: 'trialing' })).toBe(true);
  });

  it('retains access until period end even when canceled (cancel-at-period-end)', () => {
    expect(isBrigadeEntitled({ subscriptionStatus: 'canceled', subscribedUntil: future() })).toBe(true);
    expect(isBrigadeEntitled({ subscriptionStatus: 'canceled', subscribedUntil: past() })).toBe(false);
  });

  it('honours the past_due grace window via period end', () => {
    expect(isBrigadeEntitled({ subscriptionStatus: 'past_due', subscribedUntil: future() })).toBe(true);
    expect(isBrigadeEntitled({ subscriptionStatus: 'past_due', subscribedUntil: past() })).toBe(false);
  });

  it('is false for active but expired period end', () => {
    expect(isBrigadeEntitled({ subscriptionStatus: 'active', subscribedUntil: past() })).toBe(false);
  });
});
