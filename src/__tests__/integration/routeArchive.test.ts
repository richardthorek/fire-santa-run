/**
 * Integration Test: Route Archive System
 *
 * Tests the archive/restore flow:
 * 1. Archiving a completed route
 * 2. Restoring an archived route
 * 3. Auto-archive eligibility detection
 * 4. Approaching auto-archive notification detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  archiveRoute,
  restoreRoute,
  isEligibleForAutoArchive,
  isApproachingAutoArchive,
  daysUntilAutoArchive,
  DEFAULT_ARCHIVE_THRESHOLD_DAYS,
} from '../../utils/routeHelpers';
import { createMockRoute } from './testUtils';
import type { Route } from '../../types';

describe('Route Archive System', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('archiveRoute', () => {
    it('should set status to archived and set archivedAt', () => {
      const route = createMockRoute({ status: 'completed', completedAt: new Date().toISOString() });
      const archived = archiveRoute(route);

      expect(archived.status).toBe('archived');
      expect(archived.archivedAt).toBeDefined();
      expect(new Date(archived.archivedAt!).getTime()).toBeGreaterThan(0);
    });

    it('should preserve all other route fields', () => {
      const route = createMockRoute({ status: 'completed', completedAt: new Date().toISOString() });
      const archived = archiveRoute(route);

      expect(archived.id).toBe(route.id);
      expect(archived.name).toBe(route.name);
      expect(archived.brigadeId).toBe(route.brigadeId);
      expect(archived.completedAt).toBe(route.completedAt);
    });
  });

  describe('restoreRoute', () => {
    it('should set status back to completed and clear archivedAt', () => {
      const route = createMockRoute({
        status: 'archived',
        completedAt: new Date().toISOString(),
        archivedAt: new Date().toISOString(),
      });
      const restored = restoreRoute(route);

      expect(restored.status).toBe('completed');
      expect(restored.archivedAt).toBeUndefined();
    });

    it('should preserve all other route fields when restoring', () => {
      const completedAt = new Date().toISOString();
      const route = createMockRoute({
        status: 'archived',
        completedAt,
        archivedAt: new Date().toISOString(),
      });
      const restored = restoreRoute(route);

      expect(restored.id).toBe(route.id);
      expect(restored.name).toBe(route.name);
      expect(restored.completedAt).toBe(completedAt);
    });
  });

  describe('isEligibleForAutoArchive', () => {
    it('should return false for non-completed routes', () => {
      const draftRoute = createMockRoute({ status: 'draft' });
      const publishedRoute = createMockRoute({ status: 'published' });
      const activeRoute = createMockRoute({ status: 'active' });
      const archivedRoute = createMockRoute({ status: 'archived' });

      expect(isEligibleForAutoArchive(draftRoute)).toBe(false);
      expect(isEligibleForAutoArchive(publishedRoute)).toBe(false);
      expect(isEligibleForAutoArchive(activeRoute)).toBe(false);
      expect(isEligibleForAutoArchive(archivedRoute)).toBe(false);
    });

    it('should return false for recently completed routes', () => {
      const route = createMockRoute({
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      expect(isEligibleForAutoArchive(route, 90)).toBe(false);
    });

    it('should return true for routes completed more than threshold days ago', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91); // 91 days ago
      const route = createMockRoute({
        status: 'completed',
        completedAt: oldDate.toISOString(),
      });
      expect(isEligibleForAutoArchive(route, 90)).toBe(true);
    });

    it('should use DEFAULT_ARCHIVE_THRESHOLD_DAYS by default', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - (DEFAULT_ARCHIVE_THRESHOLD_DAYS + 1));
      const route = createMockRoute({
        status: 'completed',
        completedAt: oldDate.toISOString(),
      });
      expect(isEligibleForAutoArchive(route)).toBe(true);
    });

    it('should fall back to createdAt if completedAt is missing', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);
      const route: Route = {
        ...createMockRoute({ status: 'completed' }),
        completedAt: undefined,
        createdAt: oldDate.toISOString(),
      };
      expect(isEligibleForAutoArchive(route, 90)).toBe(true);
    });
  });

  describe('isApproachingAutoArchive', () => {
    it('should return false for non-completed routes', () => {
      const route = createMockRoute({ status: 'draft' });
      expect(isApproachingAutoArchive(route)).toBe(false);
    });

    it('should return false if more than 7 days remain until threshold', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // only 10 days ago, threshold is 90
      const route = createMockRoute({
        status: 'completed',
        completedAt: recentDate.toISOString(),
      });
      expect(isApproachingAutoArchive(route, 90)).toBe(false);
    });

    it('should return true if within 7 days of threshold', () => {
      const date = new Date();
      date.setDate(date.getDate() - 85); // 85 days ago, threshold is 90 → 5 days remaining
      const route = createMockRoute({
        status: 'completed',
        completedAt: date.toISOString(),
      });
      expect(isApproachingAutoArchive(route, 90)).toBe(true);
    });

    it('should return false if already past threshold (eligible for auto-archive)', () => {
      const date = new Date();
      date.setDate(date.getDate() - 91);
      const route = createMockRoute({
        status: 'completed',
        completedAt: date.toISOString(),
      });
      expect(isApproachingAutoArchive(route, 90)).toBe(false);
    });
  });

  describe('daysUntilAutoArchive', () => {
    it('should return -1 for non-completed routes', () => {
      const route = createMockRoute({ status: 'draft' });
      expect(daysUntilAutoArchive(route)).toBe(-1);
    });

    it('should return remaining days for completed route', () => {
      const date = new Date();
      date.setDate(date.getDate() - 85); // 85 days ago
      const route = createMockRoute({
        status: 'completed',
        completedAt: date.toISOString(),
      });
      const remaining = daysUntilAutoArchive(route, 90);
      expect(remaining).toBeGreaterThanOrEqual(4);
      expect(remaining).toBeLessThanOrEqual(6);
    });

    it('should return 0 if past threshold', () => {
      const date = new Date();
      date.setDate(date.getDate() - 91);
      const route = createMockRoute({
        status: 'completed',
        completedAt: date.toISOString(),
      });
      expect(daysUntilAutoArchive(route, 90)).toBe(0);
    });
  });
});
