import { describe, it, expect } from 'vitest';
import { isBrigadeEntitled, describeSubscription } from '../subscription';

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

describe('describeSubscription', () => {
  it('offers subscribe for a never-subscribed brigade', () => {
    const info = describeSubscription({ subscriptionStatus: 'none' });
    expect(info.action).toBe('subscribe');
    expect(info.entitled).toBe(false);
    expect(info.tone).toBe('neutral');
  });

  it('offers subscribe for null/undefined', () => {
    expect(describeSubscription(null).action).toBe('subscribe');
    expect(describeSubscription(undefined).label).toBe('Not subscribed');
  });

  it('offers manage and reports a renewal date for an active subscription', () => {
    const info = describeSubscription({ subscriptionStatus: 'active', subscribedUntil: future() });
    expect(info.action).toBe('manage');
    expect(info.entitled).toBe(true);
    expect(info.tone).toBe('positive');
    expect(info.renewsOn).not.toBeNull();
    expect(info.detail).toContain('Renews on');
  });

  it('warns and offers manage for past_due within the grace window', () => {
    const info = describeSubscription({ subscriptionStatus: 'past_due', subscribedUntil: future() });
    expect(info.action).toBe('manage');
    expect(info.tone).toBe('warning');
    expect(info.entitled).toBe(true);
  });

  it('treats a canceled subscription with remaining access as manageable', () => {
    const info = describeSubscription({ subscriptionStatus: 'canceled', subscribedUntil: future() });
    expect(info.entitled).toBe(true);
    expect(info.action).toBe('manage');
    expect(info.tone).toBe('warning');
  });

  it('prompts resubscribe for a fully-lapsed canceled subscription', () => {
    const info = describeSubscription({ subscriptionStatus: 'canceled', subscribedUntil: past() });
    expect(info.entitled).toBe(false);
    expect(info.action).toBe('subscribe');
    expect(info.tone).toBe('danger');
  });

  it('returns no renewal date when none is recorded', () => {
    expect(describeSubscription({ subscriptionStatus: 'active' }).renewsOn).toBeNull();
  });
});
