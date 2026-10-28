/**
 * Design tokens taken from the Coach Connect UI design. Screens use these names,
 * never raw hex values, so a design change is a one-file edit.
 */
export const COLORS = {
  background: '#F3F4F1',
  surface: '#FFFFFF',
  ink: '#141A17', // main text
  inkSecondary: '#464E49',
  inkMuted: '#646B66',
  border: '#C9CEC6', // input borders
  divider: '#DDE0D9',
  primary: '#1D5C4C', // main green
  primaryPressed: '#174A3D',
  primaryTint: '#E3EDE8',
  onPrimary: '#FFFFFF',
  error: '#B3261E',
  errorTint: '#F9E3E1',
  warningInk: '#7F3D0A',
  warningTint: '#F7EBDD',
} as const;
