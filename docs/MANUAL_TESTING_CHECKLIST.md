# Manual Accessibility Testing Checklist

## Overview
This checklist guides manual accessibility testing to complement automated axe-core tests. Use this for final validation before declaring WCAG 2.1 AA compliance.

---

## ✅ Pre-Testing Setup

### Tools Required
- [ ] Modern browser (Chrome/Firefox/Safari/Edge)
- [ ] Screen reader (NVDA/JAWS/VoiceOver/Orca)
- [ ] Keyboard (no mouse)
- [ ] Color contrast analyzer (built into browser DevTools)

### Test Environment
- [ ] Use production build (`npm run build && npm run preview`)
- [ ] Test in dev mode with `VITE_DEV_MODE=true`
- [ ] Test across multiple browsers
- [ ] Test on mobile devices (iOS Safari, Android Chrome)

---

## 🎹 Keyboard Navigation Testing

### Global Navigation
- [ ] Press Tab - Skip link appears at top
- [ ] Press Enter on skip link - Focus jumps to main content
- [ ] Tab through entire page - All interactive elements reachable
- [ ] Shift+Tab - Can navigate backwards
- [ ] Focus indicators visible on all elements
- [ ] No keyboard traps (can Tab out of all sections)

### Header (AppHeader)
- [ ] Tab to user menu button - Button receives focus
- [ ] Press Enter - Menu opens
- [ ] Escape key - Menu closes
- [ ] Tab through menu items while open
- [ ] Enter on menu item - Navigates correctly

### Dashboard
- [ ] Tab to status filter buttons
- [ ] Arrow keys or Tab - Can select all filters
- [ ] Enter or Space - Activates filter
- [ ] Tab to "Create New Route" button
- [ ] Tab to route cards (if any exist)
- [ ] Enter on route card - Opens route

### Forms (Login, Profile, etc.)
- [ ] Tab through all form fields in logical order
- [ ] Labels are associated with inputs
- [ ] Required fields indicated
- [ ] Error messages appear near fields
- [ ] Can submit form with Enter key
- [ ] Can cancel with Escape key

### Modals (Share Modal)
- [ ] Modal opens - Focus moves to modal
- [ ] Tab - Focus stays within modal (focus trap)
- [ ] Shift+Tab - Can cycle backwards in modal
- [ ] Escape - Closes modal
- [ ] After close - Focus returns to trigger button

---

## 🔊 Screen Reader Testing

### General Testing (NVDA/JAWS/VoiceOver)

#### Page Structure
- [ ] Page title announced correctly
- [ ] Heading structure makes sense (h1 → h2 → h3)
- [ ] Landmarks announced (banner, navigation, main, region)
- [ ] Skip link announced and functional

#### Interactive Elements
- [ ] All buttons have descriptive names
- [ ] All links have descriptive text
- [ ] All images have alt text or aria-label
- [ ] Form labels read correctly
- [ ] Error messages announced

#### Dynamic Content
- [ ] Status changes announced (route published, etc.)
- [ ] Loading states announced
- [ ] Error messages announced automatically
- [ ] Success messages announced

### Component-Specific Tests

#### AppHeader
- [ ] "Fire Santa Run" logo read as link
- [ ] User menu button announces name and role
- [ ] aria-expanded state announced when menu opens
- [ ] Menu items announced with roles

#### Dashboard
- [ ] Page heading "Santa Run Routes" announced
- [ ] Status filters announced as tabs
- [ ] Selected filter state announced
- [ ] Route count in each filter announced
- [ ] Empty state message read completely

#### Forms
- [ ] Field labels read before input
- [ ] Required fields announced
- [ ] Error messages associated with fields
- [ ] Success messages announced

---

## 🎨 Color Contrast Testing

### Automated Checks
- [ ] Run browser DevTools contrast checker
- [ ] Check all text against backgrounds
- [ ] Check all UI components (buttons, borders)

### Manual Verification

#### Text Contrast (4.5:1 minimum)
- [ ] Body text on white background
- [ ] Fire red (#D32F2F) on white - ✅ Should pass
- [ ] Summer gold dark (#F57C00) on white - ✅ Should pass
- [ ] Neutral 900 (#212121) on white - ✅ Should pass
- [ ] Link colors on backgrounds
- [ ] Error message colors

#### UI Component Contrast (3:1 minimum)
- [ ] Button borders
- [ ] Form field borders
- [ ] Focus indicators
- [ ] Icon colors
- [ ] Status badges

#### Large Text (3:1 minimum for 18pt+/14pt+ bold)
- [ ] Headings
- [ ] Large buttons
- [ ] Hero text

### Known Issues to Verify Fixed
- [ ] Summer gold (#FFA726) NOT used for text - Should use #F57C00 instead
- [ ] Warning buttons use accessible colors
- [ ] Focus indicators use accessible orange

---

## 📱 Zoom & Responsive Testing

### 200% Zoom Test
- [ ] Set browser zoom to 200% (Ctrl/Cmd + +)
- [ ] No horizontal scrolling appears
- [ ] All content still readable
- [ ] Interactive elements still usable
- [ ] Touch targets still 44x44px minimum
- [ ] No content overlap or truncation

### 400% Zoom Test (WCAG AAA, optional)
- [ ] Content reflows properly
- [ ] No loss of functionality
- [ ] Still navigable

### Mobile Responsive
- [ ] Test on phone viewport (375px width)
- [ ] Test on tablet viewport (768px width)
- [ ] Touch targets 44x44px minimum
- [ ] Text readable without zoom
- [ ] No horizontal overflow

---

## 🧪 Specific Component Tests

### AppHeader
- [x] All ARIA attributes present (Verified in tests)
- [x] Keyboard navigation works (Verified in tests)
- [ ] Screen reader announces correctly
- [ ] Menu closes on Escape
- [ ] Focus management correct

### Dashboard
- [x] Filter tabs have proper ARIA roles (Verified)
- [x] aria-selected on active tab (Verified)
- [ ] Screen reader announces filter changes
- [ ] Keyboard can activate all filters
- [ ] Create button accessible

### RouteEditor
- [ ] Map has aria-label
- [ ] Waypoint list navigable by keyboard
- [ ] Add waypoint button accessible
- [ ] Drag and drop has keyboard alternative
- [ ] Save buttons clearly labeled

### NavigationView
- [ ] Turn-by-turn instructions announced
- [ ] Map controls keyboard accessible
- [ ] Play/pause button accessible
- [ ] Current location updates announced (aria-live)

### TrackingView
- [ ] Map has descriptive label
- [ ] Santa location updates announced
- [ ] Route progress accessible
- [ ] Zoom controls keyboard accessible

### Forms
- [ ] Login form fully accessible
- [ ] Profile form fully accessible
- [ ] Member management form accessible
- [ ] All validation accessible

### ShareModal
- [ ] role="dialog" present
- [ ] Close button accessible
- [ ] Focus trapped in modal
- [ ] QR code has alt text
- [ ] Copy button accessible

---

## 🌐 Browser Compatibility

### Desktop Browsers
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Mobile Firefox

### Screen Reader Compatibility
- [ ] NVDA + Chrome (Windows)
- [ ] JAWS + Chrome (Windows)
- [ ] VoiceOver + Safari (macOS)
- [ ] VoiceOver + Safari (iOS)
- [ ] TalkBack + Chrome (Android)
- [ ] Orca + Firefox (Linux)

---

## 📊 Lighthouse Audit

### Run Lighthouse
```bash
# In Chrome DevTools
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Accessibility" category
4. Run audit on each page
```

### Target Scores
- [ ] Accessibility: 100/100
- [ ] Best Practices: 90+/100
- [ ] SEO: 90+/100

### Pages to Test
- [ ] Landing page (/)
- [ ] Login (/login)
- [ ] Dashboard (/dashboard)
- [ ] Route Editor (/routes/new)
- [ ] Navigation View (/routes/:id/navigate)
- [ ] Tracking View (/track/:routeId)
- [ ] Profile (/profile)
- [ ] Member Management (/dashboard/:brigadeId/members)

---

## ✅ Success Criteria

### Critical (Must Pass)
- [ ] Zero critical axe-core violations
- [ ] All interactive elements keyboard accessible
- [ ] All text meets 4.5:1 contrast ratio
- [ ] All UI components meet 3:1 contrast ratio
- [ ] Screen reader can access all content
- [ ] No keyboard traps
- [ ] Focus indicators always visible

### Important (Should Pass)
- [ ] Lighthouse accessibility score 100
- [ ] All ARIA attributes correctly used
- [ ] Semantic HTML throughout
- [ ] Proper heading hierarchy
- [ ] Forms fully accessible
- [ ] 200% zoom works without issues

### Nice to Have (Bonus)
- [ ] 400% zoom functional
- [ ] High contrast mode support
- [ ] Reduced motion preferences respected
- [ ] Multiple screen reader tested
- [ ] Mobile accessibility validated

---

## 🐛 Issue Reporting Template

If you find an accessibility issue:

```markdown
## Issue Description
Brief description of the problem

## Steps to Reproduce
1. Go to [page]
2. Use [tool/method]
3. Observe [issue]

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Impact
- Severity: Critical / High / Medium / Low
- Affects: Keyboard users / Screen reader users / Visual users / All
- WCAG Criterion: [e.g., 1.3.1, 2.1.1, etc.]

## Environment
- Browser: 
- Screen Reader (if applicable):
- Operating System:
- Zoom Level:

## Screenshots/Videos
[Attach if applicable]
```

---

## 📝 Final Checklist

### Before Marking Complete
- [ ] All automated tests pass
- [ ] Manual keyboard testing complete
- [ ] Screen reader testing complete  
- [ ] Color contrast verified
- [ ] Zoom testing complete
- [ ] Lighthouse scores documented
- [ ] Issues logged and tracked
- [ ] Documentation updated

### Documentation to Update
- [ ] ACCESSIBILITY_AUDIT.md with test results
- [ ] MASTER_PLAN.md Section 2
- [ ] README.md with accessibility badge
- [ ] This checklist with completion status

---

**Testing Date:** ___________  
**Tester Name:** ___________  
**Tools Used:** ___________  
**Overall Result:** PASS / NEEDS WORK  
**Notes:** ___________
