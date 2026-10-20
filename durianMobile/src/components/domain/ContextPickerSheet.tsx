import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet, Badge, Icon, ListGroup, ListRow, Text } from '@/components/ui';
import { live, useSnapshot } from '@/hooks';
import { useContextStore } from '@/stores';
import { spacing } from '@/theme';

/**
 * Farm › plot › season picker (FR-A03). Seasons are listed under their plot and farm; picking one
 * sets all three, and every total on the screens that follow is limited to that season.
 */
export function ContextPickerSheet({
  visible,
  onClose,
  selectedSeasonId,
}: {
  visible: boolean;
  onClose: () => void;
  selectedSeasonId: string | null;
}) {
  const { t } = useTranslation();
  const { data } = useSnapshot();
  const farms = live(data.farms);
  const plots = live(data.plots);
  const seasons = live(data.seasons);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('context.title')}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {farms.map((farm) => (
          <View key={farm.id} style={styles.farm}>
            <Text variant="bodyStrong">{farm.name}</Text>
            {plots
              .filter((p) => p.farm_id === farm.id)
              .map((plot) => {
                const plotSeasons = seasons
                  .filter((s) => s.plot_id === plot.id)
                  .sort((a, b) => b.started_on.localeCompare(a.started_on));
                return (
                  <View key={plot.id} style={styles.plot}>
                    <Text variant="secondary" color="textMuted">
                      {t('context.plot')} {plot.name}
                    </Text>
                    {plotSeasons.length === 0 ? (
                      <Text variant="caption" color="textMuted">
                        {t('context.none')}
                      </Text>
                    ) : (
                      <ListGroup>
                        {plotSeasons.map((season) => (
                          <ListRow
                            key={season.id}
                            title={season.name}
                            subtitle={t(`stages.${season.stage}`)}
                            trailing={
                              season.id === selectedSeasonId ? (
                                <Icon name="check" size={20} color="primary" />
                              ) : (
                                <Badge
                                  label={t(season.closed_on ? 'context.closed' : 'context.open')}
                                  tone={season.closed_on ? 'neutral' : 'primary'}
                                />
                              )
                            }
                            onPress={() => {
                              useContextStore
                                .getState()
                                .select({ farmId: farm.id, plotId: plot.id, seasonId: season.id });
                              onClose();
                            }}
                          />
                        ))}
                      </ListGroup>
                    )}
                  </View>
                );
              })}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 480 },
  farm: { gap: spacing.sm, marginBottom: spacing.lg },
  plot: { gap: spacing.xs },
});
