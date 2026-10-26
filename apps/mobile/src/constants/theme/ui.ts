import { COLORS } from './colors';

export const SPACING = { sm: 8, md: 12, lg: 16, xl: 24, xxl: 28 } as const;
export const RADIUS = { control: 12, logo: 13 } as const;

/** Text styles shared by screens. */
export const TEXT = {
  title: { fontSize: 32, fontWeight: '600', letterSpacing: -0.64, color: COLORS.ink },
  body: { fontSize: 16, lineHeight: 24, color: COLORS.inkSecondary },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  small: { fontSize: 13, color: COLORS.inkMuted },
  link: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
} as const;

/** Minimum touch target recommended by Apple and Google. */
export const MIN_TOUCH = 44;
export const CONTROL_HEIGHT = 52;
