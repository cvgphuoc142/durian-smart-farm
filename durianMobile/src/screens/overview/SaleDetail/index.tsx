import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { saleTone } from '@/components/domain';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  InfoBanner,
  KeyValueGrid,
  ListGroup,
  ListRow,
  Screen,
  Section,
  Text,
} from '@/components/ui';
import { useFormat, useRows } from '@/hooks';
import type { RootStackParamList } from '@/navigation/types';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { spacing } from '@/theme';
import { money } from '@/utils';

/** SC-08: one sale, its payments and what is still owed either way. */
export function SaleDetail() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const { saleId } = useRoute<RouteProp<RootStackParamList, 'SaleDetail'>>().params;
  const sale = useRows('sale').find((s) => s.id === saleId);
  const payments = useRows('sale_payment')
    .filter((p) => p.sale_id === saleId)
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));

  const header = (
    <Header
      title={sale?.buyer_name ?? t('screens.SaleDetail')}
      subtitle={t('screens.SaleDetail')}
      variant="back"
      onBack={() => nav.goBack()}
    />
  );

  if (!sale) {
    return (
      <Screen header={header}>
        <View testID="screen-SaleDetail">
          <EmptyState icon="receipt" title={t('sale.gone')} />
        </View>
      </Screen>
    );
  }

  const balance = money.saleBalance(sale, payments);
  const owedBack = money.isPositive(balance.refundable);

  return (
    <Screen
      header={header}
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button
            grow
            variant="outline"
            label={t('sale.edit')}
            onPress={() => nav.navigate('AddSale', { saleId })}
          />
          <Button
            grow
            icon="plus"
            label={t('sale.addPayment')}
            onPress={() => nav.navigate('AddSale', { saleId, paymentKind: 'receipt' })}
          />
        </View>
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-SaleDetail" style={{ gap: spacing.lg }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="cardTitle" style={{ flex: 1 }}>
              {sale.total_vnd ? f.vnd(sale.total_vnd) : t('sale.noTotal')}
            </Text>
            <Badge label={t(`saleStatus.${sale.status}`)} tone={saleTone[sale.status]} />
          </View>
          <View style={{ height: spacing.sm }} />
          <KeyValueGrid
            items={[
              { label: t('sale.agreedOn'), value: f.date(sale.agreed_on) },
              { label: t('sale.weight'), value: f.kg(sale.weight_kg) },
              { label: t('sale.netReceipts'), value: f.vnd(balance.netReceipts) },
              {
                label: t('sale.owedLabel'),
                value: balance.receivable ? f.vnd(balance.receivable) : t('sale.notAgreed'),
              },
            ]}
          />
          {sale.note ? (
            <Text variant="secondary" color="textMuted" style={{ marginTop: spacing.sm }}>
              {sale.note}
            </Text>
          ) : null}
        </Card>

        {sale.status === 'provisional' ? <InfoBanner text={t('sale.provisionalNote')} /> : null}
        {owedBack ? (
          <InfoBanner
            tone="warning"
            text={t('sale.refundNote', { amount: f.vnd(balance.refundable) })}
          />
        ) : null}

        <Section title={t('sale.payments')} count={payments.length} flush>
          {payments.length === 0 ? (
            <Text variant="secondary" color="textMuted">
              {t('sale.noPayments')}
            </Text>
          ) : (
            <ListGroup>
              {payments.map((p) => (
                <ListRow
                  key={p.id}
                  title={`${t(`paymentKinds.${p.kind}`)} · ${f.vnd(p.amount_vnd)}`}
                  subtitle={`${f.date(p.occurred_on)}${p.note ? ` · ${p.note}` : ''}`}
                  leading={{
                    type: 'tile',
                    icon: p.kind === 'refund' ? 'refresh' : 'download',
                    tone: p.kind === 'refund' ? 'warning' : 'primary',
                  }}
                  chevron
                  onPress={() => nav.navigate('AddSale', { saleId, paymentId: p.id })}
                />
              ))}
            </ListGroup>
          )}
        </Section>
      </View>
    </Screen>
  );
}
