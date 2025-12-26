/**
 * Unit tests for email validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isGovernmentEmail,
  matchesAllowedDomains,
  isAllowedEmail,
  isAutoApproved,
  isValidEmailFormat,
} from '../emailValidation';

describe('emailValidation', () => {
  describe('isGovernmentEmail', () => {
    it('should return true for .gov.au emails', () => {
      expect(isGovernmentEmail('admin@rfs.nsw.gov.au')).toBe(true);
      expect(isGovernmentEmail('user@fire.qld.gov.au')).toBe(true);
      expect(isGovernmentEmail('test@vic.gov.au')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isGovernmentEmail('admin@RFS.NSW.GOV.AU')).toBe(true);
      expect(isGovernmentEmail('Admin@Rfs.Nsw.Gov.Au')).toBe(true);
    });

    it('should return false for non-government emails', () => {
      expect(isGovernmentEmail('user@gmail.com')).toBe(false);
      expect(isGovernmentEmail('admin@example.com')).toBe(false);
      expect(isGovernmentEmail('test@gov.uk')).toBe(false);
      expect(isGovernmentEmail('user@gov.aus')).toBe(false);
    });

    it('should handle emails with subdomains', () => {
      expect(isGovernmentEmail('user@subdomain.rfs.nsw.gov.au')).toBe(true);
      expect(isGovernmentEmail('admin@many.sub.domains.gov.au')).toBe(true);
    });
  });

  describe('matchesAllowedDomains', () => {
    it('should match emails against allowed domains', () => {
      const domains = ['@griffithrfs.org.au', '@rfs.nsw.gov.au'];
      
      expect(matchesAllowedDomains('user@griffithrfs.org.au', domains)).toBe(true);
      expect(matchesAllowedDomains('admin@rfs.nsw.gov.au', domains)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const domains = ['@griffithrfs.org.au'];
      
      expect(matchesAllowedDomains('USER@GRIFFITHRFS.ORG.AU', domains)).toBe(true);
      expect(matchesAllowedDomains('user@GriffithRFS.Org.Au', domains)).toBe(true);
    });

    it('should handle domains with and without @ prefix', () => {
      const domainsWithAt = ['@example.com'];
      const domainsWithoutAt = ['example.com'];
      
      expect(matchesAllowedDomains('user@example.com', domainsWithAt)).toBe(true);
      expect(matchesAllowedDomains('user@example.com', domainsWithoutAt)).toBe(true);
    });

    it('should return false for non-matching emails', () => {
      const domains = ['@griffithrfs.org.au'];
      
      expect(matchesAllowedDomains('user@gmail.com', domains)).toBe(false);
      expect(matchesAllowedDomains('user@example.com', domains)).toBe(false);
    });

    it('should handle empty domain list', () => {
      expect(matchesAllowedDomains('user@example.com', [])).toBe(false);
    });

    it('should match multiple domains', () => {
      const domains = ['@domain1.com', '@domain2.org', '@domain3.net'];
      
      expect(matchesAllowedDomains('user@domain1.com', domains)).toBe(true);
      expect(matchesAllowedDomains('user@domain2.org', domains)).toBe(true);
      expect(matchesAllowedDomains('user@domain3.net', domains)).toBe(true);
      expect(matchesAllowedDomains('user@domain4.com', domains)).toBe(false);
    });
  });

  describe('isAllowedEmail', () => {
    it('should match exact email addresses', () => {
      const allowedEmails = ['dev@example.com', 'admin@example.com'];
      
      expect(isAllowedEmail('dev@example.com', allowedEmails)).toBe(true);
      expect(isAllowedEmail('admin@example.com', allowedEmails)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const allowedEmails = ['dev@example.com'];
      
      expect(isAllowedEmail('DEV@EXAMPLE.COM', allowedEmails)).toBe(true);
      expect(isAllowedEmail('Dev@Example.Com', allowedEmails)).toBe(true);
    });

    it('should return false for non-matching emails', () => {
      const allowedEmails = ['dev@example.com'];
      
      expect(isAllowedEmail('user@example.com', allowedEmails)).toBe(false);
      expect(isAllowedEmail('dev@other.com', allowedEmails)).toBe(false);
    });

    it('should handle empty allowed list', () => {
      expect(isAllowedEmail('user@example.com', [])).toBe(false);
    });
  });

  describe('isAutoApproved', () => {
    it('should auto-approve when requireManualApproval is false and domain matches', () => {
      const config = {
        requireManualApproval: false,
        allowedDomains: ['@griffithrfs.org.au'],
        allowedEmails: [],
      };
      
      expect(isAutoApproved('user@griffithrfs.org.au', config)).toBe(true);
    });

    it('should auto-approve when requireManualApproval is false and email is allowed', () => {
      const config = {
        requireManualApproval: false,
        allowedDomains: [],
        allowedEmails: ['dev@example.com'],
      };
      
      expect(isAutoApproved('dev@example.com', config)).toBe(true);
    });

    it('should not auto-approve when requireManualApproval is true', () => {
      const config = {
        requireManualApproval: true,
        allowedDomains: ['@griffithrfs.org.au'],
        allowedEmails: ['dev@example.com'],
      };
      
      expect(isAutoApproved('user@griffithrfs.org.au', config)).toBe(false);
      expect(isAutoApproved('dev@example.com', config)).toBe(false);
    });

    it('should not auto-approve when email does not match any criteria', () => {
      const config = {
        requireManualApproval: false,
        allowedDomains: ['@griffithrfs.org.au'],
        allowedEmails: ['dev@example.com'],
      };
      
      expect(isAutoApproved('random@gmail.com', config)).toBe(false);
    });

    it('should handle both allowedDomains and allowedEmails', () => {
      const config = {
        requireManualApproval: false,
        allowedDomains: ['@example.org'],
        allowedEmails: ['special@other.com'],
      };
      
      expect(isAutoApproved('user@example.org', config)).toBe(true);
      expect(isAutoApproved('special@other.com', config)).toBe(true);
      expect(isAutoApproved('random@gmail.com', config)).toBe(false);
    });
  });

  describe('isValidEmailFormat', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmailFormat('user@example.com')).toBe(true);
      expect(isValidEmailFormat('admin@rfs.nsw.gov.au')).toBe(true);
      expect(isValidEmailFormat('test.user@example.co.uk')).toBe(true);
      expect(isValidEmailFormat('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmailFormat('invalid-email')).toBe(false);
      expect(isValidEmailFormat('@example.com')).toBe(false);
      expect(isValidEmailFormat('user@')).toBe(false);
      expect(isValidEmailFormat('user @example.com')).toBe(false);
      expect(isValidEmailFormat('user@example')).toBe(false);
      expect(isValidEmailFormat('')).toBe(false);
    });
  });
});
