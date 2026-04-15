/**
 * Unit tests for countdown timer utilities
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCountdownTime, padCountdownUnit, formatRouteStartDateTime } from '../countdown';

describe('countdown utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCountdownTime', () => {
    it('should return zeroes when the start time is in the past', () => {
      // Use a fixed "now" that is after the target
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-25T00:00:00'));

      const result = getCountdownTime('2024-12-24', '18:00');

      expect(result.total).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
    });

    it('should return zeroes when the start time is exactly now', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-24T18:00:00.000'));

      const result = getCountdownTime('2024-12-24', '18:00');

      expect(result.total).toBe(0);
    });

    it('should calculate hours correctly', () => {
      vi.useFakeTimers();
      // 3 hours before the start
      vi.setSystemTime(new Date('2024-12-24T15:00:00.000'));

      const result = getCountdownTime('2024-12-24', '18:00');

      expect(result.hours).toBe(3);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should calculate minutes correctly', () => {
      vi.useFakeTimers();
      // 45 minutes before the start
      vi.setSystemTime(new Date('2024-12-24T17:15:00.000'));

      const result = getCountdownTime('2024-12-24', '18:00');

      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(45);
      expect(result.seconds).toBe(0);
    });

    it('should calculate seconds correctly', () => {
      vi.useFakeTimers();
      // 30 seconds before the start
      vi.setSystemTime(new Date('2024-12-24T17:59:30.000'));

      const result = getCountdownTime('2024-12-24', '18:00');

      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(30);
    });

    it('should calculate combined hours, minutes and seconds', () => {
      vi.useFakeTimers();
      // 2h 30m 15s before the start
      vi.setSystemTime(new Date('2024-12-24T15:29:45.000'));

      const result = getCountdownTime('2024-12-24', '18:00');

      expect(result.hours).toBe(2);
      expect(result.minutes).toBe(30);
      expect(result.seconds).toBe(15);
    });

    it('should not return negative total', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00'));

      const result = getCountdownTime('2024-12-24', '18:00');

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
