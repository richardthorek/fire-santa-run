import { TableClient } from '@azure/data-tables';
import type { Route } from '../types';
import type { IStorageAdapter, Brigade } from './types';
import type { User } from '../types/user';
import type { BrigadeMembership } from '../types/membership';
import type { MemberInvitation } from '../types/invitation';
import type { AdminVerificationRequest } from '../types/verification';

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
  private brigadesClient: TableClient;
  private usersClient: TableClient;
  private membershipsClient: TableClient;
  private invitationsClient: TableClient;
  private verificationsClient: TableClient;
  
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
    const brigadesTableName = tablePrefix ? `${tablePrefix}brigades` : 'brigades';
    const usersTableName = tablePrefix ? `${tablePrefix}users` : 'users';
    const membershipsTableName = tablePrefix ? `${tablePrefix}memberships` : 'memberships';
    const invitationsTableName = tablePrefix ? `${tablePrefix}invitations` : 'invitations';
    const verificationsTableName = tablePrefix ? `${tablePrefix}verifications` : 'verifications';
    
    this.routesClient = TableClient.fromConnectionString(connectionString, routesTableName);
    this.brigadesClient = TableClient.fromConnectionString(connectionString, brigadesTableName);
    this.usersClient = TableClient.fromConnectionString(connectionString, usersTableName);
    this.membershipsClient = TableClient.fromConnectionString(connectionString, membershipsTableName);
    this.invitationsClient = TableClient.fromConnectionString(connectionString, invitationsTableName);
    this.verificationsClient = TableClient.fromConnectionString(connectionString, verificationsTableName);
    
    // Ensure tables exist (creates if not exists)
    this.initializeTables().catch(err => {
      console.error('Failed to initialize Azure tables:', err);
    });
  }

  private async initializeTables(): Promise<void> {
    const clients = [
      this.routesClient,
      this.brigadesClient,
      this.usersClient,
      this.membershipsClient,
      this.invitationsClient,
      this.verificationsClient
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
    const entity = {
      partitionKey: brigadeId,
      rowKey: route.id,
      ...route,
    };
    
    try {
      await this.routesClient.upsertEntity(entity, 'Replace');
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
        routes.push(routeData as unknown as Route);
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
      return routeData as unknown as Route;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return null;
      }
      console.error('Failed to get route from Azure Table Storage:', error);
      throw new Error('Failed to get route');
    }
  }

  async deleteRoute(brigadeId: string, routeId: string): Promise<void> {
    try {
      await this.routesClient.deleteEntity(brigadeId, routeId);
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

  async getBrigadeByRFSId(rfsStationId: string): Promise<Brigade | null> {
    try {
      // Query for brigades where rfsStationId matches
      const queryResults = this.brigadesClient.listEntities({
        queryOptions: {
          filter: `rfsStationId eq '${rfsStationId}'`,
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
      console.error('Failed to query brigade by RFS ID from Azure Table Storage:', error);
      throw new Error('Failed to query brigade by RFS ID');
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

  // Membership operations
  async saveMembership(membership: BrigadeMembership): Promise<void> {
    const entity = {
      partitionKey: membership.brigadeId,
      rowKey: membership.userId,
      ...membership,
    };
    
    try {
      await this.membershipsClient.upsertEntity(entity, 'Replace');
    } catch (error) {
      console.error('Failed to save membership to Azure Table Storage:', error);
      throw new Error('Failed to save membership');
    }
  }

  async getMembership(brigadeId: string, userId: string): Promise<BrigadeMembership | null> {
    try {
      const entity = await this.membershipsClient.getEntity(brigadeId, userId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { partitionKey, rowKey, timestamp, etag, ...membershipData } = entity;
      return membershipData as unknown as BrigadeMembership;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return null;
      }
      console.error('Failed to get membership from Azure Table Storage:', error);
      throw new Error('Failed to get membership');
    }
  }

  async getMembershipById(membershipId: string): Promise<BrigadeMembership | null> {
    try {
      const memberships: BrigadeMembership[] = [];
      const entities = this.membershipsClient.listEntities({
        queryOptions: { 
          filter: `id eq '${membershipId}'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...membershipData } = entity;
        memberships.push(membershipData as unknown as BrigadeMembership);
      }
      
      return memberships.length > 0 ? memberships[0] : null;
    } catch (error) {
      console.error('Failed to get membership by ID from Azure Table Storage:', error);
      return null;
    }
  }

  async deleteMembership(brigadeId: string, userId: string): Promise<void> {
    try {
      await this.membershipsClient.deleteEntity(brigadeId, userId);
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return;
      }
      console.error('Failed to delete membership from Azure Table Storage:', error);
      throw new Error('Failed to delete membership');
    }
  }

  async getMembershipsByUser(userId: string): Promise<BrigadeMembership[]> {
    try {
      const memberships: BrigadeMembership[] = [];
      const entities = this.membershipsClient.listEntities({
        queryOptions: { 
          filter: `userId eq '${userId}'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...membershipData } = entity;
        memberships.push(membershipData as unknown as BrigadeMembership);
      }
      
      return memberships;
    } catch (error) {
      console.error('Failed to get memberships by user from Azure Table Storage:', error);
      return [];
    }
  }

  async getMembershipsByBrigade(brigadeId: string): Promise<BrigadeMembership[]> {
    try {
      const memberships: BrigadeMembership[] = [];
      const entities = this.membershipsClient.listEntities({
        queryOptions: { 
          filter: `PartitionKey eq '${brigadeId}'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...membershipData } = entity;
        memberships.push(membershipData as unknown as BrigadeMembership);
      }
      
      return memberships;
    } catch (error) {
      console.error('Failed to get memberships by brigade from Azure Table Storage:', error);
      return [];
    }
  }

  async getPendingMembershipsByBrigade(brigadeId: string): Promise<BrigadeMembership[]> {
    try {
      const memberships: BrigadeMembership[] = [];
      const entities = this.membershipsClient.listEntities({
        queryOptions: { 
          filter: `PartitionKey eq '${brigadeId}' and status eq 'pending'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...membershipData } = entity;
        memberships.push(membershipData as unknown as BrigadeMembership);
      }
      
      return memberships;
    } catch (error) {
      console.error('Failed to get pending memberships from Azure Table Storage:', error);
      return [];
    }
  }

  // Invitation operations
  async saveInvitation(invitation: MemberInvitation): Promise<void> {
    const entity = {
      partitionKey: invitation.brigadeId,
      rowKey: invitation.id,
      ...invitation,
    };
    
    try {
      await this.invitationsClient.upsertEntity(entity, 'Replace');
    } catch (error) {
      console.error('Failed to save invitation to Azure Table Storage:', error);
      throw new Error('Failed to save invitation');
    }
  }

  async getInvitation(invitationId: string): Promise<MemberInvitation | null> {
    try {
      const invitations: MemberInvitation[] = [];
      const entities = this.invitationsClient.listEntities({
        queryOptions: { 
          filter: `id eq '${invitationId}'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...invitationData } = entity;
        invitations.push(invitationData as unknown as MemberInvitation);
      }
      
      return invitations.length > 0 ? invitations[0] : null;
    } catch (error) {
      console.error('Failed to get invitation from Azure Table Storage:', error);
      return null;
    }
  }

  async getInvitationByToken(token: string): Promise<MemberInvitation | null> {
    try {
      const invitations: MemberInvitation[] = [];
      const entities = this.invitationsClient.listEntities({
        queryOptions: { 
          filter: `token eq '${token}'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...invitationData } = entity;
        invitations.push(invitationData as unknown as MemberInvitation);
      }
      
      return invitations.length > 0 ? invitations[0] : null;
    } catch (error) {
      console.error('Failed to get invitation by token from Azure Table Storage:', error);
      return null;
    }
  }

  async getPendingInvitationsByBrigade(brigadeId: string): Promise<MemberInvitation[]> {
    try {
      const invitations: MemberInvitation[] = [];
      const entities = this.invitationsClient.listEntities({
        queryOptions: { 
          filter: `PartitionKey eq '${brigadeId}' and status eq 'pending'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...invitationData } = entity;
        invitations.push(invitationData as unknown as MemberInvitation);
      }
      
      return invitations;
    } catch (error) {
      console.error('Failed to get pending invitations from Azure Table Storage:', error);
      return [];
    }
  }

  async expireInvitations(): Promise<void> {
    try {
      const now = new Date().toISOString();
      const entities = this.invitationsClient.listEntities({
        queryOptions: { 
          filter: `status eq 'pending' and expiresAt lt datetime'${now}'` 
        }
      });
      
      for await (const entity of entities) {
        const invitation = entity as unknown as MemberInvitation;
        invitation.status = 'expired';
        await this.saveInvitation(invitation);
      }
    } catch (error) {
      console.error('Failed to expire invitations in Azure Table Storage:', error);
    }
  }

  // Verification operations
  async saveVerificationRequest(request: AdminVerificationRequest): Promise<void> {
    const entity = {
      partitionKey: request.brigadeId,
      rowKey: request.id,
      ...request,
    };
    
    try {
      await this.verificationsClient.upsertEntity(entity, 'Replace');
    } catch (error) {
      console.error('Failed to save verification request to Azure Table Storage:', error);
      throw new Error('Failed to save verification request');
    }
  }

  async getVerificationRequest(requestId: string): Promise<AdminVerificationRequest | null> {
    try {
      const requests: AdminVerificationRequest[] = [];
      const entities = this.verificationsClient.listEntities({
        queryOptions: { 
          filter: `id eq '${requestId}'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...requestData } = entity;
        requests.push(requestData as unknown as AdminVerificationRequest);
      }
      
      return requests.length > 0 ? requests[0] : null;
    } catch (error) {
      console.error('Failed to get verification request from Azure Table Storage:', error);
      return null;
    }
  }

  async getVerificationsByUser(userId: string): Promise<AdminVerificationRequest[]> {
    try {
      const requests: AdminVerificationRequest[] = [];
      const entities = this.verificationsClient.listEntities({
        queryOptions: { 
          filter: `userId eq '${userId}'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...requestData } = entity;
        requests.push(requestData as unknown as AdminVerificationRequest);
      }
      
      return requests;
    } catch (error) {
      console.error('Failed to get verifications by user from Azure Table Storage:', error);
      return [];
    }
  }

  async getPendingVerifications(): Promise<AdminVerificationRequest[]> {
    try {
      const requests: AdminVerificationRequest[] = [];
      const entities = this.verificationsClient.listEntities({
        queryOptions: { 
          filter: `status eq 'pending'` 
        }
      });
      
      for await (const entity of entities) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { partitionKey, rowKey, timestamp, etag, ...requestData } = entity;
        requests.push(requestData as unknown as AdminVerificationRequest);
      }
      
      return requests;
    } catch (error) {
      console.error('Failed to get pending verifications from Azure Table Storage:', error);
      return [];
    }
  }

  async approveVerification(requestId: string, reviewedBy: string, reviewNotes?: string): Promise<void> {
    const request = await this.getVerificationRequest(requestId);
    if (!request) {
      throw new Error('Verification request not found');
    }
    
    request.status = 'approved';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date().toISOString();
    request.reviewNotes = reviewNotes;
    request.updatedAt = new Date().toISOString();
    
    await this.saveVerificationRequest(request);
    
    // Add brigade to user's verifiedBrigades
    const user = await this.getUser(request.userId);
    if (user) {
      if (!user.verifiedBrigades) {
        user.verifiedBrigades = [];
      }
      if (!user.verifiedBrigades.includes(request.brigadeId)) {
        user.verifiedBrigades.push(request.brigadeId);
        await this.saveUser(user);
      }
    }
  }

  async rejectVerification(requestId: string, reviewedBy: string, reviewNotes: string): Promise<void> {
    const request = await this.getVerificationRequest(requestId);
    if (!request) {
      throw new Error('Verification request not found');
    }
    
    request.status = 'rejected';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date().toISOString();
    request.reviewNotes = reviewNotes;
    request.updatedAt = new Date().toISOString();
    
    await this.saveVerificationRequest(request);
  }
}
