// @vitest-environment node
/**
 * Server-side route logic that protects organiser data and viewer privacy:
 * redaction for non-members, merging PUT updates, and the k-anonymity rule
 * for waiting-spot pins.
 */
import { describe, it, expect } from 'vitest';
import { redactForPublic } from '../utils/routeRedaction';
import { mergeRouteUpdate } from '../utils/routeMerge';
import { aggregatePinCells } from '../utils/viewerPinCells';

describe('redactForPublic', () => {
  it('removes organiser-only fields and keeps the public route', () => {
    const route = {
      id: 'r1',
      name: 'Riverside run',
      createdBy: 'organiser@example.com',
      lastEditedBy: { userId: 'u1', name: 'Sam' },
      comments: [{ id: 'c1', text: 'internal' }],
    };
    const result = redactForPublic(route);
    expect(result).toEqual({ id: 'r1', name: 'Riverside run' });
    expect('createdBy' in result).toBe(false);
    expect('comments' in result).toBe(false);
  });
});

describe('mergeRouteUpdate', () => {
  const now = new Date('2026-12-01T10:00:00.000Z');

  it('keeps stored values for fields the client omitted', () => {
    const stored = {
      name: 'Old name',
      geometry: { type: 'LineString', coordinates: [[151, -33]] },
      rerouteCount: 3,
      createdBy: 'organiser@example.com',
    };
    const result = mergeRouteUpdate(stored, { name: 'New name' }, 'r1', now);
    expect(result.name).toBe('New name');
    expect(result.geometry).toEqual(stored.geometry);
    expect(result.rerouteCount).toBe(3);
  });

  it('never lets the client change server-owned creation fields', () => {
    const stored = { createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'organiser@example.com', viewCount: 40 };
    const result = mergeRouteUpdate(
      stored,
      { createdAt: '1999-01-01T00:00:00.000Z', createdBy: 'someone@else.com', viewCount: 0 },
      'r1',
      now,
    );
    expect(result.createdAt).toBe(stored.createdAt);
    expect(result.createdBy).toBe(stored.createdBy);
    expect(result.viewCount).toBe(40);
  });

  it('stamps updatedAt on the server, ignoring any client value', () => {
    const result = mergeRouteUpdate(null, { updatedAt: '1999-01-01T00:00:00.000Z' }, 'r1', now);
    expect(result.updatedAt).toBe(now.toISOString());
  });

  it('uses the route id from the URL, not the body', () => {
    const result = mergeRouteUpdate(null, { id: 'other' }, 'r1', now);
    expect(result.id).toBe('r1');
  });

  it('writes the request as-is when there is no stored route', () => {
    const result = mergeRouteUpdate(null, { name: 'Brand new', createdBy: 'x@y.com' }, 'r1', now);
    expect(result.name).toBe('Brand new');
    expect(result.createdBy).toBe('x@y.com');
  });
});

describe('aggregatePinCells', () => {
  const pin = (lng: number, lat: number) => ({ lng, lat, at: 0 });

  it('withholds a lone viewer', () => {
    expect(aggregatePinCells([pin(151.2093, -33.8688)], 3)).toEqual([]);
  });

  it('withholds a group of two', () => {
    const pins = [pin(151.2093, -33.8688), pin(151.2093, -33.8688)];
    expect(aggregatePinCells(pins, 3)).toEqual([]);
  });

  it('shows a group of three at the same rounded position', () => {
    const pins = [pin(151.2093, -33.8688), pin(151.20931, -33.86882), pin(151.2093, -33.8688)];
    expect(aggregatePinCells(pins, 3)).toEqual([{ lng: 151.209, lat: -33.869, count: 3 }]);
  });

  it('shows only the large group when a lone viewer sits elsewhere', () => {
    const pins = [pin(150, -34), pin(150, -34), pin(150, -34), pin(151, -33)];
    expect(aggregatePinCells(pins, 3)).toEqual([{ lng: 150, lat: -34, count: 3 }]);
  });
});
