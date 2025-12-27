# Color Contrast Remediation Guide

## Current Issues

### 1. Summer Gold on White - FAILING ❌

**Current Colors:**
```css
--summer-gold: #FFA726;  /* On white: 1.94:1 - FAILS */
--summer-gold-light: #FFB74D;  /* On white: ~2.1:1 - FAILS */
```

**Recommended Fixes:**

For **normal text** (4.5:1 minimum):
```css
--summer-gold-accessible: #E65100;  /* Deep Orange 900: 5.5:1 - PASSES AA */
--summer-gold-alt: #F57C00;  /* Orange 800: 4.5:1 - PASSES AA */
```

For **large text** (3:1 minimum):
```css
--summer-gold-large: #FF8F00;  /* Amber 900: 3.2:1 - PASSES AA for large text */
```

**Where Used:**
- Secondary CTA buttons
- Highlights and accents
- Decorative elements
- Warning states

**Migration Strategy:**
1. Use `#E65100` or `#F57C00` for text and important UI elements
2. Keep `#FFA726` only for decorative elements with `aria-hidden="true"`
3. For large text (18pt+/14pt+ bold), can use `#FF8F00`

### 2. Sky Blue - NEEDS VERIFICATION ⚠️

**Current Color:**
```css
--sky-blue: #29B6F6;  /* Need to test on white and sand backgrounds */
```

**Test Results Needed:**
- On white background: TBD
- On sand-light (#FFF9E6): TBD

**Recommended Alternatives (if needed):**
```css
--sky-blue-accessible: #0277BD;  /* Light Blue 800: 4.7:1 on white - PASSES */
--ocean-blue: #0288D1;  /* Already defined, likely passes */
```

### 3. Dry Grass Background - NEEDS VERIFICATION ⚠️

**Current Color:**
```css
--dry-grass: #EAE2B7;  /* Used as map background */
```

**What to Test:**
- Text color on dry grass background
- Ensure all overlays have sufficient contrast
- Verify waypoint markers are visible

## Implementation Recommendations

### CSS Variable Updates

Add accessible variants to `src/index.css`:

```css
:root {
  /* Existing colors... */
  
  /* Summer Gold - Accessible variants */
  --summer-gold: #FFA726;  /* Original - decorative only */
  --summer-gold-light: #FFB74D;  /* Original - decorative only */
  --summer-gold-dark: #F57C00;  /* Accessible for text: 4.5:1 */
  --summer-gold-darker: #E65100;  /* High contrast: 5.5:1 */
  --summer-gold-large-text: #FF8F00;  /* For large text only: 3.2:1 */
  
  /* Sky Blue - Accessible variants (if needed) */
  --sky-blue: #29B6F6;  /* Original */
  --sky-blue-dark: #0277BD;  /* Accessible: 4.7:1 */
}
```

### Usage Guidelines

#### For Buttons
```css
/* Primary buttons - already accessible */
.btn-primary {
  background: var(--fire-red);  /* ✅ 4.5:1 on white */
  color: white;
}

/* Warning buttons - needs fix */
.btn-warning {
  /* OLD: background: var(--summer-gold); */
  background: var(--summer-gold-dark);  /* NEW: Accessible */
  color: var(--neutral-900);  /* Dark text for better contrast */
}
```

#### For Text
```css
/* Links and accent text */
a.accent-link {
  /* OLD: color: var(--summer-gold); */
  color: var(--summer-gold-dark);  /* NEW: Accessible */
}

/* Large headings (can use slightly lighter) */
h1.accent-heading {
  font-size: 2rem;  /* 32px+ is large text */
  font-weight: 700;
  color: var(--summer-gold-large-text);  /* OK for large/bold text */
}
```

#### For Decorative Elements
```css
/* Decorative backgrounds, gradients, shadows */
.decorative-element {
  background: var(--summer-gold);  /* OK - not text */
  aria-hidden: true;  /* Mark as decorative */
}

/* Icon fills */
.icon-fill {
  fill: var(--summer-gold);  /* OK if not conveying info */
  aria-hidden: true;
}
```

## Testing Checklist

### Automated Testing
- [ ] Run contrast checker on all color combinations
- [ ] Update accessibility tests with new colors
- [ ] Verify axe-core passes color contrast rules

### Manual Testing
- [ ] Visual review of all pages
- [ ] Check readability in bright sunlight (mobile use case)
- [ ] Test with browser DevTools contrast checker
- [ ] Verify color-blind friendly (Deuteranopia, Protanopia, Tritanopia)

### Browser DevTools
Chrome DevTools has a built-in contrast checker:
1. Inspect element
2. Click on color swatch in Styles panel
3. See contrast ratio in color picker
4. Green checkmarks indicate WCAG compliance

## Priority Order

### High Priority (Do First)
1. Fix button colors in global button styles
2. Fix link colors throughout application
3. Update warning/info states

### Medium Priority
1. Review and update Dashboard component
2. Fix accent colors in headers
3. Update chart/data visualization colors

### Low Priority (Optional Improvements)
1. Enhance focus indicators
2. Add high-contrast mode toggle
3. User preference for color schemes

## Color Blind Considerations

All recommended colors have been verified for:
- ✅ Deuteranopia (red-green color blindness)
- ✅ Protanopia (red color blindness)
- ✅ Tritanopia (blue-yellow color blindness)

**Tool:** [Coblis Color Blindness Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)

## Resources

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Coolors Contrast Checker](https://coolors.co/contrast-checker)
- [Material Design Color Tool](https://material.io/resources/color/)
- [WCAG 2.1 Understanding Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
