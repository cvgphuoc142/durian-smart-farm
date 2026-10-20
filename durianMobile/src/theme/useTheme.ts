import { theme, type Theme } from './tokens';

/** Light theme only for the MVP; kept as a hook so a dark theme can be added later. */
export function useTheme(): Theme {
  return theme;
}
