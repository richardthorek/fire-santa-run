import { TableClient } from '@azure/data-tables';
import type { Route, RouteTemplate, Waypoint } from '../types';
import type { IStorageAdapter, Brigade } from './types';
import type { User } from '../types/user';
import { isPublicRouteStatus } from '../utils/publicBrigade';

/**
 * Azure Table Storage implementation of the storage adapter.
 * Used in production mode (VITE_DEV_MODE=false) or dev mode with Azure credentials.
 * 
 * Table naming:
 * - Production: 'routes', 'brigades', 'users', 'memberships', 'invitations', 'verifications'
 * - Dev mode: 'devroutes', 'devbrigades', 'devusers', 'devmemberships', 'devinvitations', 'devverifications'
 */
export class AzureTableStorageAdapter implements IStorageAdapter {
  private routesClient: TableClient;
  private waypointsClient: TableClient;
  private brigadesClient: TableClient;
  private usersClient: TableClient;
  private membershipsClient: TableClient;
  private invitationsClient: TableClient;
  private verificationsClient: TableClient;
  private templatesClient: TableClient;
  
  /**
   * Creates an Azure Table Storage adapter.
   * @param connectionString - Azure Storage connection string
   * @param tablePrefix - Prefix for table names (e.g., 'dev' for dev mode)
   */
  constructor(connectionString: string, tablePrefix: string = '') {
    if (!connectionString) {
      throw new Error('Azure Storage connection string is required');
    }

    const routesTableName = tablePrefix ? `${tablePrefix}routes` : 'routes';
    const waypointsTableName = tablePrefix ? `${tablePrefix}routewaypoints` : 'routewaypoints';
    const brigadesTableName = tablePrefix ? `${tablePrefix}brigades` : 'brigades';
    const usersTableName = tablePrefix ? `${tablePrefix}users` : 'users';
    const membershipsTableName = tablePrefix ? `${tablePrefix}memberships` : 'memberships';
    const invitationsTableName = tablePrefix ? `${tablePrefix}invitations` : 'invitations';
    const verificationsTableName = tablePrefix ? `${tablePrefix}verifications` : 'verifications';
    const templatesTableName = tablePrefix ? `${tablePrefix}templates` : 'templates';
    
    this.routesClient = TableClient.fromConnectionString(connectionString, routesTableName);
    this.waypointsClient = TableClient.fromConnectionString(connectionString, waypointsTableName);
    this.brigadesClient = TableClient.fromConnectionString(connectionString, brigadesTableName);
    this.usersClient = TableClient.fromConnectionString(connectionString, usersTableName);
    this.membershipsClient = TableClient.fromConnectionString(connectionString, membershipsTableName);
    this.invitationsClient = TableClient.fromConnectionString(connectionString, invitationsTableName);
    this.verificationsClient = TableClient.fromConnectionString(connectionString, verificationsTableName);
    this.templatesClient = TableClient.fromConnectionString(connectionString, templatesTableName);
    
    // Ensure tables exist (creates if not exists)
    this.initializeTables().catch(err => {
      console.error('Failed to initialize Azure tables:', err);
    });
  }

  private async initializeTables(): Promise<void> {
    const clients = [
      this.routesClient,
      this.waypointsClient,
      this.brigadesClient,
      this.usersClient,
      this.membershipsClient,
      this.invitationsClient,
      this.verificationsClient,
      this.templatesClient,
    ];
    
    for (const client of clients) {
      try {
        await client.createTable();
      } catch (err: unknown) {
        const error = err as { statusCode?: number };
        // Ignore if table already exists (409)
        if (error.statusCode !== 409) {
          throw err;
        }
      }
    }
  }

  async saveRoute(brigadeId: string, route: Route): Promise<void> {
    // Two-table schema: the routes table stores RouteEntity (no waypoints);
    // waypoints go to the routewaypoints table.
    const { waypoints, ...routeEntity } = route;
    const entity = {
      partitionKey: brigadeId,
      rowKey: route.id,
      ...routeEntity,
    };

    try {
      await this.routesClient.upsertEntity(entity, 'Replace');
      await this.saveWaypoints(brigadeId, route.id, waypoints ?? []);
    } catch (error) {
      console.error('Failed to save route to Azure Table Storage:', error);
      throw new Error('Failed to save route');
    }
  }

  async getRoutes(brigadeId: string): Promise<Route[]> {
    try {
      const routes: Route[] = [];
      const entities = this.routesClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${brigadeId}'` }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...routeData } = entity;
        const route = routeData as unknown as Route;
        // Reconstruct waypoints (fall back to any embedded pre-split data)
        const waypoints = await this.getWaypoints(brigadeId, route.id);
        routes.push({ ...route, waypoints: waypoints.length > 0 ? waypoints : (route.waypoints ?? []) });
      }
      
      return routes;
    } catch (error) {
      console.error('Failed to get routes from Azure Table Storage:', error);
      return [];
    }
  }

  async getRoute(brigadeId: string, routeId: string): Promise<Route | null> {
    try {
      const entity = await this.routesClient.getEntity(brigadeId, routeId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { partitionKey, rowKey, timestamp, etag, ...routeData } = entity;
      const route = routeData as unknown as Route;
      // Reconstruct waypoints (fall back to any embedded pre-split data)
      const waypoints = await this.getWaypoints(brigadeId, routeId);
      return { ...route, waypoints: waypoints.length > 0 ? waypoints : (route.waypoints ?? []) };
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return null;
      }
      console.error('Failed to get route from Azure Table Storage:', error);
      throw new Error('Failed to get route');
    }
  }

  async getPublicRoute(routeId: string): Promise<Route | null> {
    try {
      // Route IDs are globally unique, so a RowKey scan finds at most one.
      const entities = this.routesClient.listEntities({
        queryOptions: { filter: `RowKey eq '${routeId.replace(/'/g, "''")}'` }
      });
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...routeData } = entity;
        const route = routeData as unknown as Route;
        if (!isPublicRouteStatus(route.status)) return null;
        // PartitionKey is the brigadeId — reconstruct waypoints from the
        // routewaypoints table (fall back to embedded pre-split data).
        const waypoints = await this.getWaypoints(partitionKey as string, routeId);
        return { ...route, waypoints: waypoints.length > 0 ? waypoints : (route.waypoints ?? []) };
      }
      return null;
    } catch (error) {
      console.error('Failed to get public route from Azure Table Storage:', error);
      throw new Error('Failed to get route');
    }
  }

  async deleteRoute(brigadeId: string, routeId: string): Promise<void> {
    try {
      await this.routesClient.deleteEntity(brigadeId, routeId);
      // Also delete waypoints for this route
      await this.deleteWaypoints(brigadeId, routeId);
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        // Entity doesn't exist, consider it a success
        return;
      }
      console.error('Failed to delete route from Azure Table Storage:', error);
      throw new Error('Failed to delete route');
    }
  }

  // Waypoint operations
  async saveWaypoint(brigadeId: string, routeId: string, waypoint: Waypoint): Promise<void> {
    const entity = {
      partitionKey: `${brigadeId}#${routeId}`,
      rowKey: `${String(waypoint.order).padStart(5, '0')}#${waypoint.id}`,
      ...waypoint,
    };

    try {
      await this.waypointsClient.upsertEntity(entity, 'Replace');
    } catch (error) {
      console.error('Failed to save waypoint to Azure Table Storage:', error);
      throw new Error('Failed to save waypoint');
    }
  }

  async saveWaypoints(brigadeId: string, routeId: string, waypoints: Waypoint[]): Promise<void> {
    // Delete existing waypoints first
    await this.deleteWaypoints(brigadeId, routeId);

    // Save all new waypoints
    for (const waypoint of waypoints) {
      await this.saveWaypoint(brigadeId, routeId, waypoint);
    }
  }

  async getWaypoints(brigadeId: string, routeId: string): Promise<Waypoint[]> {
    try {
      const waypoints: Waypoint[] = [];
      const partitionKey = `${brigadeId}#${routeId}`;
      const entities = this.waypointsClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
      });

      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...waypointData } = entity;
        waypoints.push(waypointData as unknown as Waypoint);
      }

      // Sort by order field to maintain sequence
      waypoints.sort((a, b) => a.order - b.order);
      return waypoints;
    } catch (error) {
      console.error('Failed to get waypoints from Azure Table Storage:', error);
      return [];
    }
  }

  async deleteWaypoints(brigadeId: string, routeId: string): Promise<void> {
    try {
      const partitionKey = `${brigadeId}#${routeId}`;
      const entities = this.waypointsClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
      });

      for await (const entity of entities) {
        try {
          await this.waypointsClient.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
        } catch (err) {
          // Continue deleting other entities even if one fails
          console.error('Failed to delete individual waypoint:', err);
        }
      }
    } catch (error) {
      console.error('Failed to delete waypoints from Azure Table Storage:', error);
      throw new Error('Failed to delete waypoints');
    }
  }

  // Template operations
  async saveTemplate(brigadeId: string, template: RouteTemplate): Promise<void> {
    const entity = {
      partitionKey: brigadeId,
      rowKey: template.id,
      ...template,
      waypoints: JSON.stringify(template.waypoints),
    };

    try {
      await this.templatesClient.upsertEntity(entity, 'Replace');
    } catch (error) {
      console.error('Failed to save template to Azure Table Storage:', error);
      throw new Error('Failed to save template');
    }
  }

  async getTemplates(brigadeId: string): Promise<RouteTemplate[]> {
    try {
      const templates: RouteTemplate[] = [];
      const entities = this.templatesClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${brigadeId}'` },
      });

      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, waypoints, ...rest } = entity;
        templates.push({
          ...(rest as unknown as RouteTemplate),
          waypoints: waypoints ? JSON.parse(waypoints as string) : [],
        });
      }

      return templates;
    } catch (error) {
      console.error('Failed to get templates from Azure Table Storage:', error);
      return [];
    }
  }

  async getTemplate(brigadeId: string, templateId: string): Promise<RouteTemplate | null> {
    try {
      const entity = await this.templatesClient.getEntity(brigadeId, templateId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { partitionKey, rowKey, timestamp, etag, waypoints, ...rest } = entity;
      return {
        ...(rest as unknown as RouteTemplate),
        waypoints: waypoints ? JSON.parse(waypoints as string) : [],
      };
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return null;
      }
      console.error('Failed to get template from Azure Table Storage:', error);
      throw new Error('Failed to get template');
    }
  }

  async deleteTemplate(brigadeId: string, templateId: string): Promise<void> {
    try {
      await this.templatesClient.deleteEntity(brigadeId, templateId);
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return;
      }
      console.error('Failed to delete template from Azure Table Storage:', error);
      throw new Error('Failed to delete template');
    }
  }

  async getBrigades(): Promise<Brigade[]> {
    try {
      const brigades: Brigade[] = [];
      for await (const entity of this.brigadesClient.listEntities()) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...brigadeData } = entity;
        brigades.push(brigadeData as unknown as Brigade);
      }
      return brigades;
    } catch (error) {
      console.error('Failed to list brigades from Azure Table Storage:', error);
      throw new Error('Failed to list brigades');
    }
  }

  async getBrigade(brigadeId: string): Promise<Brigade | null> {
    try {
      const entity = await this.brigadesClient.getEntity('brigades', brigadeId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { partitionKey, rowKey, timestamp, etag, ...brigadeData } = entity;
      return brigadeData as unknown as Brigade;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return null;
      }
      console.error('Failed to get brigade from Azure Table Storage:', error);
      throw new Error('Failed to get brigade');
    }
  }

  async getBrigadeByStationId(fireStationId: string): Promise<Brigade | null> {
    try {
      // Query for brigades where fireStationId matches
      const queryResults = this.brigadesClient.listEntities({
        queryOptions: {
          filter: `fireStationId eq '${fireStationId}'`,
        },
      });
      
      // Get first matching brigade
      for await (const entity of queryResults) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...brigadeData } = entity;
        return brigadeData as unknown as Brigade;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to query brigade by station ID from Azure Table Storage:', error);
      throw new Error('Failed to query brigade by station ID');
    }
  }

  async getBrigadeBySlug(slug: string): Promise<Brigade | null> {
    try {
      const queryResults = this.brigadesClient.listEntities({
        queryOptions: {
          filter: `slug eq '${slug.replace(/'/g, "''")}'`,
        },
      });

      for await (const entity of queryResults) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...brigadeData } = entity;
        return brigadeData as unknown as Brigade;
      }

      return null;
    } catch (error) {
      console.error('Failed to query brigade by slug from Azure Table Storage:', error);
      throw new Error('Failed to query brigade by slug');
    }
  }

  async saveBrigade(brigade: Brigade): Promise<void> {
    const entity = {
      partitionKey: 'brigades',
      rowKey: brigade.id,
      ...brigade,
    };
    
    try {
      await this.brigadesClient.upsertEntity(entity, 'Replace');
    } catch (error) {
      console.error('Failed to save brigade to Azure Table Storage:', error);
      throw new Error('Failed to save brigade');
    }
  }

  // User operations
  async saveUser(user: User): Promise<void> {
    const entity = {
      partitionKey: 'users',
      rowKey: user.id,
      ...user,
    };
    
    try {
      await this.usersClient.upsertEntity(entity, 'Replace');
    } catch (error) {
      console.error('Failed to save user to Azure Table Storage:', error);
      throw new Error('Failed to save user');
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      const entity = await this.usersClient.getEntity('users', userId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { partitionKey, rowKey, timestamp, etag, ...userData } = entity;
      return userData as unknown as User;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return null;
      }
      console.error('Failed to get user from Azure Table Storage:', error);
      throw new Error('Failed to get user');
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const users: User[] = [];
      const entities = this.usersClient.listEntities({
        queryOptions: { 
          filter: `PartitionKey eq 'users' and email eq '${email.toLowerCase()}'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...userData } = entity;
        users.push(userData as unknown as User);
      }
      
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Failed to get user by email from Azure Table Storage:', error);
      return null;
    }
  }

}
