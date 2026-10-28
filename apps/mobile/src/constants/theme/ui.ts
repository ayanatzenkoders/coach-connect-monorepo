import { COLORS } from './colors';

export const SPACING = { sm: 8, md: 12, lg: 16, xl: 24, xxl: 28 } as const;
export const RADIUS = { control: 12, logo: 13 } as const;

/**
 * How far the phone's "larger text" setting may grow each kind of text. Text scales with the user's setting
 * (good for reading), but headings, tab labels and chips sit in fixed layouts: unlimited growth breaks a word
 * in half ("Messag-es"). Normal text is left uncapped so people who need big text still get it.
 */
export const MAX_FONT_SCALE = { title: 1.3, chrome: 1.2, control: 1.3 } as const;

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
