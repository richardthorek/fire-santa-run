# Quick Reference: Navigation Manual "Next" Button

## What's New?

The turn-by-turn navigation now includes a **manual "NEXT" button** and shows both your current destination and the next stop simultaneously.

## How It Works

### Before (Old UI)
```
┌─────────────────────────────┐
│  Next Stop                  │
│  123 Main Street            │
│  Distance: 150m             │
│  [Mark Complete] [Stop]     │
└─────────────────────────────┘
```
- Could only complete when close (within 50-100m)
- No visibility of upcoming stops
- One button: "Mark Complete"

### After (New UI)
```
┌─────────────────────────────────────┐
│  CURRENT STOP 2/5    │   NEXT       │
│  123 Main Street     │   →          │
│  📍 150m  🕐 3:45PM  │ 456 Oak Rd   │
│  [✓ Arrived]  [Stop]                │
└─────────────────────────────────────┘
```
- See current AND next stop
- Manual skip button (NEXT)
- Clear stop counter (2/5)
- Three completion methods

## Three Ways to Complete a Waypoint

### 1. Auto-Complete (Proximity) ⭐ NEW!
- **How**: Drive within 50 meters of waypoint
- **What happens**: Automatically marks complete and advances
- **Voice**: "Arrived at [location name]"
- **Use case**: Normal operation during Santa run

### 2. Manual Arrival Button
- **How**: Tap "✓ Arrived" when within 100 meters
- **What happens**: Marks complete and advances to next
- **Button state**: Green (enabled) when close, gray (disabled) when far
- **Use case**: When you want manual control near the location

### 3. Skip to Next ⭐ NEW!
- **How**: Tap the orange "NEXT" button (right side)
- **What happens**: Immediately completes current and advances to next
- **Works**: At ANY distance, no proximity required
- **Use case**: 
  - No one home at address
  - Location inaccessible
  - Need to skip ahead quickly
  - Testing/debugging routes

## UI Elements

### Current Waypoint (Left, 2/3 width)
- **Border**: Green (active destination)
- **Shows**: Stop number, address, distance, ETA
- **Purpose**: Main focus while driving

### Next Waypoint (Right, 1/3 width)
- **Color**: Orange button
- **Shows**: Upcoming stop name
- **Icon**: → (right arrow)
- **Tap**: Skips to this waypoint immediately
- **Note**: Only appears when there's another stop after current

### Bottom Buttons
- **✓ Arrived**: Green when close (<100m), confirms arrival
- **Stop**: Red outline, exits navigation anytime

## User Scenarios

### Scenario 1: Normal Operation
1. Drive to waypoint following turn-by-turn directions
2. Arrive within 50m → Auto-completes ✓
3. Panel updates to show next waypoint as current
4. Repeat

### Scenario 2: No One Home
1. Arrive at waypoint, no one answers
2. Tap orange "NEXT" button on right
3. Current waypoint marked complete
4. Navigation immediately routes to next stop

### Scenario 3: Need to Skip Ahead
1. Realize you need to skip to a later stop
2. Tap "NEXT" button repeatedly to advance
3. Each tap completes current and advances one stop
4. Stop when you reach desired waypoint

### Scenario 4: Location Inaccessible
1. Can't access waypoint (road closed, etc.)
2. Don't need to get close - tap "NEXT" from anywhere
3. Skip and continue to next accessible location

## Benefits for Drivers

✅ **Always see what's next** - Plan ahead  
✅ **Manual control** - Skip when needed  
✅ **Flexible completion** - Three methods to choose from  
✅ **Driver-safe** - Large buttons, clear text  
✅ **Progress tracking** - "2/5 stops" always visible

## Testing Guide

### How to Test This Feature

1. **Start navigation** on a route with multiple waypoints
2. **Observe** the dual-panel layout (current + next)
3. **Try auto-complete**: Drive within 50m of waypoint
   - Should auto-advance to next
4. **Try arrived button**: Get within 100m
   - Button should turn green
   - Tap to complete manually
5. **Try NEXT button**: From any distance
   - Tap orange NEXT button
   - Should immediately skip to next waypoint
6. **Verify** on last waypoint:
   - NEXT button should disappear
   - Only "Arrived" and "Stop" buttons visible

### Edge Cases to Test
- [ ] Only 1 waypoint total (NEXT should not appear)
- [ ] Last waypoint (NEXT disappears, just Arrived/Stop)
- [ ] Rapidly tapping NEXT multiple times
- [ ] NEXT button while very far from current waypoint
- [ ] NEXT button while very close to current waypoint

## Technical Details

**Files Modified:**
- `src/hooks/useNavigation.ts` - Added `skipToNextWaypoint()`
- `src/pages/NavigationView.tsx` - Wired up skip handler
- `src/components/NavigationPanel.tsx` - Complete UI redesign

**Tests Added:**
- `src/utils/__tests__/navigation.test.ts` - 9 unit tests

**Documentation:**
- `docs/NAVIGATION_UI_CHANGES.md` - Technical details
- `docs/NAVIGATION_UI_MOCKUP.md` - Visual mockups
- This file - Quick reference

## Questions?

**Q: Can I skip backwards?**  
A: No, only forward. Once a waypoint is completed, it stays completed.

**Q: What if I tap NEXT by accident?**  
A: The waypoint is marked complete. You can't undo it within navigation, but the route continues normally.

**Q: Does NEXT work when offline?**  
A: Yes! It only updates local state, no network required.

**Q: Will NEXT reroute me?**  
A: Yes, after skipping, the navigation automatically calculates the new route to the next waypoint.

**Q: Can I see which waypoints I've skipped vs. arrived at?**  
A: Currently, both are marked as "completed". Future enhancement could track the completion method.
