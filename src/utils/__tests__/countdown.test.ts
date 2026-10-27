/**
 * Unit tests for countdown timer utilities
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCountdownTime, padCountdownUnit, formatRouteStartDateTime, formatEventStartInEventZone, zonedDateTimeToEpoch } from '../countdown';

/** The fake clocks above are local wall-clock times, so these tests read the start in the machine's zone. */
const LOCAL_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('countdown utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCountdownTime', () => {
    it('should return zeroes when the start time is in the past', () => {
      // Use a fixed "now" that is after the target
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-25T00:00:00'));

      const result = getCountdownTime('2024-12-24', '18:00', LOCAL_ZONE);

      expect(result.total).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
    });

    it('should return zeroes when the start time is exactly now', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-24T18:00:00.000'));

      const result = getCountdownTime('2024-12-24', '18:00', LOCAL_ZONE);

      expect(result.total).toBe(0);
    });

    it('should calculate hours correctly', () => {
      vi.useFakeTimers();
      // 3 hours before the start
      vi.setSystemTime(new Date('2024-12-24T15:00:00.000'));

      const result = getCountdownTime('2024-12-24', '18:00', LOCAL_ZONE);

      expect(result.hours).toBe(3);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should calculate minutes correctly', () => {
      vi.useFakeTimers();
      // 45 minutes before the start
      vi.setSystemTime(new Date('2024-12-24T17:15:00.000'));

      const result = getCountdownTime('2024-12-24', '18:00', LOCAL_ZONE);

      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(45);
      expect(result.seconds).toBe(0);
    });

    it('should calculate seconds correctly', () => {
      vi.useFakeTimers();
      // 30 seconds before the start
      vi.setSystemTime(new Date('2024-12-24T17:59:30.000'));

      const result = getCountdownTime('2024-12-24', '18:00', LOCAL_ZONE);

      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(30);
    });

    it('should calculate combined hours, minutes and seconds', () => {
      vi.useFakeTimers();
      // 2h 30m 15s before the start
      vi.setSystemTime(new Date('2024-12-24T15:29:45.000'));

      const result = getCountdownTime('2024-12-24', '18:00', LOCAL_ZONE);

      expect(result.hours).toBe(2);
      expect(result.minutes).toBe(30);
      expect(result.seconds).toBe(15);
    });

    it('should not return negative total', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00'));

      const result = getCountdownTime('2024-12-24', '18:00', LOCAL_ZONE);

      expect(result.total).toBe(0);
    });
  });

  describe('padCountdownUnit', () => {
    it('should pad single-digit numbers with a leading zero', () => {
      expect(padCountdownUnit(0)).toBe('00');
      expect(padCountdownUnit(5)).toBe('05');
      expect(padCountdownUnit(9)).toBe('09');
    });

    it('should not pad two-digit numbers', () => {
      expect(padCountdownUnit(10)).toBe('10');
      expect(padCountdownUnit(59)).toBe('59');
      expect(padCountdownUnit(99)).toBe('99');
    });

    it('should handle hours over 99', () => {
      expect(padCountdownUnit(100)).toBe('100');
    });
  });

  describe('formatRouteStartDateTime', () => {
    it('should return a non-empty string for valid date and time', () => {
      const result = formatRouteStartDateTime('2024-12-24', '18:00');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include the year in the output', () => {
      const result = formatRouteStartDateTime('2024-12-24', '18:00');
      expect(result).toContain('2024');
    });

    it('should fall back gracefully for an invalid date', () => {
      const result = formatRouteStartDateTime('not-a-date', '18:00');
      expect(result).toContain('not-a-date');
      expect(result).toContain('18:00');
    });
  });
});

describe('zonedDateTimeToEpoch', () => {
  it('reads a start time in the route zone, not the viewer zone', () => {
    // 16:00 on 24 December in Sydney daylight time (UTC+11) is 05:00 UTC.
    expect(zonedDateTimeToEpoch('2026-12-24', '16:00', 'Australia/Sydney')).toBe(Date.UTC(2026, 11, 24, 5, 0));
  });

  it('uses standard time outside daylight saving', () => {
    // 09:00 on 1 July in Sydney (UTC+10) is 23:00 UTC on 30 June.
    expect(zonedDateTimeToEpoch('2026-07-01', '09:00', 'Australia/Sydney')).toBe(Date.UTC(2026, 5, 30, 23, 0));
  });
});

describe('formatRouteStartDateTime time zone', () => {
  it('shows the viewer zone first and the event zone in brackets when clocks differ', () => {
    // 16:30 in Adelaide (UTC+10:30 in December) is 17:00 in Sydney (UTC+11).
    const line = formatRouteStartDateTime('2026-12-24', '16:30', 'Australia/Adelaide', 'Australia/Sydney');
    expect(line).toMatch(/^Thu,? 24 Dec 2026 at 5:00\s?pm AEDT \(4:30\s?pm ACDT in Adelaide\)$/);
  });

  it('omits the event zone when the viewer shares its clock time', () => {
    const line = formatRouteStartDateTime('2026-12-24', '16:00', 'Australia/Sydney', 'Australia/Sydney');
    expect(line).not.toContain('(');
  });

  it('names the event city, not the viewer, in brackets', () => {
    const line = formatRouteStartDateTime('2026-12-24', '16:30', 'Australia/Adelaide', 'Australia/Sydney');
    expect(line).toContain('in Adelaide');
  });
});

describe('formatEventStartInEventZone', () => {
  it('reads the start in the event zone, with the zone named', () => {
    const { day, time } = formatEventStartInEventZone('2026-12-24', '16:30', 'Australia/Adelaide');
    expect(day).toBe('Thursday 24 December');
    expect(time).toMatch(/4:30\s?pm ACDT/);
  });
});

describe('daylight saving', () => {
  it('keeps a 7pm December run at 7pm on the day, whatever the clocks did in October', () => {
    // Sydney moves to daylight time on 4 October 2026. A run set on 24 December
    // at 19:00 is 19:00 local on the day: 08:00 UTC, not 07:00 UTC.
    const epoch = zonedDateTimeToEpoch('2026-12-24', '19:00', 'Australia/Sydney');
    expect(new Date(epoch).toISOString()).toBe('2026-12-24T08:00:00.000Z');
  });

  it('keeps a 7pm July run at 7pm on the day, on standard time', () => {
    const epoch = zonedDateTimeToEpoch('2026-07-01', '19:00', 'Australia/Sydney');
    expect(new Date(epoch).toISOString()).toBe('2026-07-01T09:00:00.000Z');
  });
});
