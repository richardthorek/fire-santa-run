/**
 * Tests for useRouteEditor's unsaved-changes ("dirty") tracking.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRouteEditor } from '../useRouteEditor';
import type { Route } from '../../types';

function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: 'route-1',
    brigadeId: 'brigade-1',
    name: 'Test Route',
    date: '2099-12-24',
    startTime: '18:00',
    status: 'draft',
    waypoints: [],
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('useRouteEditor — unsaved changes tracking', () => {
  it('starts clean (not dirty)', () => {
    const { result } = renderHook(() => useRouteEditor(makeRoute()));
    expect(result.current.isDirty).toBe(false);
  });

  it('becomes dirty after a metadata edit', () => {
    const { result } = renderHook(() => useRouteEditor(makeRoute()));

    act(() => {
      result.current.updateMetadata({ name: 'Updated Name' });
    });

    expect(result.current.isDirty).toBe(true);
  });

  it('becomes dirty after adding a waypoint', () => {
    const { result } = renderHook(() => useRouteEditor(makeRoute()));

    act(() => {
      result.current.addWaypoint([151.2, -33.8]);
    });

    expect(result.current.isDirty).toBe(true);
  });

  it('markSaved clears the dirty flag without changing the route', () => {
    const { result } = renderHook(() => useRouteEditor(makeRoute()));

    act(() => {
      result.current.updateMetadata({ name: 'Updated Name' });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.markSaved();
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.route.name).toBe('Updated Name');
  });

  it('resetRoute(newRoute) loads a fresh route and clears dirty state', () => {
    const { result } = renderHook(() => useRouteEditor(makeRoute()));

    act(() => {
      result.current.updateMetadata({ name: 'Unsaved edit' });
    });
    expect(result.current.isDirty).toBe(true);

    const loaded = makeRoute({ id: 'route-2', name: 'Loaded From Server' });
    act(() => {
      result.current.resetRoute(loaded);
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.route.name).toBe('Loaded From Server');
  });

  it('resetRoute() with no argument reverts to the initial route and clears dirty state', () => {
    const initial = makeRoute({ name: 'Initial' });
    const { result } = renderHook(() => useRouteEditor(initial));

    act(() => {
      result.current.updateMetadata({ name: 'Unsaved edit' });
    });

    act(() => {
      result.current.resetRoute();
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.route.name).toBe('Initial');
  });

  it('remains dirty after further edits following a save', () => {
    const { result } = renderHook(() => useRouteEditor(makeRoute()));

    act(() => {
      result.current.updateMetadata({ name: 'First edit' });
    });
    act(() => {
      result.current.markSaved();
    });
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateMetadata({ name: 'Second edit' });
    });

    expect(result.current.isDirty).toBe(true);
  });
});
