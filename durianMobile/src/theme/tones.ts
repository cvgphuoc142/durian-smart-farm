import { colors } from './tokens';

export type Tone =
  'primary' | 'accent' | 'danger' | 'warning' | 'info' | 'neutral' | 'brown' | 'purple';

export interface ToneStyle {
  /** Soft fill, used for badges and icon tiles. */
  bg: string;
  /** Strong text / icon colour on the soft fill. */
  fg: string;
  /** Saturated colour for dots, bars and timeline markers. */
  dot: string;
}

export const tones: Record<Tone, ToneStyle> = {
  primary: { bg: colors.primarySoft, fg: colors.primary, dot: colors.primary },
  accent: { bg: colors.warningSoft, fg: colors.warning, dot: colors.accent },
  danger: { bg: colors.dangerSoft, fg: colors.danger, dot: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.warning, dot: colors.warningDot },
  info: { bg: colors.infoSoft, fg: colors.info, dot: colors.info },
  neutral: { bg: colors.divider, fg: colors.textMuted, dot: colors.iconMuted },
  brown: { bg: colors.brownSoft, fg: colors.brown, dot: colors.brown },
  purple: { bg: colors.purpleSoft, fg: colors.purple, dot: colors.purple },
};
