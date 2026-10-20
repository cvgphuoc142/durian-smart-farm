import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SaleCard } from '@/components/domain';
import {
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Header,
  InfoBanner,
  Screen,
  Text,
} from '@/components/ui';
import { useFormat, useSeasonData } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { spacing } from '@/theme';
import { SALE_STATUSES, type SaleStatus } from '@/types';
import { money } from '@/utils';

/** SC-07: sales of the season with the money still owed. Cash is netted per sale, never across buyers. */
export function Sales() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const { season, sales, payments, summary } = useSeasonData();
  const [status, setStatus] = useState<SaleStatus | null>(null);

  const shown = sales
    .filter((s) => !status || s.status === status)
    .sort((a, b) => b.agreed_on.localeCompare(a.agreed_on));

  return (
    <Screen
      header={
        <Header
          title={t('screens.Sales')}
          subtitle={season?.name}
          variant="back"
          onBack={() => nav.goBack()}
        />
      }
      footer={<Button label={t('sale.add')} icon="plus" onPress={() => nav.navigate('AddSale')} />}
    >
      <View testID="screen-Sales" style={{ gap: spacing.md }}>
        <ChipRow>
          <Chip label={t('common.all')} selected={!status} onPress={() => setStatus(null)} />
          {SALE_STATUSES.map((s) => (
            <Chip
              key={s}
              label={t(`saleStatus.${s}`)}
              selected={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
        </ChipRow>
        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          <Text variant="bodyStrong">
            {t('sale.summary', {
              received: f.vnd(summary.netReceived),
              owed: f.vnd(summary.receivable),
            })}
          </Text>
          {money.isPositive(summary.refundable) ? (
            <InfoBanner
              tone="warning"
              text={t('overview.refundable', { amount: f.vnd(summary.refundable) })}
            />
          ) : null}
          {shown.length === 0 ? (
            <EmptyState
              icon="receipt"
              title={t('sale.emptyTitle')}
              body={t('sale.emptyBody')}
              actionLabel={t('sale.add')}
              onAction={() => nav.navigate('AddSale')}
            />
          ) : (
            shown.map((s) => (
              <SaleCard
                key={s.id}
                sale={s}
                payments={payments.filter((p) => p.sale_id === s.id)}
                onPress={() => nav.navigate('SaleDetail', { saleId: s.id })}
              />
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}
