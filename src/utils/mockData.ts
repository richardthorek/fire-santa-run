import type { Route } from '../types';
import type { Brigade } from '../storage';

/**
 * Mock brigade data for development and testing.
 * Used when VITE_DEV_MODE=true.
 */
export const mockBrigade: Brigade = {
  id: 'dev-brigade-1',
  name: 'Griffith Rural Fire Brigade',
  allowedDomains: ['@griffithrfs.org.au', '@rfs.nsw.gov.au'],
  allowedEmails: ['dev@example.com'],
  createdAt: '2024-12-01T00:00:00.000Z',
};

/**
 * Mock routes for development and testing.
 */
export const mockRoutes: Route[] = [
  {
    id: 'route_1',
    name: 'Christmas Eve 2024 - North Route',
    date: '2024-12-24',
    startTime: '18:00',
    waypoints: [
      {
        id: 'wp_1',
        coordinates: [146.0391, -34.2908], // Griffith Fire Station
        address: 'Griffith Fire Station, Benerembah St, Griffith NSW 2680',
        estimatedTime: '18:00',
      },
      {
        id: 'wp_2',
        coordinates: [146.0445, -34.2845],
        address: 'Jubilee Park, Griffith NSW 2680',
        estimatedTime: '18:15',
      },
      {
        id: 'wp_3',
        coordinates: [146.0521, -34.2756],
        address: 'Griffith Shopping Centre, Banna Ave, Griffith NSW 2680',
        estimatedTime: '18:30',
      },
      {
        id: 'wp_4',
        coordinates: [146.0389, -34.2634],
        address: 'Pioneer Park Museum, Griffith NSW 2680',
        estimatedTime: '18:45',
      },
    ],
    isActive: false,
    createdAt: '2024-12-15T10:30:00.000Z',
  },
  {
    id: 'route_2',
    name: 'Christmas Eve 2024 - South Route',
    date: '2024-12-24',
    startTime: '19:30',
    waypoints: [
      {
        id: 'wp_5',
        coordinates: [146.0391, -34.2908], // Griffith Fire Station
        address: 'Griffith Fire Station, Benerembah St, Griffith NSW 2680',
        estimatedTime: '19:30',
      },
      {
        id: 'wp_6',
        coordinates: [146.0321, -34.3021],
        address: 'South Griffith Residential Area',
        estimatedTime: '19:45',
      },
      {
        id: 'wp_7',
        coordinates: [146.0189, -34.3134],
        address: 'Lake Wyangan, Griffith NSW 2680',
        estimatedTime: '20:00',
      },
    ],
    isActive: false,
    createdAt: '2024-12-15T11:00:00.000Z',
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
