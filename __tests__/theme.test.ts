import { describe, expect, it } from 'vitest';
import { THEMES, resolveTheme, clampFontSize, FONT_SIZE_RANGE } from '../src/ui/theme';

/**
 * The test brings its own contrast maths rather than importing the app's.
 * A single shared implementation would let one bug excuse the other: if the
 * ratio were computed wrongly, both the palette and its check would agree.
 */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Foreground, background, and the ratio WCAG requires of that pairing. */
const PAIRS: Array<[keyof typeof THEMES.light.colors, keyof typeof THEMES.light.colors, number]> = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'highlight', 4.5],
  ['textMuted', 'bg', 4.5],
  ['textMuted', 'surface', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['accentOn', 'accent', 4.5],
  ['danger', 'bg', 4.5],
  // Not text: the outline of a control, which WCAG 1.4.11 holds to 3:1.
  ['border', 'bg', 3],
  ['border', 'surface', 3],
];

describe('theme contrast', () => {
  for (const name of Object.keys(THEMES) as Array<keyof typeof THEMES>) {
    for (const [fg, bg, least] of PAIRS) {
      it(`${name}: ${fg} on ${bg} is readable`, () => {
        const { colors } = THEMES[name];
        expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(least);
      });
    }
  }

  it('gives every theme the full set of colours', () => {
    const expected = Object.keys(THEMES.light.colors).sort();
    for (const theme of Object.values(THEMES)) {
      expect(Object.keys(theme.colors).sort()).toEqual(expected);
    }
  });

  it('pairs the accent per theme rather than reusing one everywhere', () => {
    // The point of the pairing: what reads on white does not read on black.
    expect(THEMES.dark.colors.accent).not.toBe(THEMES.light.colors.accent);
  });
});

describe('resolveTheme', () => {
  it('follows the system when nothing has been chosen', () => {
    expect(resolveTheme(null, 'dark')).toBe('dark');
    expect(resolveTheme(null, 'light')).toBe('light');
  });

  it('honours an explicit choice over the system', () => {
    expect(resolveTheme('paper', 'dark')).toBe('paper');
  });

  it('treats an unknown stored value as no choice at all', () => {
    // A theme removed in a later version must not leave the app unstyled.
    expect(resolveTheme('midnight', 'dark')).toBe('dark');
  });

  it('falls back to light when the system reports nothing', () => {
    expect(resolveTheme('system', null)).toBe('light');
    expect(resolveTheme(null, undefined)).toBe('light');
    // React Native says this on platforms with no preference to report.
    expect(resolveTheme(null, 'unspecified')).toBe('light');
  });
});

describe('clampFontSize', () => {
  it('keeps a size inside the range', () => {
    expect(clampFontSize(10)).toBe(FONT_SIZE_RANGE.min);
    expect(clampFontSize(40)).toBe(FONT_SIZE_RANGE.max);
    expect(clampFontSize(20)).toBe(20);
  });

  it('survives a corrupt stored value', () => {
    expect(clampFontSize(Number.NaN)).toBe(FONT_SIZE_RANGE.default);
  });
});
