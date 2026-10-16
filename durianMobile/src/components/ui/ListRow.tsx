import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, tones, type Tone } from '@/theme';

import { Card } from './Card';
import { Divider } from './Divider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type RowLeading = { type: 'dot'; tone: Tone } | { type: 'tile'; icon: IconName; tone: Tone };

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: RowLeading;
  /** Replaces the chevron, e.g. a Badge or a value. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Show a chevron when pressable. Defaults to true if `onPress` is set. */
  chevron?: boolean;
}

export function ListRow({ title, subtitle, leading, trailing, onPress, chevron }: ListRowProps) {
  const showChevron = trailing == null && (chevron ?? onPress != null);
  const content = (
    <>
      {leading?.type === 'dot' ? (
        <View style={[styles.dot, { backgroundColor: tones[leading.tone].dot }]} />
      ) : null}
      {leading?.type === 'tile' ? (
        <View style={[styles.tile, { backgroundColor: tones[leading.tone].bg }]}>
          <Icon name={leading.icon} size={22} color={tones[leading.tone].fg} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="chevronRight" size={20} color="iconMuted" /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** One white card holding several rows separated by dividers. */
export function ListGroup({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <Card padding={0}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <Divider /> : null}
          {child}
        </Fragment>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.md,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  text: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
