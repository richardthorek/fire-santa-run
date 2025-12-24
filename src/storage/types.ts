import type { Route } from '../types';

export interface Brigade {
  id: string;
  name: string;
  allowedDomains?: string[];
  allowedEmails?: string[];
  createdAt: string;
}

export interface IStorageAdapter {
  // Route operations
  saveRoute(brigadeId: string, route: Route): Promise<void>;
  getRoutes(brigadeId: string): Promise<Route[]>;
  getRoute(brigadeId: string, routeId: string): Promise<Route | null>;
  deleteRoute(brigadeId: string, routeId: string): Promise<void>;
  
  // Brigade operations
  getBrigade(brigadeId: string): Promise<Brigade | null>;
  saveBrigade(brigade: Brigade): Promise<void>;
}
