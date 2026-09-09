import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  THEMES,
  clampFontSize,
  resolveTheme,
  FONT_SIZE_RANGE,
  type Theme,
  type ThemeSetting,
} from './theme';
import { getSetting, setSetting, SETTING_THEME, SETTING_FONT_SIZE } from '../db/settings';

interface ThemeContextValue {
  theme: Theme;
  setting: ThemeSetting;
  chooseTheme(next: ThemeSetting): void;
  fontSize: number;
  setFontSize(next: number): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Holds the reader's appearance: which theme, and how large the text is.
 *
 * Both are read once on mount and written when changed. A row that is missing
 * or unreadable falls back to its default rather than blocking the screen --
 * an unstyled app is a worse answer than a light one.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [setting, setSettingState] = useState<ThemeSetting>('system');
  const [fontSize, setFontSizeState] = useState<number>(FONT_SIZE_RANGE.default);

  useEffect(() => {
    getSetting(SETTING_THEME).then(
      (stored) => setSettingState((stored as ThemeSetting) ?? 'system'),
      () => undefined,
    );
    getSetting(SETTING_FONT_SIZE).then(
      (stored) => setFontSizeState(clampFontSize(Number(stored))),
      () => undefined,
    );
  }, []);

  const chooseTheme = useCallback((next: ThemeSetting) => {
    setSettingState(next);
    void setSetting(SETTING_THEME, next).catch(() => undefined);
  }, []);

  const setFontSize = useCallback((next: number) => {
    const size = clampFontSize(next);
    setFontSizeState(size);
    void setSetting(SETTING_FONT_SIZE, String(size)).catch(() => undefined);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: THEMES[resolveTheme(setting === 'system' ? null : setting, system)],
      setting,
      chooseTheme,
      fontSize,
      setFontSize,
    }),
    [setting, system, fontSize, chooseTheme, setFontSize],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const found = useContext(ThemeContext);
  // A screen rendered outside the provider would otherwise fail later and
  // further away, on a colour that happens to be undefined.
  if (!found) throw new Error('useTheme was called outside ThemeProvider.');
  return found;
}

export const useTheme = (): Theme => useThemeContext().theme;

export const useThemeSetting = () => {
  const { setting, chooseTheme } = useThemeContext();
  return { setting, setSetting: chooseTheme };
};

export const useFontSize = () => {
  const { fontSize, setFontSize } = useThemeContext();
  return { fontSize, setFontSize };
};
