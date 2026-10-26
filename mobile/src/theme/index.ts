/**
 * Design tokens taken from the Coach Connect UI design. Screens use these names,
 * never raw colors, so a design change is a one-file edit.
 */
export const colors = {
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
  errorTint: '#F9E6E4',
  errorInk: '#8E1F18',
  warningInk: '#7F3D0A',
  warningTint: '#F7EBDD',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 28 } as const;
export const radius = { control: 12, logo: 13 } as const;

/**
 * The design uses Bricolage Grotesque (headings) and Hanken Grotesk (body).
 * TODO: bundle the font files; until then the phone's default font is used.
 */
export const fonts = {
  heading: undefined as string | undefined,
  body: undefined as string | undefined,
};

export const text = {
  title: { fontSize: 32, fontWeight: '600', letterSpacing: -0.64, color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.inkSecondary },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  small: { fontSize: 13, color: colors.inkMuted },
  link: { fontSize: 14, fontWeight: '600', color: colors.primary },
} as const;

/** Minimum touch target recommended by Apple and Google. */
export const MIN_TOUCH = 44;
export const CONTROL_HEIGHT = 52;
