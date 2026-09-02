/**
 * Unit tests for the OG image builder utility.
 *
 * Tests are intentionally lightweight – they verify the pure helper functions
 * (SVG escaping, truncation, centre-of, Mapbox URL builder, and SVG generation)
 * without requiring a network connection or Azure services.
 */

import { describe, it, expect } from 'vitest';
import {
  svgEscape,
  truncate,
  centreOf,
  buildMapboxStaticUrl,
  buildOGImageSVG,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
} from '../../server/src/utils/ogImageBuilder';

// ---------------------------------------------------------------------------
// svgEscape
// ---------------------------------------------------------------------------

describe('svgEscape', () => {
  it('returns plain text unchanged', () => {
    expect(svgEscape('Hello World')).toBe('Hello World');
  });

  it('escapes ampersands', () => {
    expect(svgEscape('A & B')).toBe('A &amp; B');
  });

  it('escapes angle brackets', () => {
    expect(svgEscape('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(svgEscape('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('escapes single quotes', () => {
    expect(svgEscape("it's fine")).toBe('it&#39;s fine');
  });

  it('escapes multiple special characters in one string', () => {
    expect(svgEscape('<b>A & "B"</b>')).toBe('&lt;b&gt;A &amp; &quot;B&quot;&lt;/b&gt;');
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('returns a string that is exactly maxLen unchanged', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });

  it('truncates long strings and appends ellipsis', () => {
    expect(truncate('Hello World', 8)).toBe('Hello W…');
  });

  it('produces a result of exactly maxLen characters', () => {
    const result = truncate('ABCDEFGHIJ', 6);
    expect(result).toHaveLength(6);
    expect(result).toBe('ABCDE…');
  });
});

// ---------------------------------------------------------------------------
// centreOf
// ---------------------------------------------------------------------------

describe('centreOf', () => {
  it('returns the Sydney default for an empty array', () => {
    const [lng, lat] = centreOf([]);
    expect(lng).toBe(151.2093);
    expect(lat).toBe(-33.8688);
  });

  it('returns the single coordinate for a one-element array', () => {
    const coords: [number, number][] = [[151.0, -34.0]];
    expect(centreOf(coords)).toEqual([151.0, -34.0]);
  });

  it('averages two coordinates correctly', () => {
    const coords: [number, number][] = [
      [150.0, -34.0],
      [152.0, -36.0],
    ];
    const [lng, lat] = centreOf(coords);
    expect(lng).toBeCloseTo(151.0);
    expect(lat).toBeCloseTo(-35.0);
  });
});

// ---------------------------------------------------------------------------
// buildMapboxStaticUrl
// ---------------------------------------------------------------------------

describe('buildMapboxStaticUrl', () => {
  it('returns empty string when token is absent', () => {
    expect(buildMapboxStaticUrl([[151.2, -33.8]], '')).toBe('');
  });

  it('returns empty string when coordinates array is empty', () => {
    expect(buildMapboxStaticUrl([], 'pk.test-token')).toBe('');
  });

  it('builds a valid Mapbox Static Images URL', () => {
    const url = buildMapboxStaticUrl([[151.2093, -33.8688]], 'pk.test-token', 600, 400);
    expect(url).toContain('api.mapbox.com');
    expect(url).toContain('streets-v12');
    expect(url).toContain('600x400');
    expect(url).toContain('pk.test-token');
    expect(url).toContain('auto');
    expect(url).toContain('geojson');
  });
});

// ---------------------------------------------------------------------------
// buildOGImageSVG
// ---------------------------------------------------------------------------

describe('buildOGImageSVG', () => {
  const baseData = {
    routeName: 'Christmas Eve Santa Run',
    brigadeName: 'Sydney Central Fire Brigade',
    date: '2024-12-24',
    coordinates: [
      [151.2093, -33.8688],
      [151.2100, -33.8690],
    ] as [number, number][],
    mapboxToken: undefined,
  };

  it('returns a string that starts with the SVG opening tag', () => {
    const svg = buildOGImageSVG(baseData);
    expect(svg.trim()).toMatch(/^<svg /);
  });

  it('includes the correct OG image dimensions', () => {
    const svg = buildOGImageSVG(baseData);
    expect(svg).toContain(`width="${OG_IMAGE_WIDTH}"`);
    expect(svg).toContain(`height="${OG_IMAGE_HEIGHT}"`);
  });

  it('includes the route name', () => {
    const svg = buildOGImageSVG(baseData);
    expect(svg).toContain('Christmas Eve Santa Run');
  });

  it('includes the brigade name', () => {
    const svg = buildOGImageSVG(baseData);
    expect(svg).toContain('Sydney Central Fire Brigade');
  });

  it('includes the date', () => {
    const svg = buildOGImageSVG(baseData);
    expect(svg).toContain('2024-12-24');
  });

  it('escapes HTML entities in route name', () => {
    const svg = buildOGImageSVG({ ...baseData, routeName: 'Test & <Route>' });
    expect(svg).toContain('Test &amp; &lt;Route&gt;');
    expect(svg).not.toContain('<Route>');
  });

  it('truncates very long route names', () => {
    const longName = 'A'.repeat(100);
    const svg = buildOGImageSVG({ ...baseData, routeName: longName });
    // Should not contain the full 100-char string
    expect(svg).not.toContain('A'.repeat(100));
    // Should contain the truncated + ellipsis version
    expect(svg).toContain('…');
  });

  it('includes a map placeholder when no Mapbox token is provided', () => {
    const svg = buildOGImageSVG({ ...baseData, mapboxToken: undefined });
    // Map placeholder (emoji or background rect)
    expect(svg).toContain('🗺️');
  });

  it('embeds a Mapbox Static Images URL when a token is provided', () => {
    const svg = buildOGImageSVG({ ...baseData, mapboxToken: 'pk.test-token' });
    expect(svg).toContain('api.mapbox.com');
    expect(svg).toContain('pk.test-token');
  });

  it('produces valid SVG structure (opening and closing tags)', () => {
    const svg = buildOGImageSVG(baseData);
    expect(svg).toMatch(/<svg[\s\S]*<\/svg>$/);
  });
});
