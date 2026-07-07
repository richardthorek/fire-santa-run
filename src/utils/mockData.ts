import type { Route, RouteAnalytics } from '../types';
import type { Brigade } from '../storage';
import type { BrigadeMembership } from '../types/membership';

/**
 * Format a date offset from today as YYYY-MM-DD, so demo routes always look
 * current: an upcoming run to publish, a published run in a couple of days,
 * and a completed run from last week.
 */
function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/**
 * Mock brigade data for development and testing.
 * Used when VITE_DEV_MODE=true.
 */
export const mockBrigade: Brigade = {
  id: 'dev-brigade-1',
  slug: 'griffith-rfs',
  name: 'Griffith Rural Fire Brigade',
  location: 'Griffith, NSW',
  stationCoordinates: [146.0391, -34.2908], // Griffith Fire Station
  rfsStationId: undefined,
  logo: undefined,
  themeColor: '#D32F2F',
  allowedDomains: ['@griffithrfs.org.au', '@rfs.nsw.gov.au'],
  allowedEmails: ['dev@example.com'],
  requireManualApproval: false,
  adminUserIds: ['dev-user-1'],
  isClaimed: true,
  claimedAt: '2024-12-01T00:00:00.000Z',
  claimedBy: 'dev-user-1',
  contact: {
    email: 'griffith@rfs.nsw.gov.au',
    phone: '02 6962 1234',
    website: 'https://www.rfs.nsw.gov.au',
  },
  createdAt: '2024-12-01T00:00:00.000Z',
  updatedAt: '2024-12-01T00:00:00.000Z',
};

/**
 * Mock routes for development and testing.
 */
export const mockRoutes: Route[] = [
  {
    id: 'route_1',
    brigadeId: 'dev-brigade-1',
    name: 'Christmas Eve - North Route',
    description: 'Northern suburbs route covering Jubilee Park and shopping district',
    date: daysFromToday(5),
    startTime: '18:00',
    status: 'draft',
    waypoints: [
      {
        id: 'wp_1',
        coordinates: [146.0391, -34.2908], // Griffith Fire Station
        address: 'Griffith Fire Station, Benerembah St, Griffith NSW 2680',
        name: 'Fire Station (Start)',
        order: 0,
        isCompleted: false,
      },
      {
        id: 'wp_2',
        coordinates: [146.0445, -34.2845],
        address: 'Jubilee Park, Griffith NSW 2680',
        name: 'Jubilee Park',
        order: 1,
        isCompleted: false,
      },
      {
        id: 'wp_3',
        coordinates: [146.0521, -34.2756],
        address: 'Griffith Shopping Centre, Banna Ave, Griffith NSW 2680',
        name: 'Shopping Centre',
        order: 2,
        isCompleted: false,
      },
      {
        id: 'wp_4',
        coordinates: [146.0389, -34.2634],
        address: 'Pioneer Park Museum, Griffith NSW 2680',
        name: 'Pioneer Park',
        order: 3,
        isCompleted: false,
      },
    ],
    createdAt: '2024-12-15T10:30:00.000Z',
  },
  {
    id: 'route_2',
    brigadeId: 'dev-brigade-1',
    name: 'Christmas Eve - South Route',
    description: 'Southern suburbs route to Lake Wyangan',
    date: daysFromToday(2),
    startTime: '19:30',
    status: 'published',
    waypoints: [
      {
        id: 'wp_5',
        coordinates: [146.0391, -34.2908], // Griffith Fire Station
        address: 'Griffith Fire Station, Benerembah St, Griffith NSW 2680',
        name: 'Fire Station (Start)',
        order: 0,
        isCompleted: false,
      },
      {
        id: 'wp_6',
        coordinates: [146.0321, -34.3021],
        address: 'South Griffith Residential Area',
        name: 'South Residential',
        order: 1,
        isCompleted: false,
      },
      {
        id: 'wp_7',
        coordinates: [146.0189, -34.3134],
        address: 'Lake Wyangan, Griffith NSW 2680',
        name: 'Lake Wyangan',
        order: 2,
        isCompleted: false,
      },
    ],
    shareableLink: 'http://localhost:5173/track/route_2',
    createdAt: '2024-12-15T11:00:00.000Z',
    publishedAt: '2024-12-16T09:00:00.000Z',
  },
  {
    id: 'route_3',
    brigadeId: 'dev-brigade-1',
    name: 'Twilight Run - Town Centre',
    description: 'Last week\'s completed run through the town centre',
    date: daysFromToday(-7),
    startTime: '19:00',
    status: 'completed',
    waypoints: [
      {
        id: 'wp_8',
        coordinates: [146.0391, -34.2908],
        address: 'Griffith Fire Station, Benerembah St, Griffith NSW 2680',
        name: 'Fire Station (Start)',
        order: 0,
        isCompleted: true,
      },
      {
        id: 'wp_9',
        coordinates: [146.0452, -34.2881],
        address: 'Banna Ave, Griffith NSW 2680',
        name: 'Banna Avenue',
        order: 1,
        isCompleted: true,
      },
      {
        id: 'wp_10',
        coordinates: [146.0501, -34.2839],
        address: 'City Park, Griffith NSW 2680',
        name: 'City Park',
        order: 2,
        isCompleted: true,
      },
    ],
    shareableLink: 'http://localhost:5173/track/route_3',
    createdAt: '2024-12-10T09:00:00.000Z',
    publishedAt: '2024-12-11T09:00:00.000Z',
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

/**
 * Mock membership: the dev user is an active admin of the mock brigade, so
 * Brigade Settings and Member Management are usable in dev mode.
 */
export const mockMembership: BrigadeMembership = {
  id: 'dev-membership-1',
  brigadeId: 'dev-brigade-1',
  userId: 'dev-user-1',
  role: 'admin',
  status: 'active',
  approvedBy: 'dev-user-1',
  joinedAt: '2024-12-01T00:00:00.000Z',
  createdAt: '2024-12-01T00:00:00.000Z',
  updatedAt: '2024-12-01T00:00:00.000Z',
};

/**
 * Initialize mock data in storage.
 * Call this on app startup in dev mode.
 */
// Bump when the mock dataset changes shape so existing dev browsers re-seed
// instead of keeping stale demo data forever.
const MOCK_SEED_VERSION = '2';
const MOCK_SEED_VERSION_KEY = 'santa_mock_seed_version';

export async function initializeMockData(
  saveBrigade: (brigade: Brigade) => Promise<void>,
  saveRoute: (brigadeId: string, route: Route) => Promise<void>,
  saveMembership?: (membership: BrigadeMembership) => Promise<void>
): Promise<void> {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  if (!isDevMode) {
    return;
  }

  // Check if current-version data already exists
  const existingBrigadeJson = localStorage.getItem(`santa_${mockBrigade.id}_brigade`);
  const seededVersion = localStorage.getItem(MOCK_SEED_VERSION_KEY);
  if (existingBrigadeJson && seededVersion === MOCK_SEED_VERSION) {
    // Data already initialized
    return;
  }

  // Save mock brigade
  await saveBrigade(mockBrigade);

  // Save mock routes
  for (const route of mockRoutes) {
    await saveRoute(mockBrigade.id, route);
  }

  // Make the dev user an active admin so member/settings pages are usable
  if (saveMembership) {
    await saveMembership(mockMembership);
  }

  localStorage.setItem(MOCK_SEED_VERSION_KEY, MOCK_SEED_VERSION);
  console.log('Mock data initialized successfully');
}

/**
 * Generate mock analytics for a route (dev mode only).
 * Provides realistic demo data for the analytics dashboard.
 */
export function generateMockAnalytics(routeId: string): RouteAnalytics {
  const baseTime = Date.now() - 24 * 60 * 60 * 1000; // Last 24 hours

  return {
    routeId,
    brigadeId: 'dev-brigade-1',
    totalViews: 247,
    uniqueViewers: 185,
    peakConcurrentViewers: 18,
    totalViewDuration: 3600, // seconds
    averageViewDuration: 15 * 60, // 15 minutes average
    viewersBySource: {
      direct: 89,
      qr_code: 104,
      social: 32,
      search: 18,
      other: 4,
    },
    viewersByLocation: [
      { country: 'Australia', city: 'Griffith', count: 210 },
      { country: 'Australia', city: 'Sydney', count: 18 },
      { country: 'Australia', city: 'Melbourne', count: 12 },
      { country: 'Australia', city: 'Brisbane', count: 5 },
      { country: 'United States', city: 'New York', count: 2 },
    ],
    viewsOverTime: Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(baseTime + i * 60 * 60 * 1000).toISOString(),
      count: Math.floor(Math.random() * 20) + 5,
    })),
    lastUpdated: new Date().toISOString(),
  };
}
