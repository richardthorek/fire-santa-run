import { describe, it, expect } from 'vitest';
import {
  isLocationStale,
  minutesSinceUpdate,
  isNewerBroadcast,
  isRunRunningLate,
  STALE_LOCATION_THRESHOLD_MS,
  RUN_LATE_THRESHOLD_MS,
} from '../trackingStatus';

describe('isLocationStale', () => {
  it('is not stale when no update has arrived yet', () => {
    expect(isLocationStale(null, Date.now())).toBe(false);
  });

  it('is not stale just under the threshold', () => {
    const now = 1_000_000;
    expect(isLocationStale(now - (STALE_LOCATION_THRESHOLD_MS - 1), now)).toBe(false);
  });

  it('is stale once the threshold is exceeded', () => {
    const now = 1_000_000;
    expect(isLocationStale(now - (STALE_LOCATION_THRESHOLD_MS + 1), now)).toBe(true);
  });
});

describe('minutesSinceUpdate', () => {
  it('floors to whole minutes, minimum 1', () => {
    const now = 1_000_000;
    expect(minutesSinceUpdate(now - 30_000, now)).toBe(1);
    expect(minutesSinceUpdate(now - 90_000, now)).toBe(1);
    expect(minutesSinceUpdate(now - 125_000, now)).toBe(2);
  });
});

describe('isRunRunningLate', () => {
  it('is not late before the threshold', () => {
    const now = 1_000_000;
    expect(isRunRunningLate(now - (RUN_LATE_THRESHOLD_MS - 1), now)).toBe(false);
  });

  it('is late after the threshold', () => {
    const now = 1_000_000;
    expect(isRunRunningLate(now - (RUN_LATE_THRESHOLD_MS + 1), now)).toBe(true);
  });

  it('treats an unparseable start time as never late', () => {
    expect(isRunRunningLate(NaN, Date.now())).toBe(false);
  });
});

describe('isNewerBroadcast', () => {
  it('accepts the first broadcast', () => {
    expect(isNewerBroadcast(null, 1_000)).toBe(true);
  });

  it('accepts a fix newer than the last one shown', () => {
    expect(isNewerBroadcast(1_000, 2_000)).toBe(true);
  });

  it('drops replayed, duplicate or older fixes', () => {
    expect(isNewerBroadcast(2_000, 2_000)).toBe(false);
    expect(isNewerBroadcast(2_000, 1_000)).toBe(false);
  });

  it('drops a message with an unparseable timestamp', () => {
    expect(isNewerBroadcast(null, Number.NaN)).toBe(false);
  });
});
