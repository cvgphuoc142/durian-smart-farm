import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useFormat, usePartLabel } from '@/hooks';
import type { ScanItem } from '@/sync/timeline';
import { colors, spacing } from '@/theme';

import { ScanPhoto } from './ScanPhoto';
import { SyncBadge } from './SyncBadge';

/** One scan in a list or on a case timeline: photo, body part, answer, model and sync state. */
export function ScanRow({ scan, onPress }: { scan: ScanItem; onPress?: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const part = usePartLabel();
  const answer =
    scan.outcome === 'suspected' && scan.label
      ? t('result.suspectedTitle', { label: scan.label })
      : t(`scanResult.${scan.outcome}`);
  const model = scan.model_id ? `${scan.model_id} v${scan.model_version}` : null;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <ScanPhoto uri={scan.photo_uri} />
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {answer}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {[part(scan.plant_part), f.date(scan.captured_at), model].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {scan.sync !== 'synced' ? <SyncBadge state={scan.sync} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 72,
  },
  text: { flex: 1, gap: 2 },
});
