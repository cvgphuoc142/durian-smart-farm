import { useTranslation } from 'react-i18next';

import { Badge, ListRow } from '@/components/ui';
import { useFormat } from '@/hooks';
import type { CareLog, Expense } from '@/types';

/** One care entry: kind, date, the inputs used, and a badge when it carries a cost or a case. */
export function CareLogRow({
  log,
  expense,
  onPress,
}: {
  log: CareLog;
  expense?: Expense;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const inputs = log.inputs.map((i) => i.product_name).join(', ');
  return (
    <ListRow
      title={`${t(`careKinds.${log.kind}`)} · ${f.date(log.occurred_on)}`}
      subtitle={
        [log.case_id ? t('care.caseTreatment') : null, inputs, log.note].filter(Boolean).join(' · ') ||
        undefined
      }
      leading={{
        type: 'tile',
        icon: log.case_id ? 'bug' : 'leaf',
        tone: log.case_id ? 'danger' : 'primary',
      }}
      trailing={expense ? <Badge label={f.vnd(expense.amount_vnd)} tone="info" /> : undefined}
      chevron
      onPress={onPress}
    />
  );
}
