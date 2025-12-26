# SharePanel & ShareModal Usage Examples

## Basic Import

```typescript
import { SharePanel, ShareModal } from '../components';
import type { Route } from '../types';
```

## Example 1: SharePanel Component (Direct Usage)

```typescript
import { SharePanel } from '../components';

function MyComponent() {
  const route: Route = {
    id: 'route_123',
    brigadeId: 'brigade_456',
    name: 'Christmas Eve 2024 - North Route',
    description: 'Visiting northern suburbs',
    date: '2024-12-24',
    startTime: '18:00',
    status: 'published',
    waypoints: [],
    shareableLink: 'https://example.com/track/route_123',
    createdAt: new Date().toISOString(),
  };

  return (
    <div>
      <h1>Share This Route</h1>
      <SharePanel route={route} showPrintButton={true} compact={false} />
    </div>
  );
}
```

## Example 2: ShareModal Component (Modal Dialog)

```typescript
import { useState } from 'react';
import { ShareModal } from '../components';
import type { Route } from '../types';

function DashboardCard({ route }: { route: Route }) {
  const [showShareModal, setShowShareModal] = useState(false);

  return (
    <div>
      <h3>{route.name}</h3>
      <button onClick={() => setShowShareModal(true)}>
        🔗 Share
      </button>

      {showShareModal && (
        <ShareModal
          route={route}
          isOpen={true}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
```

## Example 3: Dashboard Integration (Actual Implementation)

```typescript
import { useState } from 'react';
import { ShareModal } from '../components';
import type { Route } from '../types';

export function Dashboard() {
  const [shareModalRoute, setShareModalRoute] = useState<Route | null>(null);

  return (
    <div>
      {/* Route cards */}
      {routes.map(route => (
        <div key={route.id}>
          <h3>{route.name}</h3>
          
          {/* Share button - only enabled for published routes */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (route.status === 'published' || 
                  route.status === 'active' || 
                  route.status === 'completed') {
                setShareModalRoute(route);
              } else {
                alert('Route must be published before sharing');
              }
            }}
            disabled={route.status === 'draft'}
            style={{
              opacity: (route.status === 'published' || 
                       route.status === 'active' || 
                       route.status === 'completed') ? 1 : 0.5,
            }}
          >
            🔗 Share
          </button>
        </div>
      ))}

      {/* Share Modal */}
      {shareModalRoute && (
        <ShareModal
          route={shareModalRoute}
          isOpen={true}
          onClose={() => setShareModalRoute(null)}
        />
      )}
    </div>
  );
}
```

## Example 4: TrackingView Integration (Public Viewer)

```typescript
import { useState } from 'react';
import { ShareModal } from '../components';
import type { Route } from '../types';

export function TrackingView({ routeId }: { routeId: string }) {
  const [route, setRoute] = useState<Route | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // ... route loading logic ...

  return (
    <div>
      {/* Header with share button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1>{route?.name}</h1>
        <button
          onClick={() => setShowShareModal(true)}
          style={{
            backgroundColor: '#29B6F6',
            color: 'white',
          }}
        >
          🔗 Share
        </button>
      </div>

      {/* Map and tracking UI */}
      {/* ... */}

      {/* Share Modal */}
      {showShareModal && route && (
        <ShareModal
          route={route}
          isOpen={true}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
```

## Example 5: Compact Mode

```typescript
import { SharePanel } from '../components';

function SidebarShare({ route }: { route: Route }) {
  return (
    <div style={{ width: '300px' }}>
      <SharePanel 
        route={route} 
        showPrintButton={false}  // Hide print button in sidebar
        compact={true}           // Use smaller QR code (150px)
      />
    </div>
  );
}
```

## Example 6: Custom Styling

```typescript
import { ShareModal } from '../components';

function CustomShareButton({ route }: { route: Route }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          // Custom button styling
          background: 'linear-gradient(135deg, #FFA726 0%, #FFB74D 100%)',
          border: 'none',
          borderRadius: '12px',
          padding: '0.75rem 1.5rem',
          color: '#212121',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(255, 167, 38, 0.3)',
        }}
      >
        🎁 Share This Santa Run
      </button>

      <ShareModal
        route={route}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
```

## Example 7: Programmatic Actions

```typescript
import { useRef } from 'react';

function AdvancedSharePanel({ route }: { route: Route }) {
  const qrRef = useRef<HTMLDivElement>(null);

  // Programmatically download QR code
  const handleCustomDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `custom-name.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  // Programmatically copy link
  const handleCustomCopy = async () => {
    const link = route.shareableLink || `${window.location.origin}/track/${route.id}`;
    try {
      await navigator.clipboard.writeText(link);
      console.log('Copied!');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div>
      <div ref={qrRef}>
        <SharePanel route={route} />
      </div>
      
      {/* Custom actions */}
      <button onClick={handleCustomDownload}>Custom Download</button>
      <button onClick={handleCustomCopy}>Custom Copy</button>
    </div>
  );
}
```

## Example 8: Conditional Rendering

```typescript
import { SharePanel } from '../components';
import type { Route } from '../types';

function ConditionalShare({ route }: { route: Route }) {
  // Only show share panel for published routes
  if (route.status === 'draft') {
    return (
      <div>
        <p>Publish this route to share it with others.</p>
        <button>Publish Route</button>
      </div>
    );
  }

  return <SharePanel route={route} showPrintButton={true} />;
}
```

## Example 9: Event Handling

```typescript
import { useState } from 'react';
import { ShareModal } from '../components';

function TrackedShare({ route }: { route: Route }) {
  const [showModal, setShowModal] = useState(false);

  const handleOpen = () => {
    console.log('Share modal opened for route:', route.id);
    // Track analytics
    setShowModal(true);
  };

  const handleClose = () => {
    console.log('Share modal closed for route:', route.id);
    // Track analytics
    setShowModal(false);
  };

  return (
    <>
      <button onClick={handleOpen}>Share</button>
      
      {showModal && (
        <ShareModal
          route={route}
          isOpen={true}
          onClose={handleClose}
        />
      )}
    </>
  );
}
```

## Example 10: Multiple Routes

```typescript
import { useState } from 'react';
import { ShareModal } from '../components';
import type { Route } from '../types';

function MultiRouteShare({ routes }: { routes: Route[] }) {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  return (
    <div>
      <h2>Share Any Route</h2>
      {routes.map(route => (
        <button
          key={route.id}
          onClick={() => setSelectedRoute(route)}
        >
          Share {route.name}
        </button>
      ))}

      {selectedRoute && (
        <ShareModal
          route={selectedRoute}
          isOpen={true}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  );
}
```

## Props Reference

### SharePanel Props

```typescript
interface SharePanelProps {
  route: Route;              // Required: Route object with sharing data
  showPrintButton?: boolean; // Optional: Show print button (default: true)
  compact?: boolean;         // Optional: Use compact mode (default: false)
}
```

### ShareModal Props

```typescript
interface ShareModalProps {
  route: Route;     // Required: Route object with sharing data
  isOpen: boolean;  // Required: Control modal visibility
  onClose: () => void; // Required: Callback when modal should close
}
```

### Route Type (Relevant Fields)

```typescript
interface Route {
  id: string;                // Used for generating tracking URL
  name: string;              // Displayed in share messages
  description?: string;      // Used in print layout
  date: string;              // Used in share messages
  startTime: string;         // Used in print layout
  status: RouteStatus;       // Controls share button availability
  shareableLink?: string;    // Pre-generated link (optional)
  // ... other fields
}
```

## Common Use Cases

### 1. Brigade Dashboard
- Show share button on published route cards
- Open modal on click
- Allow operators to download QR codes for flyers

### 2. Public Tracking Page
- Show share button in header
- Allow viewers to share with friends/family
- Enable social media sharing

### 3. Route Management
- Show sharing options after publishing
- Provide QR code for printing
- Enable clipboard copy for quick sharing

### 4. Embedded Sharing
- Compact mode in sidebars
- Direct SharePanel without modal
- Custom styling to match context

## Best Practices

1. **Check Route Status**: Only enable sharing for published/active/completed routes
2. **Provide Feedback**: Use visual feedback for copy/download actions
3. **Mobile-First**: Design for mobile users who will scan QR codes
4. **Accessibility**: Ensure keyboard navigation and screen reader support
5. **Error Handling**: Handle clipboard API failures gracefully
6. **Analytics**: Track share actions for insights
7. **Testing**: Test QR codes on real mobile devices
8. **Print Preview**: Test print layout on different paper sizes

## Troubleshooting

### QR Code Not Rendering
- Check that qrcode.react is installed: `npm list qrcode.react`
- Verify route has valid shareableLink or id field
- Check browser console for errors

### Copy to Clipboard Fails
- Ensure page is served over HTTPS (production)
- Check browser permissions for clipboard access
- Fallback should work in older browsers

### Print Layout Issues
- Test print preview (Ctrl+P or Cmd+P)
- Check @media print CSS is loading
- Verify window.print() is supported

### Social Share Not Opening
- Check popup blocker settings
- Verify URL encoding is correct
- Test with different browsers

### Modal Not Closing
- Verify onClose callback is provided
- Check z-index conflicts with other elements
- Test click-outside functionality
