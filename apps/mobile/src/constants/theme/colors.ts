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
  /** A calm grey-green panel: the track behind a segmented switch, the border of a disabled button. */
  surfaceMuted: '#E4E7E1',
  /** Softer white text on the green splash screen. */
  onPrimaryMuted: '#D3E3DC',
  /** The thin progress track on the green splash screen. */
  onPrimaryTrack: 'rgba(255,255,255,0.22)',
  /** Greyed-out icons and the "offline" dot. */
  inkDisabled: '#8C938E',
  /** The colour of drop shadows. */
  shadow: '#000000',
} as const;

/** Soft background + dark letters for avatars, so every person gets a steady colour of their own. */
export const AVATAR_TINTS = [
  { bg: COLORS.primaryTint, ink: COLORS.primaryPressed },
  { bg: COLORS.warningTint, ink: COLORS.warningInk },
  { bg: '#E4E8F4', ink: '#2A3B7A' },
  { bg: '#F3E3EA', ink: '#7A2A4B' },
] as const;
