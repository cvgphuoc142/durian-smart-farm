import { zodResolver } from '@hookform/resolvers/zod';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { newId, remove, upsert } from '@/api';
import { FormScreen } from '@/components/domain';
import {
  Button,
  ConfirmDialog,
  ControlledChipSelect,
  ControlledDatePicker,
  ControlledMoneyInput,
  ControlledTextInput,
  InfoBanner,
} from '@/components/ui';
import { useFormat, useFormDraft, useRows, useSelection, useWrite } from '@/hooks';
import { useCloseAfterSave } from '@/hooks/useSavedNavigation';
import type { RootStackParamList } from '@/navigation/types';
import { useUnsavedChangesGuard } from '@/navigation/useUnsavedChangesGuard';
import { draftKey } from '@/stores';
import { spacing } from '@/theme';
import { EXPENSE_CATEGORIES, type Expense } from '@/types';
import { fromDateString, money, orNull, toDateString } from '@/utils';
import { positiveAmount } from '@/utils/schema';

/**
 * SC-06: add or edit one expense. Opened from a care log (`careLogId`) it creates the cost that
 * belongs to that entry; editing a linked cost changes the same row, never a copy (FR-A07, A10).
 */
export function AddExpense() {
  const { t } = useTranslation();
  const f = useFormat();
  const params = useRoute<RouteProp<RootStackParamList, 'AddExpense'>>().params;
  const { season } = useSelection();
  const expenses = useRows('expense');
  const careLogs = useRows('care_log');
  const editing = expenses.find((e) => e.id === params?.expenseId) ?? null;
  const newExpenseId = useRef(newId()).current;
  const id = editing?.id ?? newExpenseId;
  const linkedLog = careLogs.find((c) => c.id === (editing?.care_log_id ?? params?.careLogId));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const close = useCloseAfterSave();

  const schema = z.object({
    occurredOn: z.date(),
    category: z.enum(EXPENSE_CATEGORIES),
    amount: positiveAmount(t),
    note: z.string().trim(),
  });
  type Values = z.infer<typeof schema>;

  const fromRow = (e: Expense): Values => ({
    occurredOn: fromDateString(e.occurred_on),
    category: e.category,
    amount: e.amount_vnd,
    note: e.note ?? '',
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? fromRow(editing)
      : { occurredOn: new Date(), category: 'fertilizer', amount: '', note: '' },
  });
  const draft = useFormDraft(draftKey('expense', editing?.id), form);
  useUnsavedChangesGuard(form.formState.isDirty && !close.saved);

  const write = useWrite({
    onSuccess: () => {
      draft.clear();
      close.markSaved();
    },
    onConflict: (rows) => {
      const row = rows.find((r) => r.entity === 'expense' && r.row.id === id)?.row as
        Expense | undefined;
      if (row && !row.deleted_at) form.reset(fromRow(row));
      setConflicted(true);
    },
  });

  const submit = form.handleSubmit((v) => {
    if (!season) return;
    const data = {
      occurred_on: toDateString(v.occurredOn),
      category: v.category,
      amount_vnd: money.normalizeVnd(v.amount) ?? v.amount,
      note: orNull(v.note),
    };
    write.mutate([
      editing
        ? upsert('expense', id, data, editing.revision)
        : upsert(
            'expense',
            id,
            { ...data, season_id: season.id, care_log_id: params?.careLogId ?? null },
            null,
          ),
    ]);
  });

  const typed = form.watch('amount');
  const preview = money.isPositive(typed) ? f.vnd(money.normalizeVnd(typed)) : undefined;

  return (
    <FormScreen
      name="AddExpense"
      title={editing ? t('expense.edit') : t('expense.add')}
      subtitle={season?.name}
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
      {linkedLog ? (
        <View style={{ marginBottom: spacing.lg }}>
          <InfoBanner
            text={t('expense.linkedTo', {
              kind: t(`careKinds.${linkedLog.kind}`),
              date: f.date(linkedLog.occurred_on),
            })}
          />
        </View>
      ) : null}
      <ControlledDatePicker
        control={form.control}
        name="occurredOn"
        label={t('form.date')}
        required
      />
      <ControlledChipSelect
        control={form.control}
        name="category"
        label={t('expense.category')}
        required
        options={EXPENSE_CATEGORIES.map((id) => ({ id, label: t(`expenseCategories.${id}`) }))}
      />
      <ControlledMoneyInput
        control={form.control}
        name="amount"
        label={t('expense.amount')}
        required
        hint={preview}
      />
      <ControlledTextInput control={form.control} name="note" label={t('form.note')} multiline />
      <ConfirmDialog
        visible={confirmDelete}
        destructive
        title={t('expense.deleteTitle')}
        message={t('expense.deleteBody')}
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (editing) write.mutate([remove('expense', editing.id, editing.revision)]);
        }}
      />
    </FormScreen>
  );
}
