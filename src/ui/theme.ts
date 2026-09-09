/**
 * What the app is made of, as data.
 *
 * Colours are values rather than choices scattered through the screens, so
 * they can be checked: `__tests__/theme.test.ts` asserts every pairing against
 * WCAG. The first draft of this palette failed that check in seven places,
 * which is the argument for keeping it as data.
 */

export type ThemeName = 'light' | 'paper' | 'dark';
export type ThemeSetting = ThemeName | 'system';

export interface Colors {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  /**
   * A hairline between rows. Decorative, so it carries no contrast duty --
   * which is exactly why it is not the same token as `border`.
   */
  divider: string;
  /** The outline of a real control, which WCAG 1.4.11 holds to 3:1. */
  border: string;
  accent: string;
  /** What is legible on top of `accent`, which differs by theme. */
  accentOn: string;
  /** Behind the sentence being spoken. */
  highlight: string;
  danger: string;
}

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const RADIUS = { sm: 6, md: 10, lg: 14 } as const;
export const FONT = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24 } as const;

/** The least a control may measure, in points, before it is hard to hit. */
export const TAP_TARGET = 44;

export interface Theme {
  name: ThemeName;
  colors: Colors;
  space: typeof SPACE;
  radius: typeof RADIUS;
  font: typeof FONT;
}

const COLORS: Record<ThemeName, Colors> = {
  light: {
    bg: '#ffffff',
    surface: '#f1f5f9',
    text: '#0f172a',
    textMuted: '#475569',
    divider: '#e2e8f0',
    border: '#64748b',
    accent: '#0e7490',
    accentOn: '#ffffff',
    highlight: '#cffafe',
    danger: '#b91c1c',
  },
  paper: {
    bg: '#faf7f0',
    surface: '#f5eee1',
    text: '#1c1917',
    textMuted: '#57534e',
    divider: '#e7dfd0',
    border: '#78716c',
    accent: '#0e7490',
    accentOn: '#ffffff',
    highlight: '#fcecc4',
    danger: '#b91c1c',
  },
  dark: {
    bg: '#121212',
    surface: '#1e1e1e',
    text: '#e7e5e4',
    textMuted: '#a8a29e',
    divider: '#2f2f2f',
    border: '#8a8a8a',
    // Nothing readable on white is readable on black, so the accent is paired
    // rather than shared: #0e7490 is 5.36:1 on white and 3.50:1 here.
    accent: '#67e8f9',
    accentOn: '#0f172a',
    highlight: '#164e63',
    danger: '#fca5a5',
  },
};

export const THEMES: Record<ThemeName, Theme> = {
  light: { name: 'light', colors: COLORS.light, space: SPACE, radius: RADIUS, font: FONT },
  paper: { name: 'paper', colors: COLORS.paper, space: SPACE, radius: RADIUS, font: FONT },
  dark: { name: 'dark', colors: COLORS.dark, space: SPACE, radius: RADIUS, font: FONT },
};

const NAMES: ThemeName[] = ['light', 'paper', 'dark'];

/**
 * Which theme to show, given what was saved and what the phone is doing.
 *
 * A stored name that no longer exists resolves to the system rather than to
 * nothing: a theme dropped in a later version should leave the reader with a
 * working app, not an unstyled one.
 */
export function resolveTheme(
  setting: string | null,
  system: 'light' | 'dark' | null | undefined,
): ThemeName {
  if (setting && (NAMES as string[]).includes(setting)) return setting as ThemeName;
  return system === 'dark' ? 'dark' : 'light';
}

export const FONT_SIZE_RANGE = { min: 14, max: 28, step: 2, default: 18 } as const;

/** Keeps a reading size usable, including when the stored value is nonsense. */
export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return FONT_SIZE_RANGE.default;
  return Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, size));
}
