/**
 * Design system constants for the Fire Santa Run application
 * Based on iOS design guidelines and MASTER_PLAN.md Section 2
 */

// Floating Panel Design System
export const FLOATING_PANEL = {
  // Border radius
  borderRadius: {
    standard: '16px',
    button: '12px',
    large: '20px', // Mobile bottom sheet
  },
  
  // Shadows
  shadow: {
    standard: '0 4px 12px rgba(0, 0, 0, 0.15)',
    emphasis: '0 8px 24px rgba(0, 0, 0, 0.2)',
  },
  
  // Backdrop
  backdrop: {
    blur: 'blur(10px)',
    opacity: 0.95,
  },
  
  // Spacing
  spacing: {
    edge: '1rem', // 16px from screen edges
    internal: '1.5rem', // 24px internal padding
  },
  
  // Dimensions
  dimensions: {
    navigationHeaderHeight: '80px',
    floatingButtonSize: '48px',
    sidebarMaxWidth: '400px',
    mobileBottomSheetMaxHeight: '60vh',
  },
} as const;

// Touch Target Sizes (WCAG AA)
export const TOUCH_TARGET = {
  minimum: '44px', // Minimum touch target size
  recommended: '48px', // Recommended for better UX
} as const;

// Responsive Breakpoints
export const BREAKPOINTS = {
  mobile: 768, // px - mobile styles apply below this breakpoint
  tablet: 1024, // px
  desktop: 1280, // px
} as const;

// Color Palette (from MASTER_PLAN.md)
export const COLORS = {
  // Fire Brigade Red
  fireRed: '#D32F2F',
  fireRedDark: '#B71C1C',
  fireRedLight: '#EF5350',
  
  // Summer Gold
  summerGold: '#FFA726',
  summerGoldLight: '#FFB74D',
  
  // Christmas Green
  christmasGreen: '#43A047',
  eucalyptusGreen: '#66BB6A',
  
  // Supporting Colors
  skyBlue: '#29B6F6',
  oceanBlue: '#0288D1',
  
  // Neutrals
  neutral50: '#FAFAFA',
  neutral100: '#F5F5F5',
  neutral200: '#EEEEEE',
  neutral300: '#E0E0E0',
  neutral700: '#616161',
  neutral800: '#424242',
  neutral900: '#212121',
} as const;

// Z-Index Scale
export const Z_INDEX = {
  map: 0,
  floatingButton: 999,
  floatingPanel: 1000,
  modal: 2000,
  devModeIndicator: 9999,
} as const;
