import type { Route } from '../types';
import type { Brigade } from '../storage';

/**
 * Mock brigade data for development and testing.
 * Used when VITE_DEV_MODE=true.
 */
export const mockBrigade: Brigade = {
  id: 'dev-brigade-1',
  slug: 'griffith-rfs',
  name: 'Griffith Rural Fire Brigade',
  location: 'Griffith, NSW',
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
    name: 'Christmas Eve 2024 - North Route',
    description: 'Northern suburbs route covering Jubilee Park and shopping district',
    date: '2024-12-24',
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
    name: 'Christmas Eve 2024 - South Route',
    description: 'Southern suburbs route to Lake Wyangan',
    date: '2024-12-24',
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
];

/**
 * Initialize mock data in storage.
 * Call this on app startup in dev mode.
 */
export async function initializeMockData(
  saveBrigade: (brigade: Brigade) => Promise<void>,
  saveRoute: (brigadeId: string, route: Route) => Promise<void>
): Promise<void> {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  if (!isDevMode) {
    return;
  }

  // Check if data already exists
  const existingBrigadeJson = localStorage.getItem(`santa_${mockBrigade.id}_brigade`);
  if (existingBrigadeJson) {
    // Data already initialized
    return;
  }

  // Save mock brigade
  await saveBrigade(mockBrigade);

  // Save mock routes
  for (const route of mockRoutes) {
    await saveRoute(mockBrigade.id, route);
  }

  console.log('Mock data initialized successfully');
}
