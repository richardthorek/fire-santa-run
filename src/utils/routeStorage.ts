import { Route } from '../types';

const STORAGE_KEY = 'santa_routes';

export const saveRoute = (route: Route): void => {
  const routes = getRoutes();
  const existingIndex = routes.findIndex(r => r.id === route.id);
  
  if (existingIndex >= 0) {
    routes[existingIndex] = route;
  } else {
    routes.push(route);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
};

export const getRoutes = (): Route[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const getRoute = (id: string): Route | null => {
  const routes = getRoutes();
  return routes.find(r => r.id === id) || null;
};

export const deleteRoute = (id: string): void => {
  const routes = getRoutes().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
};

export const generateRouteId = (): string => {
  return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateShareableLink = (routeId: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/track/${routeId}`;
};
