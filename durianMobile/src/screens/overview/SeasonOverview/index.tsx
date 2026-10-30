import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ContextPickerSheet } from '@/components/domain';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  Icon,
  InfoBanner,
  KeyValueGrid,
  ListGroup,
  ListRow,
  Screen,
  Section,
  Select,
  StatTile,
  Text,
} from '@/components/ui';
import { useFormat, useScanTimeline, useSeasonData } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { spacing } from '@/theme';
import { money, stageLabel } from '@/utils';

/**
 * SC-03: the season at a glance. Every number is worked out from the rows of the selected season
 * only, and a missing forecast says so instead of showing 0 (FR-A12, A13).
 */
export function SeasonOverview() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const [picking, setPicking] = useState(false);
  const [forecastOpen, setForecastOpen] = useState(false);
  const { farm, plot, season, summary, forecast, expenses, sales } = useSeasonData();
  const { cases } = useScanTimeline();
  const openCases = cases.filter((c) => c.season_id === season?.id && c.closed_at == null).length;

  const provisional = sales.filter((s) => s.status === 'provisional').length;
  const refundable = money.isPositive(summary.refundable);
  const profitNegative = money.parse(summary.profit)?.isNegative() ?? false;
  const noForecast = t('overview.noForecast');

  return (
    <Screen
      withTabBar
      header={<Header title={t('screens.SeasonOverview')} />}
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-SeasonOverview" style={{ gap: spacing.lg }}>
        <Select
          icon="sprout"
          value={season ? `${farm?.name} › ${plot?.name} › ${season.name}` : undefined}
          placeholder={t('context.title')}
          accessibilityLabel={t('context.title')}
          onPress={() => setPicking(true)}
        />

        {!season ? (
          <EmptyState
            icon="sprout"
            title={t('overview.noSeasonTitle')}
            body={t('overview.noSeasonBody')}
            actionLabel={t('screens.FarmManage')}
            onAction={() => nav.navigate('FarmManage')}
          />
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="cardTitle" style={{ flex: 1 }}>
                  {season.name}
                </Text>
                <Badge
                  label={t(season.closed_on ? 'context.closed' : 'context.open')}
                  tone={season.closed_on ? 'neutral' : 'primary'}
                />
              </View>
              <View style={{ height: spacing.sm }} />
              <KeyValueGrid
                items={[
                  { label: t('manage.stage'), value: stageLabel(t, season) },
                  { label: t('manage.startedOn'), value: f.date(season.started_on) },
                  {
                    label: t('manage.expectedHarvest'),
                    value: season.expected_harvest_on
                      ? f.date(season.expected_harvest_on)
                      : f.date(null),
                  },
                  {
                    label: t('manage.closedOn'),
                    value: season.closed_on ? f.date(season.closed_on) : '—',
                  },
                ]}
              />
            </Card>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button
                grow
                size="md"
                icon="plus"
                label={t('overview.addExpense')}
                onPress={() => nav.navigate('AddExpense')}
              />
              <Button
                grow
                size="md"
                variant="outline"
                icon="plus"
                label={t('overview.addSale')}
                onPress={() => nav.navigate('AddSale')}
              />
            </View>

            <Section title={t('overview.recorded')} flush>
              <View style={{ gap: spacing.md }}>
                <StatTile
                  icon="trendingUp"
                  label={t('overview.profit')}
                  value={f.vnd(summary.profit)}
                  hint={t('overview.profitHint')}
                  tone={profitNegative ? 'danger' : 'primary'}
                  emphasize
                />
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <StatTile
                    icon="wallet"
                    label={t('overview.spent')}
                    value={f.vnd(summary.spent)}
                    hint={t('overview.expenseCount', { count: expenses.length })}
                  />
                  <StatTile
                    icon="receipt"
                    label={t('overview.sold')}
                    value={f.vnd(summary.sold)}
                    hint={
                      provisional > 0
                        ? t('overview.provisionalHint', { count: provisional })
                        : t('overview.confirmedOnly')
                    }
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <StatTile
                    icon="download"
                    label={t('overview.netReceived')}
                    value={f.vnd(summary.netReceived)}
                    hint={t('overview.netReceivedHint')}
                  />
                  <StatTile
                    icon="clock"
                    label={t('overview.receivable')}
                    value={f.vnd(summary.receivable)}
                    tone={money.isPositive(summary.receivable) ? 'warning' : 'neutral'}
                  />
                </View>
                {refundable ? (
                  <InfoBanner
                    tone="warning"
                    text={t('overview.refundable', { amount: f.vnd(summary.refundable) })}
                  />
                ) : null}
              </View>
            </Section>

            <Section title={t('overview.forecast')} flush>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: forecastOpen }}
                onPress={() => setForecastOpen((o) => !o)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 }}
              >
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {forecast?.profit
                    ? t('overview.forecastProfit', { amount: f.vnd(forecast.profit) })
                    : t('overview.forecastShort')}
                </Text>
                <Text color="primary">{t(forecastOpen ? 'common.collapse' : 'common.expand')}</Text>
                <Icon name={forecastOpen ? 'chevronUp' : 'chevronDown'} size={20} color="primary" />
              </Pressable>
              {forecastOpen ? (
                <Card variant="dashed">
                  <KeyValueGrid
                    columns={1}
                    items={[
                      {
                        label: t('overview.forecastYield'),
                        value: season.forecast_yield_kg ? f.kg(season.forecast_yield_kg) : noForecast,
                      },
                      {
                        label: t('overview.forecastPrice'),
                        value: season.forecast_price_vnd_kg
                          ? `${f.vnd(season.forecast_price_vnd_kg)}/kg`
                          : noForecast,
                      },
                      {
                        label: t('overview.forecastCost'),
                        value: season.forecast_total_cost_vnd
                          ? f.vnd(season.forecast_total_cost_vnd)
                          : noForecast,
                      },
                    ]}
                  />
                  <View style={{ height: spacing.sm }} />
                  {forecast?.revenue ? (
                    <Text variant="secondary">
                      {t('overview.forecastRevenue', { amount: f.vnd(forecast.revenue) })}
                      {forecast.profit
                        ? `\n${t('overview.forecastProfit', { amount: f.vnd(forecast.profit) })}`
                        : ''}
                    </Text>
                  ) : (
                    <Text variant="secondary" color="textMuted">
                      {t('overview.forecastMissing')}
                    </Text>
                  )}
                  <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                    {t('overview.forecastNote')}
                  </Text>
                  <View style={{ height: spacing.sm }} />
                  <Button
                    size="md"
                    variant="outline"
                    label={t('overview.editForecast')}
                    onPress={() => nav.navigate('FarmManage')}
                  />
                </Card>
              ) : null}
            </Section>

            <ListGroup>
              <ListRow
                title={t('screens.Expenses')}
                subtitle={t('overview.expenseCount', { count: expenses.length })}
                leading={{ type: 'tile', icon: 'wallet', tone: 'primary' }}
                chevron
                onPress={() => nav.navigate('Expenses')}
              />
              <ListRow
                title={t('screens.Sales')}
                subtitle={t('overview.saleCount', { count: sales.length })}
                leading={{ type: 'tile', icon: 'receipt', tone: 'info' }}
                chevron
                onPress={() => nav.navigate('Sales')}
              />
              <ListRow
                title={t('cases.entry')}
                subtitle={openCases > 0 ? t('overview.openCases', { count: openCases }) : undefined}
                leading={{ type: 'tile', icon: 'bug', tone: 'danger' }}
                chevron
                onPress={() => nav.navigate('Cases')}
              />
              <ListRow
                title={t('screens.FarmManage')}
                leading={{ type: 'tile', icon: 'sprout', tone: 'neutral' }}
                chevron
                onPress={() => nav.navigate('FarmManage')}
              />
            </ListGroup>
          </>
        )}
      </View>
      <ContextPickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        selectedSeasonId={season?.id ?? null}
      />
    </Screen>
  );
}
