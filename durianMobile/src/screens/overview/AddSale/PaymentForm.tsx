import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { newId, remove, upsert } from '@/api';
import { FormScreen } from '@/components/domain';
import {
  Button,
  Card,
  ConfirmDialog,
  ControlledChipSelect,
  ControlledDatePicker,
  ControlledMoneyInput,
  ControlledTextInput,
  EmptyState,
  KeyValueGrid,
} from '@/components/ui';
import { useFormat, useFormDraft, useRows, useWrite } from '@/hooks';
import { useCloseAfterSave } from '@/hooks/useSavedNavigation';
import { useUnsavedChangesGuard } from '@/navigation/useUnsavedChangesGuard';
import { draftKey } from '@/stores';
import { PAYMENT_KINDS, type PaymentKind, type SalePayment } from '@/types';
import { fromDateString, money, orNull, toDateString } from '@/utils';
import { positiveAmount } from '@/utils/schema';

/**
 * Deposit, receipt or refund on a sale. A refund can never exceed deposit + receipt, and the form
 * shows the owed/refundable result before saving (FR-A16). Closed seasons still take payments.
 */
export function PaymentForm({
  saleId,
  paymentId,
  initialKind,
}: {
  saleId: string;
  paymentId?: string;
  initialKind?: PaymentKind;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const sale = useRows('sale').find((s) => s.id === saleId);
  const all = useRows('sale_payment').filter((p) => p.sale_id === saleId);
  const editing = all.find((p) => p.id === paymentId) ?? null;
  const others = all.filter((p) => p.id !== editing?.id);
  const newPaymentId = useRef(newId()).current;
  const id = editing?.id ?? newPaymentId;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const close = useCloseAfterSave();

  const schema = z
    .object({
      kind: z.enum(PAYMENT_KINDS),
      occurredOn: z.date(),
      amount: positiveAmount(t),
      note: z.string().trim(),
    })
    .refine(
      (v) =>
        v.kind !== 'refund' ||
        !money.isPositive(v.amount) ||
        money.refundAllowed(others, money.normalizeVnd(v.amount) ?? '0'),
      {
        path: ['amount'],
        message: t('errors.refund_exceeds_received'),
      },
    );
  type Values = z.infer<typeof schema>;

  const fromRow = (p: SalePayment): Values => ({
    kind: p.kind,
    occurredOn: fromDateString(p.occurred_on),
    amount: p.amount_vnd,
    note: p.note ?? '',
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? fromRow(editing)
      : { kind: initialKind ?? 'receipt', occurredOn: new Date(), amount: '', note: '' },
  });
  const draft = useFormDraft(draftKey('payment', editing?.id ?? saleId), form);
  useUnsavedChangesGuard(form.formState.isDirty && !close.saved);

  const write = useWrite({
    onSuccess: () => {
      draft.clear();
      close.markSaved();
    },
    onConflict: (rows) => {
      const row = rows.find((r) => r.entity === 'sale_payment' && r.row.id === id)?.row as
        SalePayment | undefined;
      if (row && !row.deleted_at) form.reset(fromRow(row));
      setConflicted(true);
    },
  });

  const submit = form.handleSubmit((v) => {
    const data = {
      kind: v.kind,
      occurred_on: toDateString(v.occurredOn),
      amount_vnd: money.normalizeVnd(v.amount) ?? v.amount,
      note: orNull(v.note),
    };
    write.mutate([
      editing
        ? upsert('sale_payment', id, data, editing.revision)
        : upsert('sale_payment', id, { ...data, sale_id: saleId }, null),
    ]);
  });

  const [kind, amount] = form.watch(['kind', 'amount']);
  if (!sale) {
    return (
      <FormScreen name="AddSale" title={t('sale.addPayment')} onSave={() => close.markSaved()}>
        <EmptyState icon="receipt" title={t('sale.gone')} />
      </FormScreen>
    );
  }
  const next = money.isPositive(amount)
    ? [...others, { kind, amount_vnd: money.normalizeVnd(amount) ?? '0' }]
    : others;
  const impact = money.saleBalance(sale, next);

  return (
    <FormScreen
      name="AddSale"
      title={editing ? t('sale.editPayment') : t('sale.addPayment')}
      subtitle={sale.buyer_name}
      saving={write.isPending}
      onSave={submit}
      conflict={conflicted}
      secondary={
        editing ? (
          <Button
            variant="ghost"
            label={t('common.delete')}
            onPress={() => setConfirmDelete(true)}
          />
        ) : undefined
      }
    >
      <ControlledChipSelect
        control={form.control}
        name="kind"
        label={t('sale.paymentKind')}
        required
        options={PAYMENT_KINDS.map((id) => ({ id, label: t(`paymentKinds.${id}`) }))}
      />
      <ControlledDatePicker
        control={form.control}
        name="occurredOn"
        label={t('form.date')}
        required
      />
      <ControlledMoneyInput
        control={form.control}
        name="amount"
        label={t('expense.amount')}
        required
        hint={
          kind === 'refund'
            ? t('sale.refundLimit', {
                amount: f.vnd(money.saleBalance(sale, others).refundableLimit),
              })
            : undefined
        }
      />
      <ControlledTextInput control={form.control} name="note" label={t('form.note')} multiline />

      <Card variant="info">
        <KeyValueGrid
          items={[
            { label: t('sale.netReceipts'), value: f.vnd(impact.netReceipts) },
            {
              label: t('sale.owedLabel'),
              value: impact.receivable ? f.vnd(impact.receivable) : t('sale.notAgreed'),
            },
            { label: t('sale.refundLabel'), value: f.vnd(impact.refundable) },
          ]}
        />
      </Card>

      <ConfirmDialog
        visible={confirmDelete}
        destructive
        title={t('sale.deletePaymentTitle')}
        message={t('sale.deletePaymentBody')}
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (editing) write.mutate([remove('sale_payment', editing.id, editing.revision)]);
        }}
      />
    </FormScreen>
  );
}
