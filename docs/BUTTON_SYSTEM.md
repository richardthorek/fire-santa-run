# Button Style System

## Overview

Fire Santa Run uses a comprehensive button style system with reusable CSS classes to ensure consistent styling across the application. This eliminates the need for inline styles and prevents styling inconsistencies like red text on red backgrounds.

## Button Classes

### Base Class
All buttons should use the base `.btn` class:

```html
<button className="btn">Button</button>
```

### Button Variants

#### Primary Button (`.btn-primary`)
Red background with white text - used for main call-to-action buttons.

```html
<button className="btn btn-primary">Primary Action</button>
```

**Use cases:**
- Main submission buttons
- Primary navigation actions
- Critical call-to-action elements

---

#### Secondary Button (`.btn-secondary`)
Transparent background with red border and red text - used for secondary actions.

```html
<button className="btn btn-secondary">Secondary Action</button>
```

**Use cases:**
- Alternative actions
- Cancel operations that still need emphasis
- Actions that are important but not primary

---

#### Tertiary Button (`.btn-tertiary`)
White background with red text - used for tertiary actions and form buttons.

```html
<button className="btn btn-tertiary">Tertiary Action</button>
```

**Use cases:**
- Form buttons on colored backgrounds
- Less prominent actions
- Dashboard navigation

---

#### Success Button (`.btn-success`)
Green background with white text - used for positive confirmations.

```html
<button className="btn btn-success">Confirm</button>
```

**Use cases:**
- Save operations
- Successful confirmations
- Positive actions

---

#### Warning Button (`.btn-warning`)
Gold background with dark text - used for caution actions.

```html
<button className="btn btn-warning">Warning</button>
```

**Use cases:**
- Actions that need attention
- Non-critical warnings
- Preview or draft actions

---

#### Danger Button (`.btn-danger`)
Dark red background with white text - used for destructive actions.

```html
<button className="btn btn-danger">Delete</button>
```

**Use cases:**
- Delete operations
- Irreversible actions
- Critical destructive operations

---

#### Ghost Button (`.btn-ghost`)
Transparent with minimal styling - used for subtle actions.

```html
<button className="btn btn-ghost">Ghost Action</button>
```

**Use cases:**
- Very low-priority actions
- Navigation within dense UIs
- Minimalist interfaces

---

### Button Sizes

#### Small Button (`.btn-sm`)
```html
<button className="btn btn-primary btn-sm">Small</button>
```

#### Default Size
Use base `.btn` class without size modifier.

#### Large Button (`.btn-lg`)
```html
<button className="btn btn-primary btn-lg">Large</button>
```

---

### Button Modifiers

#### Block Button (`.btn-block`)
Full-width button:

```html
<button className="btn btn-primary btn-block">Full Width</button>
```

#### Icon Button (`.btn-icon`)
Button with icon and text:

```html
<button className="btn btn-primary btn-icon">
  <span>🎅</span> Sign In
</button>
```

---

## Usage Examples

### Landing Page Authentication
```tsx
// Primary white button (tertiary style)
<button className="btn btn-tertiary">
  🎅 Sign In
</button>

// Secondary outlined button
<button className="btn btn-secondary">
  🚀 Sign Up Free
</button>
```

### Dashboard Actions
```tsx
// Primary action
<button className="btn btn-primary">Create Route</button>

// Success action
<button className="btn btn-success">Save Changes</button>

// Danger action
<button className="btn btn-danger">Delete Route</button>
```

### Form Buttons
```tsx
// Submit button
<button className="btn btn-primary btn-block">
  Submit
</button>

// Cancel button
<button className="btn btn-ghost">
  Cancel
</button>
```

---

## Custom Styling

If you need to override button styles for specific contexts (e.g., white border on colored backgrounds), you can add inline styles to the specific properties:

```tsx
<button 
  className="btn btn-secondary"
  style={{
    color: 'white',
    borderColor: 'white',
  }}
>
  Custom Style
</button>
```

**Note:** Only override specific properties, not the entire button style. The class should provide the foundation.

---

## Migration Guide

### Before (Inline Styles)
```tsx
<button
  style={{
    padding: '1rem 1.5rem',
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--fire-red)',
    backgroundColor: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.2s',
  }}
  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
>
  Click Me
</button>
```

### After (CSS Classes)
```tsx
<button className="btn btn-tertiary">
  Click Me
</button>
```

**Benefits:**
- 90% less code
- Consistent styling
- Easier maintenance
- Better hover/focus states
- Automatic accessibility features

---

## Design System Reference

All button colors reference the design system defined in:
- `src/index.css` (CSS variables)
- `src/utils/constants.ts` (JavaScript constants)
- `MASTER_PLAN.md` Section 2 (Design System)

### Color Palette
- **Primary Red:** `--fire-red` (#D32F2F)
- **Dark Red:** `--fire-red-dark` (#B71C1C)
- **Light Red:** `--fire-red-light` (#EF5350)
- **Christmas Green:** `--christmas-green` (#43A047)
- **Summer Gold:** `--summer-gold` (#FFA726)
- **White:** `--candy-white` (#FFFFFF)

---

## Best Practices

1. **Always use button classes** instead of inline styles for consistency
2. **Choose the right variant** based on action importance
3. **Use block buttons** for mobile-friendly full-width actions
4. **Include icons** for better visual communication (with `.btn-icon`)
5. **Test disabled states** to ensure proper opacity and cursor behavior
6. **Maintain hierarchy** - don't use primary buttons for every action
7. **Consider context** - tertiary buttons work well on colored backgrounds

---

## Troubleshooting

### Button text not readable
- Ensure you're using the correct button variant
- Primary, Success, Danger: white text
- Secondary, Tertiary, Ghost: colored text
- Never use red text on red background

### Button not responding to hover
- Check that `:hover` pseudo-class is working
- Ensure button is not disabled
- Verify no conflicting inline styles

### Button too small on mobile
- Consider using `.btn-block` for full-width
- Use `.btn-lg` for larger touch targets
- Ensure minimum 44px touch target (handled by base class)

---

## Related Documentation

- [MASTER_PLAN.md](../MASTER_PLAN.md) - Overall design system
- [constants.ts](../src/utils/constants.ts) - Color palette constants
- [index.css](../src/index.css) - Button style definitions
