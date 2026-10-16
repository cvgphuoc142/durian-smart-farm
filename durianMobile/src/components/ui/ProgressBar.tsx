import { StyleSheet, View } from 'react-native';

import { colors, tones, type Tone } from '@/theme';

export interface ProgressBarProps {
  /** 0–1 */
  ratio: number;
  tone?: Tone;
  height?: number;
  /** Raw fill colour; overrides `tone`. */
  color?: string;
  trackColor?: string;
}

export function ProgressBar({
  ratio,
  tone = 'primary',
  height = 8,
  color,
  trackColor = colors.divider,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? tones[tone].dot,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
});
