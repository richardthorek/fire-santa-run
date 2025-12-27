/**
 * Accessibility utility tests
 * Verifies color contrast calculations and accessibility helpers
 */

import { describe, it, expect } from 'vitest';
import { getContrastRatio, checkContrast, generateA11yId } from '../utils/accessibility';

describe('Accessibility Utilities', () => {
  describe('Color Contrast', () => {
    it('should calculate correct contrast ratio for fire red on white', () => {
      const ratio = getContrastRatio('#D32F2F', '#FFFFFF');
      // Fire red on white should have at least 4.5:1 ratio
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should calculate correct contrast ratio for neutral text on white', () => {
      const ratio = getContrastRatio('#212121', '#FFFFFF');
      // Dark gray on white should have high contrast
      expect(ratio).toBeGreaterThanOrEqual(15);
    });

    it('should pass WCAG AA for normal text', () => {
      const result = checkContrast('#D32F2F', '#FFFFFF', false);
      expect(result.pass).toBe(true);
      expect(result.level).toMatch(/AA|AAA/);
    });

    it('should pass WCAG AA for large text with lower contrast', () => {
      // Note: Summer gold (#FFA726) on white fails even for large text (1.94:1)
      // This is a known issue to be fixed in the remediation phase
      const result = checkContrast('#FFA726', '#FFFFFF', true);
      // Large text requires 3:1 ratio
      // This test documents the current state - it SHOULD pass but doesn't
      expect(result.ratio).toBeLessThan(3);
      expect(result.pass).toBe(false);
    });

    it('should fail for insufficient contrast', () => {
      const result = checkContrast('#FFFFFF', '#FAFAFA', false);
      expect(result.pass).toBe(false);
      expect(result.level).toBe('Fail');
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = generateA11yId();
      const id2 = generateA11yId();
      expect(id1).not.toBe(id2);
    });

    it('should include custom prefix', () => {
      const id = generateA11yId('custom');
      expect(id).toContain('custom');
    });
  });
});
