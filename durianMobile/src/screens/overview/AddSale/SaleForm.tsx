import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
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
  InfoBanner,
  KeyValueGrid,
} from '@/components/ui';
import { useFormat, useFormDraft, useRows, useSelection, useWrite } from '@/hooks';
import { useCloseAfterSave } from '@/hooks/useSavedNavigation';
import { useUnsavedChangesGuard } from '@/navigation/useUnsavedChangesGuard';
import { draftKey } from '@/stores';
import { spacing } from '@/theme';
import { SALE_STATUSES, type Sale } from '@/types';
import { fromDateString, money, orNull, toDateString } from '@/utils';
import { optionalNumber, requiredText } from '@/utils/schema';

/**
 * A sale. Provisional needs no total; confirmed needs one. A deposit typed on a new sale is saved
 * as its first payment in the same mutation, so the sale never exists without it (FR-A15, A16).
 */
export function SaleForm({ saleId }: { saleId?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { season } = useSelection();
  const sales = useRows('sale');
  const allPayments = useRows('sale_payment');
  const editing = sales.find((s) => s.id === saleId) ?? null;
  const payments = allPayments.filter((p) => p.sale_id === editing?.id);
  const ids = useRef({ sale: newId(), deposit: newId() }).current;
  const id = editing?.id ?? ids.sale;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const close = useCloseAfterSave();

  const schema = z
    .object({
      buyer: requiredText(t),
      agreedOn: z.date(),
      status: z.enum(SALE_STATUSES),
      total: optionalNumber(t),
      weight: optionalNumber(t),
      deposit: optionalNumber(t),
      note: z.string().trim(),
    })
    .refine((v) => v.status !== 'confirmed' || v.total !== '', {
      path: ['total'],
      message: t('errors.total_required'),
    });
  type Values = z.infer<typeof schema>;

  const fromRow = (s: Sale): Values => ({
    buyer: s.buyer_name,
    agreedOn: fromDateString(s.agreed_on),
    status: s.status,
    total: s.total_vnd ?? '',
    weight: s.weight_kg ?? '',
    deposit: '',
    note: s.note ?? '',
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? fromRow(editing)
      : {
          buyer: '',
          agreedOn: new Date(),
          status: 'provisional',
          total: '',
          weight: '',
          deposit: '',
          note: '',
        },
  });
  const draft = useFormDraft(draftKey('sale', editing?.id), form);
  useUnsavedChangesGuard(form.formState.isDirty && !close.saved);

  const write = useWrite({
    onSuccess: () => {
      draft.clear();
      close.markSaved();
    },
    onConflict: (rows) => {
      const row = rows.find((r) => r.entity === 'sale' && r.row.id === id)?.row as Sale | undefined;
      if (row && !row.deleted_at) form.reset(fromRow(row));
      setConflicted(true);
    },
  });

  const submit = form.handleSubmit((v) => {
    if (!season) return;
    const data = {
      buyer_name: v.buyer.trim(),
      agreed_on: toDateString(v.agreedOn),
      status: v.status,
      total_vnd: money.normalizeVnd(v.total),
      weight_kg: money.normalizeKg(v.weight),
      note: orNull(v.note),
    };
    if (editing) {
      write.mutate([upsert('sale', id, data, editing.revision)]);
      return;
    }
    const deposit = money.isPositive(v.deposit) ? money.normalizeVnd(v.deposit) : null;
    write.mutate([
      upsert('sale', id, { ...data, season_id: season.id }, null),
      ...(deposit
        ? [
            upsert(
              'sale_payment',
              ids.deposit,
              {
                sale_id: id,
                kind: 'deposit' as const,
                occurred_on: data.agreed_on,
                amount_vnd: deposit,
              },
              null,
            ),
          ]
        : []),
    ]);
  });

  // Impact of what is typed, before it is saved.
  const [status, total, deposit] = form.watch(['status', 'total', 'deposit']);
  const hypothetical = [
    ...payments,
    ...(!editing && money.isPositive(deposit)
      ? [{ kind: 'deposit' as const, amount_vnd: money.normalizeVnd(deposit) ?? '0' }]
      : []),
  ];
  const impact = money.saleBalance({ status, total_vnd: money.normalizeVnd(total) }, hypothetical);

  return (
    <FormScreen
      name="AddSale"
      title={editing ? t('sale.edit') : t('sale.add')}
      subtitle={season?.name}
      saving={write.isPending}
      onSave={submit}
      conflict={conflicted}
      secondary={
        editing && payments.length === 0 ? (
          <Button
            variant="ghost"
            label={t('common.delete')}
            onPress={() => setConfirmDelete(true)}
          />
        ) : undefined
      }
    >
      <ControlledTextInput control={form.control} name="buyer" label={t('sale.buyer')} required />
      <ControlledDatePicker
        control={form.control}
        name="agreedOn"
        label={t('sale.agreedOn')}
        required
      />
      <ControlledChipSelect
        control={form.control}
        name="status"
        label={t('sale.status')}
        required
        options={SALE_STATUSES.filter((s) => editing || s !== 'cancelled').map((id) => ({
          id,
          label: t(`saleStatus.${id}`),
        }))}
      />
      {status === 'provisional' ? (
        <View style={{ marginBottom: spacing.lg }}>
          <InfoBanner text={t('sale.provisionalNote')} />
        </View>
      ) : null}
      {status === 'cancelled' ? (
        <View style={{ marginBottom: spacing.lg }}>
          <InfoBanner tone="warning" text={t('sale.cancelNote')} />
        </View>
      ) : null}
      <ControlledMoneyInput
        control={form.control}
        name="total"
        label={t('sale.total')}
        required={status === 'confirmed'}
      />
      <ControlledTextInput
        control={form.control}
        name="weight"
        label={t('sale.weight')}
        keyboardType="decimal-pad"
        suffix="kg"
      />
      {!editing ? (
        <ControlledMoneyInput
          control={form.control}
          name="deposit"
          label={t('sale.deposit')}
          hint={t('sale.depositHint')}
        />
      ) : null}
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
        title={t('sale.deleteTitle')}
        message={t('sale.deleteBody')}
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (editing) write.mutate([remove('sale', editing.id, editing.revision)]);
        }}
      />
    </FormScreen>
  );
}
