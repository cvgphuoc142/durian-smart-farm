import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Checkbox, Text } from '@/components/ui';
import { useFormat } from '@/hooks';
import { spacing } from '@/theme';
import type { StandardItem } from '@/types';

/** One checklist item: the farmer's own tick, the text, and where it comes from (FR-D02). */
export function StandardItemRow({
  item,
  checked,
  disabled,
  onToggle,
  onOpenSource,
}: {
  item: StandardItem;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onOpenSource: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <View style={styles.row}>
      <Checkbox
        checked={checked}
        onToggle={disabled ? undefined : onToggle}
        accessibilityLabel={t('standards.tick', { title: item.title })}
      />
      <View style={styles.body}>
        <Text variant="bodyStrong">{item.title}</Text>
        {item.body ? (
          <Text variant="secondary" color="textMuted">
            {item.body}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {t('standards.sourceChecked', { date: f.day(item.source_checked_at) })}
        </Text>
        <Button
          size="md"
          variant="ghost"
          icon="globe"
          label={t('standards.openSource')}
          onPress={onOpenSource}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  body: { flex: 1, gap: 2, alignItems: 'flex-start' },
});
