/**
 * Font Loader Tests
 * 
 * These tests verify that the font loader utility works correctly
 * and is CSP-compliant (no inline event handlers).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadGoogleFonts } from '../fontLoader';

describe('fontLoader', () => {
  beforeEach(() => {
    // Reset DOM for each test
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('should switch media attribute from print to all', () => {
    // Create a link element as it would be in index.html
    const link = document.createElement('link');
    link.id = 'google-fonts-link';
    link.rel = 'stylesheet';
    link.media = 'print';
    link.href = 'https://fonts.googleapis.com/css2?family=Test';
    document.head.appendChild(link);

    // Call the font loader
    loadGoogleFonts();

    // Verify the media attribute was changed
    expect(link.media).toBe('all');
  });

  it('should handle missing font link gracefully', () => {
    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Call without the element present
    loadGoogleFonts();

    // Should warn about missing element
    expect(warnSpy).toHaveBeenCalledWith('Google Fonts link element not found');

    warnSpy.mockRestore();
  });

  it('should not change media if already set to all', () => {
    // Create a link element already loaded
    const link = document.createElement('link');
    link.id = 'google-fonts-link';
    link.rel = 'stylesheet';
    link.media = 'all';
    link.href = 'https://fonts.googleapis.com/css2?family=Test';
    document.head.appendChild(link);

    // Call the font loader
    loadGoogleFonts();

    // Should still be 'all' (no change)
    expect(link.media).toBe('all');
  });

  it('should use Font Loading API if available', async () => {
    // Mock the Font Loading API
    const mockFontsReady = Promise.resolve();
    Object.defineProperty(document, 'fonts', {
      value: { ready: mockFontsReady },
      writable: true,
      configurable: true,
    });

    // Create a link element
    const link = document.createElement('link');
    link.id = 'google-fonts-link';
    link.rel = 'stylesheet';
    link.media = 'print';
    link.href = 'https://fonts.googleapis.com/css2?family=Test';
    document.head.appendChild(link);

    // Call the font loader
    loadGoogleFonts();

    // Wait for the promise to resolve
    await mockFontsReady;

    // Media should be changed to 'all'
    expect(link.media).toBe('all');
  });

  it('should handle Font Loading API errors gracefully', async () => {
    // Mock the Font Loading API with an error
    const mockFontsReady = Promise.reject(new Error('Font loading failed'));
    Object.defineProperty(document, 'fonts', {
      value: { ready: mockFontsReady },
      writable: true,
      configurable: true,
    });

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a link element
    const link = document.createElement('link');
    link.id = 'google-fonts-link';
    link.rel = 'stylesheet';
    link.media = 'print';
    link.href = 'https://fonts.googleapis.com/css2?family=Test';
    document.head.appendChild(link);

    // Call the font loader
    loadGoogleFonts();

    // Wait for the promise to be handled with a small delay
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should warn about the error and still change media attribute
    expect(warnSpy).toHaveBeenCalled();
    expect(link.media).toBe('all');

    warnSpy.mockRestore();
  });
});
