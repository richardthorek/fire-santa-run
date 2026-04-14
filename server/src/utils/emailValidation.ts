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
 * 
 * Performs strict domain matching:
 * - Exact match: email domain must exactly match allowed domain
 * - Subdomain match: email domain can be subdomain of allowed domain
 * 
 * Example with allowedDomain 'example.com':
 * - 'user@example.com' → Match ✅ (exact match)
 * - 'user@sub.example.com' → Match ✅ (subdomain)
 * - 'user@malicious-example.com' → No match ❌ (not a subdomain)
 * - 'user@example.com.malicious.com' → No match ❌ (not a subdomain)
 * 
 * Security: Subdomain matching is intentional to support organizational
 * structures like 'fire.nsw.gov.au', 'rfs.nsw.gov.au', etc.
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
    // Uses endsWith with '.' prefix to ensure it's a proper subdomain
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
 * 
 * Uses a simple regex pattern that covers most common email formats.
 * For production use with stricter requirements, consider using a
 * dedicated email validation library like 'validator' or 'email-validator'.
 * 
 * This pattern checks for:
 * - At least one character before @
 * - @ symbol
 * - At least one character after @
 * - . followed by at least one character for TLD
 * 
 * Note: Does not validate against RFC 5322 fully, but sufficient for
 * basic validation combined with Entra External ID's own validation.
 */
export function isValidEmailFormat(email: string): boolean {
  // Basic email regex - sufficient for basic validation
  // More comprehensive validation is handled by Entra External ID
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
