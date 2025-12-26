/**
 * Admin verification system for users without .gov.au email addresses.
 * Users can submit evidence of their brigade membership to be reviewed by site owners.
 */

/** Verification request status */
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/** Site owner permissions */
export type SiteOwnerPermission = 
  | 'review_verifications'    // Review admin verification requests
  | 'manage_brigades'         // View/edit all brigades (oversight)
  | 'view_audit_logs'         // Access system audit logs
  | 'manage_site_owners'      // Add/remove other site owners
  | 'system_settings';        // Modify system-wide settings

/**
 * Evidence file uploaded as proof of brigade membership.
 * Files are stored in Azure Blob Storage.
 */
export interface EvidenceFile {
  /** Unique file identifier (UUID) */
  id: string;
  
  /** Original filename */
  filename: string;
  
  /** MIME type: 'image/jpeg', 'image/png', 'image/heic', 'application/pdf' */
  contentType: string;
  
  /** File size in bytes */
  size: number;
  
  /** Azure Blob Storage URL (secured with SAS token) */
  url: string;
  
  /** Upload timestamp */
  uploadedAt: string;
}

/**
 * Admin verification request for users without .gov.au email addresses.
 * Users submit evidence of their brigade membership for site owner review.
 */
export interface AdminVerificationRequest {
  /** Unique verification request identifier (UUID) */
  id: string;
  
  /** User requesting admin verification */
  userId: string;
  
  /** Brigade they want to become admin of */
  brigadeId: string;
  
  /** User's email (non-.gov.au) */
  email: string;
  
  /** Uploaded proof documents (ID, certificates, letters) */
  evidenceFiles: EvidenceFile[];
  
  /** User's explanation (50-500 characters) */
  explanation: string;
  
  /** Verification request status */
  status: VerificationStatus;
  
  /** Site owner user ID who reviewed */
  reviewedBy?: string;
  
  /** Review timestamp */
  reviewedAt?: string;
  
  /** Site owner's review notes/reason (private) */
  reviewNotes?: string;
  
  /** When user submitted request */
  submittedAt: string;
  
  /** Auto-expire after 30 days */
  expiresAt: string;
  
  /** Request creation timestamp */
  createdAt: string;
  
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Site owner with elevated permissions for system administration.
 * Site owners can review verification requests and manage brigades.
 */
export interface SiteOwner {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Reference to User record */
  userId: string;
  
  /** Can access all system functions */
  isSuperAdmin: boolean;
  
  /** Granular permissions */
  permissions: SiteOwnerPermission[];
  
  /** Site owner creation timestamp */
  createdAt: string;
  
  /** Who granted site owner access */
  createdBy: string;
}
