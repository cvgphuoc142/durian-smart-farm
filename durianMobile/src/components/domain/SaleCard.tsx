import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Card, Text } from '@/components/ui';
import { useFormat } from '@/hooks';
import { spacing } from '@/theme';
import type { Sale, SalePayment, SaleStatus } from '@/types';
import { money } from '@/utils';

export const saleTone = {
  provisional: 'warning',
  confirmed: 'primary',
  cancelled: 'neutral',
} as const;

/** One sale with what was received and what is still owed. Provisional = no agreed total yet. */
export function SaleCard({
  sale,
  payments,
  onPress,
}: {
  sale: Sale;
  payments: readonly SalePayment[];
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const balance = money.saleBalance(sale, payments);
  const status: SaleStatus = sale.status;

  return (
    <Card onPress={onPress} accessibilityLabel={sale.buyer_name}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="cardTitle" style={{ flex: 1 }} numberOfLines={1}>
          {sale.buyer_name}
        </Text>
        <Badge label={t(`saleStatus.${status}`)} tone={saleTone[status]} />
      </View>
      <Text variant="secondary" color="textMuted">
        {f.date(sale.agreed_on)}
        {sale.weight_kg ? ` · ${f.kg(sale.weight_kg)}` : ''}
      </Text>
      <View style={{ height: spacing.sm }} />
      <Text variant="bodyStrong">{sale.total_vnd ? f.vnd(sale.total_vnd) : t('sale.noTotal')}</Text>
      <Text variant="secondary" color="textMuted">
        {t('sale.received', { amount: f.vnd(balance.netReceipts) })}
        {balance.receivable && money.isPositive(balance.receivable)
          ? ` · ${t('sale.owed', { amount: f.vnd(balance.receivable) })}`
          : ''}
        {money.isPositive(balance.refundable)
          ? ` · ${t('sale.refundDue', { amount: f.vnd(balance.refundable) })}`
          : ''}
      </Text>
    </Card>
  );
}
