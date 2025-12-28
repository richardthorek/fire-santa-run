import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUserLocation, getDefaultMapCenter } from '../mapCenter';
import { DEFAULT_CENTER } from '../../config/mapbox';
import type { Brigade } from '../../storage';

describe('getUserLocation', () => {
  beforeEach(() => {
    // Clear any existing mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null if geolocation is not available', async () => {
    // Mock navigator.geolocation as undefined
    const originalGeolocation = global.navigator.geolocation;
    Object.defineProperty(global.navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const result = await getUserLocation();
    expect(result).toBeNull();

    // Restore
    Object.defineProperty(global.navigator, 'geolocation', {
      value: originalGeolocation,
      writable: true,
      configurable: true,
    });
  });

  it('should return coordinates when geolocation succeeds', async () => {
    const mockPosition = {
      coords: {
        longitude: 151.2093,
        latitude: -33.8688,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success(mockPosition);
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const result = await getUserLocation();
    expect(result).toEqual([151.2093, -33.8688]);
  });

  it('should return null when geolocation permission is denied', async () => {
    const mockError = {
      code: 1, // PERMISSION_DENIED
      message: 'User denied Geolocation',
    };

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success, error) => {
        error(mockError);
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const result = await getUserLocation();
    expect(result).toBeNull();
  });

  it('should return null when geolocation times out', async () => {
    const mockError = {
      code: 3, // TIMEOUT
      message: 'Timeout expired',
    };

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success, error) => {
        error(mockError);
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const result = await getUserLocation();
    expect(result).toBeNull();
  });

  it('should use correct geolocation options', async () => {
    const mockPosition = {
      coords: {
        longitude: 151.2093,
        latitude: -33.8688,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success(mockPosition);
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    await getUserLocation();

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        timeout: 5000,
        maximumAge: 300000,
      }
    );
  });
});

describe('getDefaultMapCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return brigade station coordinates when available (Priority 1)', async () => {
    const brigade: Brigade = {
      id: 'test-brigade',
      slug: 'test-brigade',
      name: 'Test Fire Brigade',
      location: 'Test Location',
      stationCoordinates: [146.0391, -34.2908],
      allowedDomains: [],
      allowedEmails: [],
      requireManualApproval: false,
      adminUserIds: [],
      isClaimed: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = await getDefaultMapCenter(brigade);
    expect(result).toEqual([146.0391, -34.2908]);
  });

  it('should return user location when brigade has no station coordinates (Priority 2)', async () => {
    const brigade: Brigade = {
      id: 'test-brigade',
      slug: 'test-brigade',
      name: 'Test Fire Brigade',
      location: 'Test Location',
      allowedDomains: [],
      allowedEmails: [],
      requireManualApproval: false,
      adminUserIds: [],
      isClaimed: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const mockPosition = {
      coords: {
        longitude: 151.2093,
        latitude: -33.8688,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success(mockPosition);
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const result = await getDefaultMapCenter(brigade);
    expect(result).toEqual([151.2093, -33.8688]);
  });

  it('should return DEFAULT_CENTER when no brigade and no user location (Priority 3)', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success, error) => {
        error({ code: 1, message: 'Permission denied' });
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const result = await getDefaultMapCenter(null);
    expect(result).toEqual(DEFAULT_CENTER);
  });

  it('should return DEFAULT_CENTER when brigade is undefined', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success, error) => {
        error({ code: 1, message: 'Permission denied' });
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const result = await getDefaultMapCenter(undefined);
    expect(result).toEqual(DEFAULT_CENTER);
  });

  it('should handle getUserLocation exceptions gracefully', async () => {
    const brigade: Brigade = {
      id: 'test-brigade',
      slug: 'test-brigade',
      name: 'Test Fire Brigade',
      location: 'Test Location',
      allowedDomains: [],
      allowedEmails: [],
      requireManualApproval: false,
      adminUserIds: [],
      isClaimed: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    // Mock geolocation to throw an error
    const mockGeolocation = {
      getCurrentPosition: vi.fn(() => {
        throw new Error('Geolocation API error');
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const result = await getDefaultMapCenter(brigade);
    expect(result).toEqual(DEFAULT_CENTER);
  });

  it('should validate coordinate format for brigade station', async () => {
    const brigade: Brigade = {
      id: 'test-brigade',
      slug: 'test-brigade',
      name: 'Test Fire Brigade',
      location: 'Test Location',
      stationCoordinates: [146.0391, -34.2908],
      allowedDomains: [],
      allowedEmails: [],
      requireManualApproval: false,
      adminUserIds: [],
      isClaimed: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = await getDefaultMapCenter(brigade);
    
    // Verify it's an array with 2 elements
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    
    // Verify both elements are numbers
    expect(typeof result[0]).toBe('number');
    expect(typeof result[1]).toBe('number');
    
    // Verify longitude is in valid range (-180 to 180)
    expect(result[0]).toBeGreaterThanOrEqual(-180);
    expect(result[0]).toBeLessThanOrEqual(180);
    
    // Verify latitude is in valid range (-90 to 90)
    expect(result[1]).toBeGreaterThanOrEqual(-90);
    expect(result[1]).toBeLessThanOrEqual(90);
  });
});
