# Navigation UI Changes - Manual "Next" Button

## Overview
This document describes the UI changes made to the turn-by-turn navigation interface to add manual waypoint advancement functionality.

## Problem Statement
The previous implementation only allowed waypoint completion when the vehicle was within 50-100 meters of the waypoint. This caused issues where:
1. The driver would arrive at a location but couldn't manually advance
2. No visibility of the upcoming waypoint
3. Required proximity-based completion which wasn't always practical

## Solution

### New UI Layout
The bottom navigation panel now displays a 2/3 + 1/3 split layout:

```
┌─────────────────────────────────────────────────────────┐
│                    Route Progress                       │
│  ████████████░░░░░░░░░░░░░░░░░░   2 / 5 stops          │
├──────────────────────────┬──────────────────────────────┤
│  CURRENT STOP 2/5        │   NEXT                       │
│  ┌──────────────────┐    │   ┌──────────────────┐      │
│  │ 123 Main Street  │    │   │  →                │      │
│  │ 📍 150m  🕐 3:45PM│   │   │  456 Oak Road     │      │
│  └──────────────────┘    │   └──────────────────┘      │
│                          │  [Tap to Skip]               │
├──────────────────────────┴──────────────────────────────┤
│  [✓ Arrived]                             [Stop]         │
└─────────────────────────────────────────────────────────┘
```

### Key Features

#### 1. Current Waypoint Display (Left - 2/3 width)
- **Highlighted with green border** to indicate active destination
- Shows **stop number** (e.g., "CURRENT STOP 2/5")
- Displays **waypoint name or address** in large, bold text
- Shows **distance** (📍 150m) and **ETA** (🕐 3:45 PM)
- Easy to read while driving

#### 2. Next Waypoint Preview (Right - 1/3 width)
- **Orange button** labeled "NEXT" at top
- Shows **right arrow** (→) to indicate forward movement
- Displays **next waypoint name** or stop number
- **Tappable entire area** to skip to next waypoint
- Only appears when there's a waypoint after the current one

#### 3. Action Buttons (Bottom Row)
- **"✓ Arrived" button**: Green gradient, disabled when >100m away
  - Enables automatic completion when near waypoint
  - Renamed from "Mark Complete" for clarity
- **"Stop" button**: Red border, always enabled
  - Exits navigation and returns to route detail

## User Flows

### Manual Skip Flow
1. Driver arrives at waypoint (or decides to skip)
2. Tap the orange "NEXT" button on the right
3. Current waypoint is marked as completed
4. Next waypoint becomes current
5. Panel updates to show new current/next waypoints
6. Navigation recalculates route if needed

### Proximity-Based Flow (Unchanged)
1. Driver approaches within 50m of waypoint
2. Waypoint auto-completes
3. Voice announcement "Arrived at [location]"
4. Next waypoint becomes current

### Arrived Button Flow
1. Driver is within 100m of waypoint
2. "✓ Arrived" button becomes enabled (green)
3. Driver taps to manually confirm arrival
4. Waypoint marked as completed
5. Proceeds to next waypoint

## Technical Implementation

### Changes Made

#### `src/hooks/useNavigation.ts`
- Added `skipToNextWaypoint()` function
- Calls `completeWaypoint()` for current nextWaypoint
- No proximity check required

#### `src/pages/NavigationView.tsx`
- Receives `skipToNextWaypoint` from hook
- Creates `handleSkipToNext` callback
- Passes handler and full waypoints array to NavigationPanel

#### `src/components/NavigationPanel.tsx`
- Complete redesign with flex layout
- Calculates `waypointAfterNext` to show preview
- Current waypoint: 2/3 flex, gray background, green border
- Next waypoint: 1/3 flex, orange button, full-height
- Touch-optimized button sizes (minimum 44x44pt)

## Design Principles

### Driver Safety
- **Large touch targets** (minimum 48px)
- **High contrast text** for visibility
- **Clear hierarchy** (current waypoint most prominent)
- **Minimal cognitive load** (one glance shows current + next)

### Visual Feedback
- **Color coding**: Green (current), Orange (next), Red (stop)
- **Icons**: 📍 distance, 🕐 time
- **Disabled states**: Gray when "Arrived" button unavailable

### Mobile-First
- Responsive layout works on small screens
- Thumb-friendly button placement
- Bottom sheet style for easy reach

## Testing
Unit tests added in `src/utils/__tests__/navigation.test.ts` covering:
- `findNextWaypoint()` - finds correct next waypoint
- `isNearWaypoint()` - proximity detection
- `calculateDistance()` - distance calculations

All tests passing ✓

## Future Enhancements
- Swipe gesture to advance waypoints
- Long-press on NEXT to skip multiple waypoints
- Haptic feedback on waypoint completion
- Route preview animation when skipping
