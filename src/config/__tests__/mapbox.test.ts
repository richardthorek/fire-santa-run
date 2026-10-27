import { describe, it, expect } from 'vitest';
import { lightPresetForHour } from '../mapbox';

describe('lightPresetForHour', () => {
  it.each([
    [4, 'night'],
    [5, 'dawn'],
    [6, 'dawn'],
    [7, 'day'],
    [16, 'day'],
    [17, 'dusk'],
    [18, 'dusk'],
    [19, 'night'],
    [23, 'night'],
  ])('hour %i gives %s', (hour, preset) => {
    expect(lightPresetForHour(hour)).toBe(preset);
  });
});
