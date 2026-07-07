import type { Route, RouteTemplate, Waypoint } from '../types';
import type { IStorageAdapter, Brigade } from './types';
import type { User } from '../types/user';
import type { BrigadeMembership } from '../types/membership';
import type { MemberInvitation } from '../types/invitation';
import type { AdminVerificationRequest } from '../types/verification';

/**
 * Lazily-loading facade over AzureTableStorageAdapter.
 *
 * The Azure Data Tables SDK is ~325 KB and is only ever exercised from Node
 * scripts and tests — the browser always talks to the API via the HTTP
 * adapter. Importing './azure' statically from the storage factory dragged
 * the whole SDK into the client bundle for every visitor. This facade defers
 * that import to the first storage call, so bundlers can keep the SDK in an
 * async chunk that browsers never fetch.
 *
 * Every IStorageAdapter method is async, so awaiting the dynamic import
 * inside each call is transparent to callers.
 */
export class LazyAzureStorageAdapter implements IStorageAdapter {
  private adapterPromise: Promise<IStorageAdapter> | null = null;
  private readonly connectionString: string;
  private readonly tablePrefix?: string;

  constructor(connectionString: string, tablePrefix?: string) {
    this.connectionString = connectionString;
    this.tablePrefix = tablePrefix;
  }

  private load(): Promise<IStorageAdapter> {
    this.adapterPromise ??= import('./azure').then(
      (m) => new m.AzureTableStorageAdapter(this.connectionString, this.tablePrefix),
    );
    return this.adapterPromise;
  }

  // Routes
  saveRoute = (brigadeId: string, route: Route) => this.load().then(a => a.saveRoute(brigadeId, route));
  getRoutes = (brigadeId: string) => this.load().then(a => a.getRoutes(brigadeId));
  getRoute = (brigadeId: string, routeId: string) => this.load().then(a => a.getRoute(brigadeId, routeId));
  getPublicRoute = (routeId: string) => this.load().then(a => a.getPublicRoute(routeId));
  deleteRoute = (brigadeId: string, routeId: string) => this.load().then(a => a.deleteRoute(brigadeId, routeId));

  // Waypoints (two-table route/waypoint split)
  saveWaypoint = (brigadeId: string, routeId: string, waypoint: Waypoint) => this.load().then(a => a.saveWaypoint(brigadeId, routeId, waypoint));
  saveWaypoints = (brigadeId: string, routeId: string, waypoints: Waypoint[]) => this.load().then(a => a.saveWaypoints(brigadeId, routeId, waypoints));
  getWaypoints = (brigadeId: string, routeId: string) => this.load().then(a => a.getWaypoints(brigadeId, routeId));
  deleteWaypoints = (brigadeId: string, routeId: string) => this.load().then(a => a.deleteWaypoints(brigadeId, routeId));

  // Templates
  saveTemplate = (brigadeId: string, template: RouteTemplate) => this.load().then(a => a.saveTemplate(brigadeId, template));
  getTemplates = (brigadeId: string) => this.load().then(a => a.getTemplates(brigadeId));
  getTemplate = (brigadeId: string, templateId: string) => this.load().then(a => a.getTemplate(brigadeId, templateId));
  deleteTemplate = (brigadeId: string, templateId: string) => this.load().then(a => a.deleteTemplate(brigadeId, templateId));

  // Brigades
  getBrigades = () => this.load().then(a => a.getBrigades());
  getBrigade = (brigadeId: string) => this.load().then(a => a.getBrigade(brigadeId));
  getBrigadeByRFSId = (rfsStationId: string) => this.load().then(a => a.getBrigadeByRFSId(rfsStationId));
  getBrigadeBySlug = (slug: string) => this.load().then(a => a.getBrigadeBySlug(slug));
  saveBrigade = (brigade: Brigade) => this.load().then(a => a.saveBrigade(brigade));

  // Users
  saveUser = (user: User) => this.load().then(a => a.saveUser(user));
  getUser = (userId: string) => this.load().then(a => a.getUser(userId));
  getUserByEmail = (email: string) => this.load().then(a => a.getUserByEmail(email));

  // Memberships
  saveMembership = (membership: BrigadeMembership) => this.load().then(a => a.saveMembership(membership));
  getMembership = (brigadeId: string, userId: string) => this.load().then(a => a.getMembership(brigadeId, userId));
  getMembershipById = (membershipId: string) => this.load().then(a => a.getMembershipById(membershipId));
  deleteMembership = (brigadeId: string, userId: string) => this.load().then(a => a.deleteMembership(brigadeId, userId));
  getMembershipsByUser = (userId: string) => this.load().then(a => a.getMembershipsByUser(userId));
  getMembershipsByBrigade = (brigadeId: string) => this.load().then(a => a.getMembershipsByBrigade(brigadeId));
  getPendingMembershipsByBrigade = (brigadeId: string) => this.load().then(a => a.getPendingMembershipsByBrigade(brigadeId));

  // Invitations
  saveInvitation = (invitation: MemberInvitation) => this.load().then(a => a.saveInvitation(invitation));
  getInvitation = (invitationId: string) => this.load().then(a => a.getInvitation(invitationId));
  getInvitationByToken = (token: string) => this.load().then(a => a.getInvitationByToken(token));
  getPendingInvitationsByBrigade = (brigadeId: string) => this.load().then(a => a.getPendingInvitationsByBrigade(brigadeId));
  expireInvitations = () => this.load().then(a => a.expireInvitations());

  // Verification
  saveVerificationRequest = (request: AdminVerificationRequest) => this.load().then(a => a.saveVerificationRequest(request));
  getVerificationRequest = (requestId: string) => this.load().then(a => a.getVerificationRequest(requestId));
  getVerificationsByUser = (userId: string) => this.load().then(a => a.getVerificationsByUser(userId));
  getPendingVerifications = () => this.load().then(a => a.getPendingVerifications());
  approveVerification = (requestId: string, reviewedBy: string, reviewNotes?: string) =>
    this.load().then(a => a.approveVerification(requestId, reviewedBy, reviewNotes));
  rejectVerification = (requestId: string, reviewedBy: string, reviewNotes: string) =>
    this.load().then(a => a.rejectVerification(requestId, reviewedBy, reviewNotes));
}
