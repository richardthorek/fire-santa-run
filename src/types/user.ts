/**
 * User interface representing authenticated users in the Fire Santa Run application.
 * Users can be members of multiple brigades with different roles in each.
 */
export interface User {
  /** Unique user identifier (UUID) */
  id: string;
  
  /** Primary email address */
  email: string;
  
  /** Display name */
  name: string;
  
  /** Microsoft Entra External ID user ID (when authenticated via Entra) */
  entraUserId?: string;
  
  /** Email verification status */
  emailVerified: boolean;
  
  /** Brigade IDs where user has approved admin verification (for non-.gov.au emails) */
  verifiedBrigades?: string[];
  
  /** ISO 8601 timestamp of account creation */
  createdAt: string;
  
  /** Last login timestamp */
  lastLoginAt?: string;
  
  /** URL or base64 encoded profile picture */
  profilePicture?: string;
}
