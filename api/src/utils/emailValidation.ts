/**
 * Email validation utilities for brigade domain whitelist checking
 * 
 * This module provides functions to:
 * - Validate email addresses against brigade domain whitelists
 * - Check if emails match allowed domains or specific email addresses
 * - Determine if member should be auto-approved based on domain
 */

/**
 * Extract domain from email address
 */
export function extractDomain(email: string): string {
  const parts = email.toLowerCase().trim().split('@');
  return parts.length === 2 ? parts[1] : '';
}

/**
 * Check if email is from a .gov.au domain
 */
export function isGovAuEmail(email: string): boolean {
  const domain = extractDomain(email);
  return domain.endsWith('.gov.au') || domain === 'gov.au';
}

/**
 * Check if email matches brigade's allowed domains
 */
export function isAllowedDomain(email: string, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return false;
  }

  const domain = extractDomain(email);
  if (!domain) {
    return false;
  }

  // Check exact domain match or subdomain match
  return allowedDomains.some(allowedDomain => {
    const normalizedAllowed = allowedDomain.toLowerCase().trim();
    
    // Exact match
    if (domain === normalizedAllowed) {
      return true;
    }
    
    // Subdomain match (e.g., email: test@sub.example.com, allowed: example.com)
    if (domain.endsWith('.' + normalizedAllowed)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Check if email is in the brigade's allowed emails list
 */
export function isAllowedEmail(email: string, allowedEmails: string[]): boolean {
  if (!allowedEmails || allowedEmails.length === 0) {
    return false;
  }

  const normalizedEmail = email.toLowerCase().trim();
  return allowedEmails.some(
    allowedEmail => allowedEmail.toLowerCase().trim() === normalizedEmail
  );
}

/**
 * Check if member should be auto-approved based on domain whitelist
 * 
 * @param email - Member's email address
 * @param brigade - Brigade object with allowedDomains and allowedEmails
 * @returns true if member should be auto-approved, false if manual approval required
 */
export function shouldAutoApprove(
  email: string,
  brigade: { allowedDomains?: string[]; allowedEmails?: string[] }
): boolean {
  // Check if email is in allowed emails list (highest priority)
  if (brigade.allowedEmails && isAllowedEmail(email, brigade.allowedEmails)) {
    return true;
  }

  // Check if domain is in allowed domains list
  if (brigade.allowedDomains && isAllowedDomain(email, brigade.allowedDomains)) {
    return true;
  }

  // No match - manual approval required
  return false;
}

/**
 * Validate email format (basic check)
 */
export function isValidEmailFormat(email: string): boolean {
  // Basic email regex - not comprehensive but sufficient for our needs
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get email validation error message
 */
export function getEmailValidationError(
  email: string,
  requireGovAu: boolean = false
): string | null {
  if (!email) {
    return 'Email address is required';
  }

  if (!isValidEmailFormat(email)) {
    return 'Invalid email format';
  }

  if (requireGovAu && !isGovAuEmail(email)) {
    return 'Email must be from a .gov.au domain';
  }

  return null;
}
