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

/**
 * Corners are large on purpose. A card at 6px reads as a box with a border;
 * the same card at 24px reads as an object, which is most of why a modern
 * player feels different from a form.
 */
export const RADIUS = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const FONT = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  /** Screen titles, which are set large and heavy rather than small and grey. */
  display: 32,
} as const;

/** The play control, which is the largest thing on the player and meant to be. */
export const PLAY_SIZE = 68;

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
    surface: '#f4f4f6',
    text: '#0f0f14',
    textMuted: '#52525b',
    divider: '#e6e6ea',
    border: '#6b6b76',
    accent: '#4f46e5',
    accentOn: '#ffffff',
    highlight: '#dfe0fb',
    danger: '#b91c1c',
  },
  paper: {
    bg: '#faf7f0',
    surface: '#f2ece0',
    text: '#1c1917',
    textMuted: '#57534e',
    divider: '#e7dfd0',
    border: '#78716c',
    accent: '#4f46e5',
    accentOn: '#ffffff',
    // Warm, because a cream page with a blue highlight looks like a mistake.
    highlight: '#fde68a',
    danger: '#b91c1c',
  },
  dark: {
    // Near black rather than grey: it makes the accent and the page glow, and
    // it is what a reading app is actually used against at night.
    bg: '#0d0d0f',
    surface: '#1c1c20',
    text: '#f4f4f5',
    textMuted: '#a1a1aa',
    divider: '#27272c',
    border: '#83838f',
    // Indigo cannot survive on near-black -- #4f46e5 is 3.09:1 there -- so the
    // dark theme takes the pale end of the same family instead.
    accent: '#a5b4fc',
    accentOn: '#0d0d0f',
    highlight: '#312e81',
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
  /**
   * Widened past 'light' | 'dark' on purpose: React Native reports
   * 'unspecified' on some platforms, and a phone that will not say what it
   * prefers should still get a readable app rather than a type error.
   */
  system: string | null | undefined,
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
