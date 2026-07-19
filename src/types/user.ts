/**
 * Local profile fields for a Fire Santa Run user, keyed by the same id as
 * their Station Manager account. Identity, org membership, and role are
 * governed by Station Manager (the StationKit suite identity provider, see
 * context/AuthContext.tsx) — this holds only Santa Run's own app-specific
 * profile data.
 */
export interface User {
  /** Station Manager user id. */
  id: string;

  /** Primary email address */
  email: string;

  /** Display name */
  name: string;

  /** Email verification status */
  emailVerified: boolean;

  /** ISO 8601 timestamp of account creation */
  createdAt: string;

  /** Last login timestamp */
  lastLoginAt?: string;

  /** URL or base64 encoded profile picture */
  profilePicture?: string;
}
