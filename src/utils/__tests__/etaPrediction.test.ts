/**
 * Unit tests for predictive ETA utilities
 */

import { describe, it, expect } from 'vitest';
import { buildEtaModel, predictDuration, predictRouteDuration, sampleFromRoute } from '../etaPrediction';
import type { Route } from '../../types';

function completedRoute(estimated: number, actual: number, overrides: Partial<Route> = {}): Route {
  return {
    id: `route-${Math.random().toString(36).slice(2)}`,
    brigadeId: 'brigade-1',
    name: 'Past Run',
    date: '2025-12-24',
    startTime: '18:00',
    status: 'completed',
    waypoints: [],
    estimatedDuration: estimated,
    actualDuration: actual,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('etaPrediction', () => {
  describe('sampleFromRoute', () => {
    it('extracts the actual/estimated factor from a completed route', () => {
      const sample = sampleFromRoute(completedRoute(3600, 4320));
      expect(sample?.factor).toBeCloseTo(1.2);
      expect(sample?.startHour).toBe(18);
    });

    it('ignores drafts and routes without timing data', () => {
      expect(sampleFromRoute(completedRoute(3600, 4320, { status: 'draft' }))).toBeNull();
      expect(sampleFromRoute(completedRoute(0, 4320))).toBeNull();
      expect(sampleFromRoute(completedRoute(3600, 0))).toBeNull();
    });

    it('discards outliers (paused/abandoned runs)', () => {
      expect(sampleFromRoute(completedRoute(3600, 3600 * 10))).toBeNull();
    });
  });

  describe('buildEtaModel', () => {
    it('returns a neutral model with no history', () => {
      const model = buildEtaModel([]);
      expect(model.overallFactor).toBe(1);
      expect(model.samples).toHaveLength(0);
    });

    it('uses the median factor, robust to a single slow run', () => {
      const model = buildEtaModel([
        completedRoute(3600, 3600),
        completedRoute(3600, 3700),
        completedRoute(3600, 3600 * 2.5),
      ]);
      expect(model.overallFactor).toBeCloseTo(3700 / 3600);
    });
  });

  describe('predictDuration', () => {
    it('is low confidence with no samples and returns the base estimate', () => {
      const prediction = predictDuration(3600, buildEtaModel([]));
      expect(prediction.duration).toBe(3600);
      expect(prediction.confidence).toBe('low');
    });

    it('is high confidence with many consistent samples', () => {
      const routes = Array.from({ length: 6 }, () => completedRoute(3600, 4300 + Math.round(Math.random() * 40)));
      const model = buildEtaModel(routes);
      const prediction = predictDuration(3600, model);
      expect(prediction.confidence).toBe('high');
      expect(prediction.duration).toBeGreaterThan(4200);
      expect(prediction.sampleCount).toBe(6);
    });

    it('is low/medium confidence when history is inconsistent', () => {
      const model = buildEtaModel([
        completedRoute(3600, 1800),
        completedRoute(3600, 7200),
        completedRoute(3600, 3600),
        completedRoute(3600, 5400),
        completedRoute(3600, 2400),
      ]);
      const prediction = predictDuration(3600, model);
      expect(prediction.confidence).not.toBe('high');
    });

    it('blends time-of-day factor when the start hour has history', () => {
      const routes = [
        completedRoute(3600, 3600, { startTime: '10:00' }),
        completedRoute(3600, 3600, { startTime: '10:00' }),
        completedRoute(3600, 5400, { startTime: '19:00' }),
        completedRoute(3600, 5400, { startTime: '19:00' }),
      ];
      const model = buildEtaModel(routes);
      const evening = predictDuration(3600, model, 19);
      const morning = predictDuration(3600, model, 10);
      expect(evening.duration).toBeGreaterThan(morning.duration);
    });
  });

  describe('predictRouteDuration', () => {
    it('excludes the route itself from its own model', () => {
      const target = completedRoute(3600, 7200, { id: 'target' });
      expect(predictRouteDuration(target, [target])).toBeNull();
    });

    it('predicts using sibling route history', () => {
      const target = completedRoute(3600, 0, { id: 'target', status: 'published', actualDuration: undefined });
      const history = [completedRoute(3600, 4320), completedRoute(1800, 2160), completedRoute(7200, 8640)];
      const prediction = predictRouteDuration(target, [target, ...history]);
      expect(prediction).not.toBeNull();
      expect(prediction!.factor).toBeCloseTo(1.2);
      expect(prediction!.duration).toBe(Math.round(3600 * prediction!.factor));
    });
  });
});
