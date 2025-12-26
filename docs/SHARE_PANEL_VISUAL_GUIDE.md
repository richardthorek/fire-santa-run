# SharePanel Component Visual Guide

## Component Overview

The SharePanel component provides a complete sharing interface for Fire Santa Run routes. It displays a QR code, shareable link, and buttons for various sharing methods.

## Visual Layout

```
┌─────────────────────────────────────────────────────┐
│  🎁 Share Your Route                                │
│                                                     │
│  ┌───────────────────────────────────────┐         │
│  │                                       │         │
│  │          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             │         │
│  │          ▓              ▓             │         │
│  │          ▓  QR Code    ▓             │         │
│  │          ▓  200x200    ▓             │         │
│  │          ▓              ▓             │         │
│  │          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             │         │
│  │                                       │         │
│  └───────────────────────────────────────┘         │
│                                                     │
│  ┌─────────────────────────────────────────┐       │
│  │ http://localhost:5173/track/route_...  │ Copy  │
│  └─────────────────────────────────────────┘       │
│  (Link display with monospace font)                │
│                                                     │
│  ┌────────────────┐  ┌────────────────┐           │
│  │ ⬇️ Download QR │  │ 🖨️ Print Flyer│           │
│  └────────────────┘  └────────────────┘           │
│  (Fire Red)          (Summer Gold)                 │
│                                                     │
│  ───────────────────────────────────────           │
│  Share on social media:                            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐           │
│  │🐦Twitter│ │📘Facebook│ │💬WhatsApp│           │
│  └─────────┘ └──────────┘ └──────────┘           │
│  (Twitter    (Facebook    (WhatsApp               │
│   Blue)       Blue)        Green)                 │
└─────────────────────────────────────────────────────┘
```

## Color Scheme

### Primary Actions
- **Download QR**: Fire Red (#D32F2F) - Main brand color
- **Print Flyer**: Summer Gold (#FFA726) - Secondary accent
- **Copy Button**: Sky Blue (#29B6F6) - Info/action color
  - Changes to Christmas Green (#43A047) when copied

### Social Media
- **Twitter**: #1DA1F2 (Official Twitter Blue)
- **Facebook**: #1877F2 (Official Facebook Blue)
- **WhatsApp**: #25D366 (Official WhatsApp Green)

### Layout
- **Background**: White (#FFFFFF)
- **Border Radius**: 16px (panel), 12px (buttons)
- **Box Shadow**: 0 4px 12px rgba(0, 0, 0, 0.15)
- **Link Background**: Light Gray (#F5F5F5)
- **Text**: Dark Gray (#212121, #616161)

## Interactive States

### Copy Button States
1. **Default**: Blue background, "📋 Copy" text
2. **Hover**: Darker blue, slight animation
3. **Success**: Green background, "✓ Copied!" text
4. **Auto-reset**: Returns to default after 2 seconds

### Button Hover Effects
All buttons have subtle hover states:
- Transform: translateY(-2px)
- Opacity changes
- Color darkening

## Responsive Behavior

### Desktop (>768px)
- QR Code: 200px
- Buttons: Flex row with wrapping
- Full padding: 1.5rem
- Standard text sizes

### Mobile (<768px)
- QR Code: 150px (compact mode available)
- Buttons: Stack vertically or wrap
- Reduced padding: 1rem
- Touch-friendly targets (min 44px)

## QR Code Features

### Display
- Size: 200x200px (standard), 150x150px (compact)
- Error correction: Level H (30%)
- Margin: Included
- Border: 2px solid #E0E0E0
- Background: White with padding

### Download Format
When downloaded, the QR code PNG includes:
```
┌───────────────────────────────┐
│                               │
│    🎅 Fire Santa Run          │ (Fire Red, bold)
│    Christmas Eve Route        │ (Route name)
│                               │
│    ┌─────────────────┐        │
│    │                 │        │
│    │   QR Code       │        │
│    │   400x400px     │        │
│    │                 │        │
│    └─────────────────┘        │
│                               │
│    http://localhost:5173/... │ (Link text, small)
│                               │
└───────────────────────────────┘
```
Total size: 480x560px with branding

## Print Layout

When printing (window.print() or Ctrl+P):

```
┌────────────────────────────────────┐
│                                    │
│     🎅 Fire Santa Run              │
│     (Large, Fire Red heading)      │
│                                    │
│     Christmas Eve 2024 Route       │
│     (Route name, bold)             │
│                                    │
│     Dec 24, 2024 at 18:00         │
│     (Date/time)                    │
│                                    │
│     ┌───────────────────┐         │
│     │                   │         │
│     │    QR Code        │         │
│     │    300x300px      │         │
│     │                   │         │
│     └───────────────────┘         │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ Track Santa in Real-Time!    │ │
│  │ http://localhost:5173/track..│ │
│  └──────────────────────────────┘ │
│                                    │
│  Route description text here...   │
│                                    │
│  Scan the QR code or visit the    │
│  link above to track Santa!       │
│                                    │
└────────────────────────────────────┘
```

Optimized for:
- A4/Letter paper
- High contrast
- Centered layout
- Professional appearance
- Clear instructions

## Social Media Sharing

### Pre-formatted Messages

**Twitter**:
```
🎅 Track Santa in real-time for Christmas Eve 2024 - North Route! 
Join us on 2024-12-24

[Link]
```

**Facebook**:
```
[Opens Facebook share dialog with link only]
```

**WhatsApp**:
```
🎅 Track Santa in real-time for Christmas Eve 2024 - North Route! 
http://localhost:5173/track/route_123
```

## Integration Points

### Dashboard
- Share button appears on route cards
- Only enabled for published/active/completed routes
- Opens in modal overlay
- Click outside or X button to close

### TrackingView
- Share button in top-right of header
- Blue button with white text
- Accessible to all public viewers
- Opens same ShareModal

### ShareModal
- Semi-transparent black backdrop (50% opacity)
- Centered modal (max-width 600px)
- X close button in top-right
- Click backdrop to close
- Proper z-index (2000)
- Smooth transitions

## Accessibility Features

- ✅ Keyboard navigation (Tab through all elements)
- ✅ Focus indicators on all interactive elements
- ✅ ARIA labels (close button)
- ✅ Semantic HTML structure
- ✅ Color contrast ratios meet WCAG AA
- ✅ Touch targets minimum 44x44px
- ✅ Screen reader friendly text

## Browser Compatibility

### Clipboard API
- Modern browsers: navigator.clipboard.writeText()
- Fallback: document.execCommand('copy')
- Works in: Chrome, Firefox, Safari, Edge

### Canvas API (Download)
- Universally supported
- toBlob() method for PNG generation
- Works in all modern browsers

### Print Media Queries
- @media print CSS
- window.print() JavaScript
- Works in all browsers

## Performance

- QR code generation: < 50ms
- PNG download: < 100ms
- Modal open/close: Instant
- No server-side processing
- Minimal bundle size impact (~15KB)

## Future Enhancements

Potential additions (not in current scope):
- [ ] Custom QR code colors/branding
- [ ] Multiple QR code sizes
- [ ] SVG QR code format
- [ ] Email sharing
- [ ] SMS sharing
- [ ] Analytics tracking
- [ ] Short URL generation
- [ ] Custom preview images
- [ ] Multiple language support
