// One place for every colour and size, so the whole app stays consistent.
//
// The design target is someone holding a phone with dirty hands, in a garage,
// glancing at the screen between turns of a wrench. That means: dark background
// (less glare, easier on the eyes under a car), very large text, and buttons
// big enough to hit with a knuckle.

export const colors = {
  background: '#12151A',
  surface: '#1C212A',
  surfaceRaised: '#252C38',
  border: '#333C4A',

  text: '#F2F5F8',
  textMuted: '#9AA6B5',

  accent: '#FF8A3D',
  accentPressed: '#E5701F',
  accentText: '#1A1005',

  success: '#3DD68C',
  warning: '#FFC93D',
  danger: '#FF6B6B',
};

export const spacing = {
  xs: 6,
  sm: 12,
  md: 18,
  lg: 26,
  xl: 36,
};

export const fonts = {
  // Deliberately oversized compared with a normal app.
  huge: 34,
  title: 26,
  body: 20,
  label: 17,
  small: 15,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
};

// Minimum height for anything tappable. Android's guideline is 48; we go well
// past it because the user may be wearing gloves.
export const TAP_TARGET = 64;
