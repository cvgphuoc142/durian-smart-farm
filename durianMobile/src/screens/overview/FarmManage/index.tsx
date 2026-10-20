import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { remove, upsert } from '@/api';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Header,
  ListGroup,
  ListRow,
  Screen,
  Text,
} from '@/components/ui';
import { live, useFormat, useSnapshot, useWrite } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useContextStore } from '@/stores';
import { spacing } from '@/theme';
import type { Farm, Plot, Season } from '@/types';
import { today } from '@/utils';

import { FarmSheet, PlotSheet, SeasonSheet } from './sheets';

type Sheet =
  | { type: 'farm'; farm?: Farm }
  | { type: 'plot'; farmId: string; plot?: Plot }
  | { type: 'season'; plotId: string; season?: Season };

type Confirm =
  | { type: 'close'; season: Season }
  | { type: 'delete'; entity: 'farm'; row: Farm }
  | { type: 'delete'; entity: 'plot'; row: Plot }
  | { type: 'delete'; entity: 'season'; row: Season };

/**
 * SC-04: farms, plots and seasons. One open season per plot; a season is closed by the farmer.
 * Deleting something that still has data inside is refused by the server and said so here.
 */
export function FarmManage() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const { data } = useSnapshot();
  const farms = live(data.farms);
  const plots = live(data.plots);
  const seasons = live(data.seasons);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const write = useWrite();

  const run = () => {
    if (!confirm) return;
    if (confirm.type === 'close') {
      write.mutate([
        upsert('season', confirm.season.id, { closed_on: today() }, confirm.season.revision),
      ]);
    } else {
      write.mutate([remove(confirm.entity, confirm.row.id, confirm.row.revision)]);
    }
    setConfirm(null);
  };

  const pick = (farm: Farm, plot: Plot, season: Season) => {
    useContextStore.getState().select({ farmId: farm.id, plotId: plot.id, seasonId: season.id });
    nav.goBack();
  };

  return (
    <Screen
      header={<Header title={t('screens.FarmManage')} variant="back" onBack={() => nav.goBack()} />}
      footer={
        <Button
          label={t('manage.addFarm')}
          icon="plus"
          onPress={() => setSheet({ type: 'farm' })}
        />
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-FarmManage" style={{ gap: spacing.lg }}>
        {farms.length === 0 ? <EmptyState icon="sprout" title={t('manage.empty')} /> : null}
        {farms.map((farm) => {
          const farmPlots = plots.filter((p) => p.farm_id === farm.id);
          return (
            <Card key={farm.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text variant="cardTitle">{farm.name}</Text>
                  {farm.province ? (
                    <Text variant="secondary" color="textMuted">
                      {farm.province}
                    </Text>
                  ) : null}
                </View>
                <Button
                  size="md"
                  variant="ghost"
                  label={t('common.edit')}
                  onPress={() => setSheet({ type: 'farm', farm })}
                />
              </View>

              {farmPlots.map((plot) => {
                const plotSeasons = seasons
                  .filter((s) => s.plot_id === plot.id)
                  .sort((a, b) => b.started_on.localeCompare(a.started_on));
                const hasOpen = plotSeasons.some((s) => !s.closed_on);
                return (
                  <View key={plot.id} style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        {t('context.plot')} {plot.name}
                        {plot.area_ha ? ` · ${plot.area_ha} ha` : ''}
                      </Text>
                      <Button
                        size="md"
                        variant="ghost"
                        label={t('common.edit')}
                        onPress={() => setSheet({ type: 'plot', farmId: farm.id, plot })}
                      />
                    </View>
                    {plotSeasons.length > 0 ? (
                      <ListGroup>
                        {plotSeasons.map((season) => (
                          <ListRow
                            key={season.id}
                            title={season.name}
                            subtitle={`${t(`stages.${season.stage}`)} · ${f.date(season.started_on)}`}
                            trailing={
                              <Badge
                                label={t(season.closed_on ? 'context.closed' : 'context.open')}
                                tone={season.closed_on ? 'neutral' : 'primary'}
                              />
                            }
                            onPress={() => pick(farm, plot, season)}
                          />
                        ))}
                      </ListGroup>
                    ) : (
                      <Text variant="secondary" color="textMuted">
                        {t('context.none')}
                      </Text>
                    )}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {plotSeasons
                        .filter((s) => !s.closed_on)
                        .map((s) => (
                          <View key={s.id} style={{ flexDirection: 'row', gap: spacing.sm }}>
                            <Button
                              size="md"
                              variant="outline"
                              label={t('manage.editSeason')}
                              onPress={() =>
                                setSheet({ type: 'season', plotId: plot.id, season: s })
                              }
                            />
                            <Button
                              size="md"
                              variant="outline"
                              label={t('manage.closeSeason')}
                              onPress={() => setConfirm({ type: 'close', season: s })}
                            />
                          </View>
                        ))}
                      {!hasOpen ? (
                        <Button
                          size="md"
                          icon="plus"
                          label={t('manage.addSeason')}
                          onPress={() => setSheet({ type: 'season', plotId: plot.id })}
                        />
                      ) : null}
                      {plotSeasons.length === 0 ? (
                        <Button
                          size="md"
                          variant="ghost"
                          label={t('common.delete')}
                          onPress={() => setConfirm({ type: 'delete', entity: 'plot', row: plot })}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                <Button
                  size="md"
                  variant="outline"
                  icon="plus"
                  label={t('manage.addPlot')}
                  onPress={() => setSheet({ type: 'plot', farmId: farm.id })}
                />
                {farmPlots.length === 0 ? (
                  <Button
                    size="md"
                    variant="ghost"
                    label={t('common.delete')}
                    onPress={() => setConfirm({ type: 'delete', entity: 'farm', row: farm })}
                  />
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>

      {sheet?.type === 'farm' ? (
        <FarmSheet farm={sheet.farm} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.type === 'plot' ? (
        <PlotSheet farmId={sheet.farmId} plot={sheet.plot} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.type === 'season' ? (
        <SeasonSheet plotId={sheet.plotId} season={sheet.season} onClose={() => setSheet(null)} />
      ) : null}

      <ConfirmDialog
        visible={confirm != null}
        destructive={confirm?.type === 'delete'}
        title={confirm?.type === 'close' ? t('manage.closeTitle') : t('manage.deleteTitle')}
        message={confirm?.type === 'close' ? t('manage.closeBody') : t('manage.deleteBody')}
        confirmLabel={confirm?.type === 'close' ? t('manage.closeSeason') : t('common.delete')}
        onCancel={() => setConfirm(null)}
        onConfirm={run}
      />
    </Screen>
  );
}
