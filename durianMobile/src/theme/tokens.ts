/** Design tokens extracted from the "App quản lý vườn sầu riêng" canvas (390×844 artboards). */

export const colors = {
  bg: '#F2F4EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F8F9F6',
  border: '#DDE3DA',
  borderSoft: '#E4E9E1',
  divider: '#EDF0EA',
  dashed: '#C9D2C6',
  dashedStrong: '#9FB3A6',

  text: '#17241C',
  textSoft: '#3E4B43',
  textMuted: '#55625A',
  placeholder: '#6B776F',
  iconMuted: '#8C9A90',
  trackOff: '#B7C2BA',

  primary: '#1D5B3A',
  primaryDark: '#14432A',
  primarySoft: '#E3EEE6',
  primaryMid: '#3E7A58',
  primaryOnDark: '#CFE3D6',
  primaryOnDarkLink: '#BFE3CC',

  accent: '#E3A82B',
  accentText: '#B07A10',

  danger: '#B3261E',
  dangerStrong: '#A32B22',
  dangerSoft: '#FBE6E3',
  dangerText: '#6B2A24',

  warning: '#8A5A00',
  warningDot: '#D9921A',
  warningSoft: '#FCEFD2',
  warningSoftAlt: '#FBF0D6',
  warningText: '#5C3D00',

  info: '#1F5C99',
  infoSoft: '#E3EDF8',
  infoText: '#173F66',

  brown: '#6B4A22',
  brownSoft: '#EFE7DC',
  purple: '#4F3C7A',
  purpleSoft: '#E9E4F2',

  ink: '#17241C',
  inkSoft: '#2B3A30',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  gutter: 16,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  input: 14,
  card: 16,
  list: 18,
  hero: 20,
  pill: 999,
} as const;

export const touchTarget = 44;

export const sizes = {
  touchTarget,
  chip: 40,
  iconButton: 48,
  button: 52,
  buttonSm: 44,
  input: 50,
  tabItem: 56,
  tabBar: 78,
  scanButton: 62,
  fab: 56,
} as const;

export const fontFamily = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

export type FontWeight = keyof typeof fontFamily;

export interface TextStyleToken {
  fontSize: number;
  lineHeight: number;
  weight: FontWeight;
  letterSpacing?: number;
}

/** Body text is never below 15 (accessibility rule from the brief). */
export const typography = {
  pageTitle: { fontSize: 24, lineHeight: 32, weight: 'bold' },
  title: { fontSize: 19, lineHeight: 26, weight: 'bold' },
  heading: { fontSize: 17, lineHeight: 24, weight: 'bold' },
  cardTitle: { fontSize: 16, lineHeight: 22, weight: 'bold' },
  body: { fontSize: 15, lineHeight: 22, weight: 'regular' },
  bodyStrong: { fontSize: 15, lineHeight: 22, weight: 'semibold' },
  label: { fontSize: 14, lineHeight: 20, weight: 'semibold' },
  secondary: { fontSize: 13, lineHeight: 19, weight: 'regular' },
  caption: { fontSize: 12, lineHeight: 17, weight: 'regular' },
  tabLabel: { fontSize: 11, lineHeight: 14, weight: 'medium' },
  numberLg: { fontSize: 26, lineHeight: 32, weight: 'bold' },
  number: { fontSize: 22, lineHeight: 28, weight: 'bold' },
} as const satisfies Record<string, TextStyleToken>;

export type TextVariant = keyof typeof typography;

export const shadows = {
  fab: {
    shadowColor: '#17241C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  scan: {
    shadowColor: '#1D5B3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  segment: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 1,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  sizes,
  typography,
  fontFamily,
  shadows,
  touchTarget,
} as const;

export type Theme = typeof theme;
