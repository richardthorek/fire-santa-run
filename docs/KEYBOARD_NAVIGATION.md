# Keyboard Navigation Guide

## Global Shortcuts

Fire Santa Run is fully keyboard accessible. All features can be accessed without a mouse.

### Skip Navigation
- **Tab** (first press) → Reveals "Skip to main content" link
- **Enter** → Skip directly to main content, bypassing header

### General Navigation
- **Tab** → Move forward through interactive elements
- **Shift + Tab** → Move backward through interactive elements
- **Enter** or **Space** → Activate buttons and links
- **Escape** → Close open menus, modals, and dropdowns

### Header Navigation
- **Tab** to user menu button → Opens user profile dropdown
- **Escape** → Close user dropdown menu
- **Arrow Keys** → Navigate through menu items (when menu is open)
- **Enter** → Select menu item

## Page-Specific Shortcuts

### Dashboard

**Route Filters:**
- **Tab** to filter buttons
- **Arrow Left/Right** → Navigate between filters
- **Enter** or **Space** → Select filter

**Route List:**
- **Tab** to route cards
- **Enter** → Open route details
- **Tab** to "Create New Route" button

### Route Editor

**Waypoint Management:**
- **Tab** to waypoint list
- **Arrow Up/Down** → Navigate waypoints
- **Enter** → Edit waypoint
- **Delete** or **Backspace** → Delete waypoint (when focused)
- **Escape** → Cancel edit mode

**Map Controls:**
- **Tab** to map controls
- **+** / **-** → Zoom in/out
- **Arrow Keys** → Pan map (when map container focused)

**Address Search:**
- **Tab** to search input
- **Type** to search
- **Arrow Down** → Focus first result
- **Arrow Up/Down** → Navigate results
- **Enter** → Select result

**Save Actions:**
- **Ctrl+S** or **Cmd+S** → Save draft (future feature)

### Navigation View (Driver)

**Turn-by-Turn:**
- **Space** → Start/pause navigation
- **Arrow Left** → Previous instruction
- **Arrow Right** → Next instruction

**Map Controls:**
- **R** → Re-center on current location
- **+** / **-** → Zoom in/out

### Tracking View (Public)

**Map Controls:**
- **Tab** to zoom controls
- **+** / **-** → Zoom in/out
- **R** → Re-center on Santa's location

## Form Navigation

### General Form Behavior
- **Tab** → Move to next field
- **Shift + Tab** → Move to previous field
- **Enter** → Submit form (when on submit button)
- **Escape** → Cancel/close modal forms

### Input Fields
- **Type** to enter text
- **Arrow Up/Down** → Navigate select dropdowns
- **Space** → Open select dropdown or toggle checkbox
- **Arrow Keys** → Navigate date picker (when open)

### Error Handling
- When validation fails, focus automatically moves to first error
- Error messages are announced by screen readers
- **Tab** through error messages

## Modal & Dialog Navigation

### Modal Behavior
- When modal opens, focus moves to first focusable element
- **Tab** cycles through elements within modal (focus is trapped)
- **Escape** → Close modal and return focus to trigger element

### Share Modal
- **Tab** to QR code → Tab to copy button
- **Enter** → Copy link to clipboard
- **Escape** → Close modal

## Accessibility Features

### Focus Indicators
- All interactive elements show a visible orange outline when focused
- Focus outlines are 3px wide with 2px offset for visibility
- Color: `#F57C00` (Summer Gold Dark) - WCAG AA compliant

### Screen Reader Support
- All images have alt text
- All buttons have descriptive labels
- Form inputs have associated labels
- Dynamic content changes are announced
- ARIA landmarks for easy navigation:
  - `banner` → Header
  - `main` → Main content
  - `navigation` → Navigation menus
  - `region` → Significant sections

### Status Messages
- Route status changes are announced
- Save confirmations are announced
- Error messages are announced
- Navigation instructions are announced (in Navigation View)

## Browser Compatibility

### Tested Browsers
- ✅ Chrome/Edge (Windows, macOS, Linux)
- ✅ Firefox (Windows, macOS, Linux)
- ✅ Safari (macOS, iOS)
- ✅ Mobile browsers (iOS Safari, Android Chrome)

### Keyboard Navigation Support
- **Windows:** Full keyboard support in all browsers
- **macOS:** Enable "Full Keyboard Access" in System Preferences
  - Go to: System Preferences → Keyboard → Shortcuts
  - At bottom: Select "All controls" for full Tab navigation
- **Linux:** Full keyboard support (depends on desktop environment)

## Tips for Keyboard-Only Users

1. **Use Skip Links:** Press Tab once on any page to reveal "Skip to main content"
2. **Explore with Tab:** Tab through a page to discover all interactive elements
3. **Watch for Focus:** The orange focus outline shows where you are
4. **Use Escape:** Quick way to close menus and modals
5. **Arrow Keys in Lists:** Use arrow keys in dropdown menus and select lists

## Customization

### Browser Extensions
Users can customize keyboard navigation further with extensions:
- **Vimium** (Chrome/Firefox) - Vim-style keyboard shortcuts
- **Surfingkeys** (Chrome/Firefox) - Advanced keyboard control
- **Tab Wrangler** - Improved tab key behavior

### Screen Readers
Fire Santa Run is compatible with:
- **NVDA** (Windows) - Free, open-source
- **JAWS** (Windows) - Commercial
- **VoiceOver** (macOS/iOS) - Built-in
- **TalkBack** (Android) - Built-in
- **Orca** (Linux) - Built-in

## Reporting Issues

If you encounter any keyboard navigation issues:
1. Check this guide for the correct key combination
2. Try refreshing the page (Ctrl+R or Cmd+R)
3. Clear browser cache and reload
4. Report the issue through GitHub with:
   - Browser and version
   - Operating system
   - Steps to reproduce
   - Expected vs. actual behavior

## Future Enhancements

Planned keyboard shortcuts:
- [ ] **Ctrl+K** → Quick command palette
- [ ] **Ctrl+F** → Focus search
- [ ] **Ctrl+N** → Create new route
- [ ] **Ctrl+E** → Edit current route
- [ ] **Ctrl+/** → Show keyboard shortcuts help

---

**Last Updated:** December 27, 2024  
**Version:** 1.0.0  
**Compliance:** WCAG 2.1 AA
