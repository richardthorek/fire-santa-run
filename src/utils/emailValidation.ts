/**
 * Email validation utilities for admin verification and membership management.
 * Supports both automatic (.gov.au) and manual verification pathways.
 */

/**
 * Check if an email address is a .gov.au government email.
 * This is the automatic verification pathway for admin eligibility.
 * 
 * @param email - Email address to validate
 * @returns true if email ends with .gov.au (case-insensitive)
 * 
 * @example
 * isGovernmentEmail('john@rfs.nsw.gov.au') // true
 * isGovernmentEmail('jane@gmail.com') // false
 */
export function isGovernmentEmail(email: string): boolean {
  return /\.gov\.au$/i.test(email.toLowerCase());
}

/**
 * Check if an email matches any of the allowed domains for a brigade.
 * Used for auto-approval of membership requests.
 * 
 * @param email - Email address to check
 * @param allowedDomains - Array of allowed domains (e.g., ['@griffithrfs.org.au', '@rfs.nsw.gov.au'])
 * @returns true if email matches any allowed domain
 * 
 * @example
 * matchesAllowedDomains('user@griffithrfs.org.au', ['@griffithrfs.org.au']) // true
 * matchesAllowedDomains('user@gmail.com', ['@griffithrfs.org.au']) // false
 */
export function matchesAllowedDomains(email: string, allowedDomains: string[]): boolean {
  const emailLower = email.toLowerCase();
  return allowedDomains.some(domain => {
    const domainLower = domain.toLowerCase();
    // Support both '@domain.com' and 'domain.com' formats
    const normalizedDomain = domainLower.startsWith('@') ? domainLower : `@${domainLower}`;
    return emailLower.endsWith(normalizedDomain);
  });
}

/**
 * Check if a user's email is in the allowed emails list for a brigade.
 * Used for auto-approval of specific pre-approved members.
 * 
 * @param email - Email address to check
 * @param allowedEmails - Array of specifically allowed email addresses
 * @returns true if email is in the allowed list (case-insensitive)
 * 
 * @example
 * isAllowedEmail('dev@example.com', ['dev@example.com']) // true
 * isAllowedEmail('user@example.com', ['dev@example.com']) // false
 */
export function isAllowedEmail(email: string, allowedEmails: string[]): boolean {
  const emailLower = email.toLowerCase();
  return allowedEmails.some(allowed => allowed.toLowerCase() === emailLower);
}

/**
 * Check if a new member should be auto-approved based on brigade configuration.
 * Auto-approval occurs when:
 * 1. requireManualApproval is false, AND
 * 2. Email matches allowedDomains OR allowedEmails
 * 
 * @param email - Email address to check
 * @param brigadeConfig - Brigade configuration with approval settings
 * @returns true if member should be auto-approved
 * 
 * @example
 * isAutoApproved('user@griffithrfs.org.au', {
 *   requireManualApproval: false,
 *   allowedDomains: ['@griffithrfs.org.au'],
 *   allowedEmails: []
 * }) // true
 */
export function isAutoApproved(
  email: string,
  brigadeConfig: {
    requireManualApproval: boolean;
    allowedDomains: string[];
    allowedEmails: string[];
  }
): boolean {
  // If manual approval is required, never auto-approve
  if (brigadeConfig.requireManualApproval) {
    return false;
  }
  
  // Check if email matches allowed domains or is specifically allowed
  return (
    matchesAllowedDomains(email, brigadeConfig.allowedDomains) ||
    isAllowedEmail(email, brigadeConfig.allowedEmails)
  );
}

/**
 * Validate email format using RFC 5322 compliant regex.
 * 
 * @param email - Email address to validate
 * @returns true if email format is valid
 * 
 * @example
 * isValidEmailFormat('user@example.com') // true
 * isValidEmailFormat('invalid-email') // false
 */
export function isValidEmailFormat(email: string): boolean {
  // Simplified RFC 5322 regex for email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
