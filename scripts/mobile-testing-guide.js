#!/usr/bin/env node

/**
 * Mobile Device Testing Guide Generator
 * 
 * Generates a comprehensive guide for testing Fire Santa Run
 * on real mobile devices (iOS and Android).
 * 
 * This script helps testers validate all features on actual hardware.
 */

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(80)}`, colors.cyan);
  log(`${title}`, colors.cyan);
  log(`${'='.repeat(80)}\n`, colors.cyan);
}

function main() {
  log('\n🎅 Fire Santa Run - Mobile Device Testing Guide 🚒\n', colors.cyan);
  
  section('OVERVIEW');
  log('This guide helps you test the application on real mobile devices.');
  log('Testing on actual hardware is CRITICAL for GPS, touch, and performance.\n');
  log('📱 Required Devices:', colors.blue);
  log('   • iOS device (iPhone running iOS 15+)');
  log('   • Android device (phone running Android 10+)');
  log('   • WiFi or mobile data connection');
  log('   • QR code scanner app (optional)\n');
  
  section('SETUP');
  log('1. Access the application URL on your mobile device', colors.green);
  log('   • Production: https://victorious-beach-0d2b6dc00.azurestaticapps.net');
  log('   • Staging: Use staging URL provided by team');
  log('   • Local: Use ngrok or similar for local testing\n');
  
  log('2. Add to home screen (optional)', colors.green);
  log('   iOS: Safari > Share > Add to Home Screen');
  log('   Android: Chrome > Menu > Add to Home Screen\n');
  
  log('3. Grant permissions when prompted', colors.green);
  log('   • Location access (for GPS tracking)');
  log('   • Notifications (for alerts)');
  log('   • Camera (for QR scanning, if applicable)\n');
  
  section('iOS TESTING CHECKLIST');
  
  log('📱 Device Specifications to Test:', colors.blue);
  log('   [ ] iPhone SE or similar (small screen: 375×667)');
  log('   [ ] iPhone 12/13/14 (standard: 390×844)');
  log('   [ ] iPhone Pro Max (large: 428×926)');
  log('   [ ] iPad (tablet: 768×1024+)\n');
  
  log('🧪 Core Features on iOS:', colors.magenta);
  
  log('\n1. Page Load & Performance', colors.yellow);
  log('   [ ] Home page loads in < 3 seconds');
  log('   [ ] No white screen or hanging');
  log('   [ ] Smooth scrolling');
  log('   [ ] No layout shifts during load');
  
  log('\n2. Authentication', colors.yellow);
  log('   [ ] Login button visible and tappable');
  log('   [ ] Redirects to Microsoft login');
  log('   [ ] Can complete sign-in flow');
  log('   [ ] Returns to app after login');
  log('   [ ] Session persists on reload');
  
  log('\n3. Route Planning', colors.yellow);
  log('   [ ] Map loads and is interactive');
  log('   [ ] Can pinch to zoom');
  log('   [ ] Can drag to pan');
  log('   [ ] Can tap to add waypoints');
  log('   [ ] Waypoint markers visible');
  log('   [ ] Can reorder waypoints (drag & drop)');
  log('   [ ] Route line draws between waypoints');
  log('   [ ] Save button works');
  
  log('\n4. Navigation Mode', colors.yellow);
  log('   [ ] Turn-by-turn directions load');
  log('   [ ] GPS blue dot appears on map');
  log('   [ ] Location updates in real-time');
  log('   [ ] Voice instructions play (test with sound on)');
  log('   [ ] Screen stays awake (wake lock)');
  log('   [ ] Compass heading rotates correctly');
  log('   [ ] Distance to next turn updates');
  log('   [ ] ETA updates dynamically');
  
  log('\n5. Real-Time Tracking (Public View)', colors.yellow);
  log('   [ ] Tracking page loads from shareable link');
  log('   [ ] Santa icon appears on map');
  log('   [ ] Santa position updates (receive test broadcasts)');
  log('   [ ] Map centers on Santa automatically');
  log('   [ ] Smooth animation between position updates');
  log('   [ ] Works when app is in background');
  
  log('\n6. Touch & Gestures', colors.yellow);
  log('   [ ] All buttons have 44×44px minimum touch target');
  log('   [ ] Buttons respond immediately to tap');
  log('   [ ] No accidental double-taps');
  log('   [ ] Swipe gestures work (if applicable)');
  log('   [ ] Long press works (if applicable)');
  
  log('\n7. Safari-Specific Issues', colors.yellow);
  log('   [ ] No "Add to Home Screen" banner interference');
  log('   [ ] Viewport zoom disabled for navigation');
  log('   [ ] No horizontal scrolling');
  log('   [ ] Console.log output (connect to Mac for debugging)');
  log('   [ ] Check for iOS 15+ WKWebView issues');
  
  section('ANDROID TESTING CHECKLIST');
  
  log('📱 Device Specifications to Test:', colors.blue);
  log('   [ ] Standard Android phone (360×640 or similar)');
  log('   [ ] Large Android phone (412×915)');
  log('   [ ] Android tablet (800×1280+)\n');
  
  log('🧪 Core Features on Android:', colors.magenta);
  
  log('\n1. Page Load & Performance', colors.yellow);
  log('   [ ] Home page loads in < 3 seconds');
  log('   [ ] No blank screen or freezing');
  log('   [ ] Smooth scrolling');
  log('   [ ] No janky animations');
  
  log('\n2. Authentication', colors.yellow);
  log('   [ ] Login button visible and tappable');
  log('   [ ] Redirects to Microsoft login');
  log('   [ ] Can complete sign-in flow');
  log('   [ ] Returns to app after login (Chrome)');
  log('   [ ] Session persists on reload');
  
  log('\n3. Route Planning', colors.yellow);
  log('   [ ] Map loads and is interactive');
  log('   [ ] Can pinch to zoom');
  log('   [ ] Can drag to pan');
  log('   [ ] Can tap to add waypoints');
  log('   [ ] Waypoint markers visible');
  log('   [ ] Can reorder waypoints');
  log('   [ ] Route line draws correctly');
  log('   [ ] Save button works');
  
  log('\n4. Navigation Mode', colors.yellow);
  log('   [ ] Turn-by-turn directions load');
  log('   [ ] GPS blue dot appears on map');
  log('   [ ] Location updates in real-time');
  log('   [ ] Voice instructions play (Chrome)');
  log('   [ ] Screen stays awake (wake lock)');
  log('   [ ] Compass heading works');
  log('   [ ] Distance/ETA updates');
  
  log('\n5. Real-Time Tracking', colors.yellow);
  log('   [ ] Tracking page loads from link');
  log('   [ ] Santa icon appears');
  log('   [ ] Position updates received');
  log('   [ ] Map auto-centers on Santa');
  log('   [ ] Smooth animations');
  
  log('\n6. Android-Specific Features', colors.yellow);
  log('   [ ] Back button works correctly');
  log('   [ ] App handles task switching');
  log('   [ ] No memory leaks on repeated navigation');
  log('   [ ] Pull-to-refresh disabled where needed');
  log('   [ ] Keyboard doesn\'t cover input fields');
  
  log('\n7. Chrome DevTools Remote Debugging', colors.yellow);
  log('   [ ] Connect device via USB');
  log('   [ ] Enable USB debugging in Developer Options');
  log('   [ ] Open chrome://inspect on desktop');
  log('   [ ] Check console for errors');
  log('   [ ] Monitor network requests');
  
  section('CROSS-PLATFORM TESTING');
  
  log('🔄 Features to Test on BOTH platforms:', colors.magenta);
  log('\n1. Offline Behavior', colors.yellow);
  log('   [ ] App shows offline indicator');
  log('   [ ] Cached content available');
  log('   [ ] Graceful reconnection when online');
  
  log('\n2. Network Conditions', colors.yellow);
  log('   [ ] Test on WiFi');
  log('   [ ] Test on 4G/5G');
  log('   [ ] Test on slow 3G (throttling)');
  log('   [ ] Test connection drop/resume');
  
  log('\n3. Battery Impact', colors.yellow);
  log('   [ ] GPS tracking doesn\'t drain battery excessively');
  log('   [ ] App suspends properly in background');
  log('   [ ] Wake lock releases when navigation ends');
  
  log('\n4. Accessibility', colors.yellow);
  log('   [ ] Text readable without zoom');
  log('   [ ] Color contrast sufficient');
  log('   [ ] Touch targets large enough');
  log('   [ ] VoiceOver/TalkBack compatible (basic test)');
  
  section('COMMON ISSUES TO WATCH FOR');
  
  log('⚠️  GPS & Location:', colors.red);
  log('   • "Location access denied" errors');
  log('   • GPS not updating position');
  log('   • Inaccurate location (50+ meters off)');
  log('   • Location jumps around randomly');
  
  log('\n⚠️  Maps:', colors.red);
  log('   • Map doesn\'t load (gray tiles)');
  log('   • Map freezes on zoom/pan');
  log('   • Markers don\'t appear');
  log('   • Route line disappears');
  
  log('\n⚠️  Performance:', colors.red);
  log('   • App feels sluggish (> 500ms tap response)');
  log('   • Animations stutter');
  log('   • Memory warnings/crashes');
  log('   • Battery drains quickly');
  
  log('\n⚠️  UI/Layout:', colors.red);
  log('   • Content cut off at bottom');
  log('   • Horizontal scrolling present');
  log('   • Buttons too small to tap');
  log('   • Text unreadable (too small/low contrast)');
  
  section('REPORTING ISSUES');
  
  log('When you find a bug, capture:', colors.green);
  log('   1. Device model and OS version');
  log('   2. Browser and version');
  log('   3. Steps to reproduce');
  log('   4. Screenshot or screen recording');
  log('   5. Console errors (if possible)');
  log('   6. Network conditions (WiFi/4G/etc.)');
  
  log('\nExample Bug Report:', colors.blue);
  log('-------------------');
  log('Device: iPhone 13, iOS 16.5');
  log('Browser: Safari 16.5');
  log('Issue: GPS location not updating in Navigation mode');
  log('Steps: 1) Open route, 2) Start navigation, 3) Walk 50m');
  log('Expected: Blue dot moves with me');
  log('Actual: Blue dot stays at start location');
  log('Screenshot: [attach]');
  log('Console: "Geolocation permission denied"\n');
  
  section('TESTING TIPS');
  
  log('💡 Best Practices:', colors.yellow);
  log('   • Test with location services OFF first (should show error)');
  log('   • Test with location services ON (should work)');
  log('   • Test in both portrait and landscape orientations');
  log('   • Test with low battery mode enabled');
  log('   • Test with airplane mode (offline behavior)');
  log('   • Actually walk/drive to test real GPS tracking');
  log('   • Test during daytime and nighttime (map visibility)');
  log('   • Test with sound on AND muted (voice instructions)');
  log('   • Clear browser cache between tests');
  log('   • Test with different network speeds\n');
  
  section('REMOTE DEBUGGING SETUP');
  
  log('iOS (Safari):', colors.blue);
  log('   1. Connect iPhone to Mac via USB');
  log('   2. On iPhone: Settings > Safari > Advanced > Web Inspector: ON');
  log('   3. On Mac: Safari > Develop > [Your iPhone] > [Site]');
  log('   4. Inspect console, network, elements\n');
  
  log('Android (Chrome):', colors.blue);
  log('   1. Enable Developer Options: Settings > About > Tap Build # 7 times');
  log('   2. Enable USB Debugging: Settings > Developer Options');
  log('   3. Connect phone to computer via USB');
  log('   4. Open Chrome on computer: chrome://inspect');
  log('   5. Click "Inspect" under your device');
  log('   6. Use full DevTools (console, network, etc.)\n');
  
  section('COMPLETION');
  
  log('✅ After completing all tests:', colors.green);
  log('   1. Fill out test report with results');
  log('   2. Document all issues found');
  log('   3. Prioritize issues (P0/P1/P2)');
  log('   4. Create GitHub issues for bugs');
  log('   5. Share findings with team');
  log('   6. Retest after fixes deployed\n');
  
  log('🎉 Thank you for thorough mobile testing! 🎉\n', colors.green);
}

main();
