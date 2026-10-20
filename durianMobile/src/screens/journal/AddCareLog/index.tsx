import { zodResolver } from '@hookform/resolvers/zod';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { newId, remove, upsert } from '@/api';
import { DeleteCareLogDialog, FormScreen } from '@/components/domain';
import {
  Button,
  Card,
  ControlledChipSelect,
  ControlledDatePicker,
  ControlledMoneyInput,
  ControlledTextInput,
  ControlledToggleRow,
  FormField,
  OptionSelect,
  Text,
} from '@/components/ui';
import { useFormat, useFormDraft, useRows, useSelection, useWrite } from '@/hooks';
import { useCloseAfterSave } from '@/hooks/useSavedNavigation';
import type { RootStackParamList } from '@/navigation/types';
import { useUnsavedChangesGuard } from '@/navigation/useUnsavedChangesGuard';
import { draftKey } from '@/stores';
import { spacing } from '@/theme';
import {
  CARE_KINDS,
  CARE_KINDS_WITH_INPUTS,
  EXPENSE_CATEGORIES,
  type CareInput,
  type CareLog,
  type Expense,
} from '@/types';
import { fromDateString, money, orNull, toDateString } from '@/utils';

const blank = (v: string) => v.trim() === '';

/**
 * SC-11: add or edit a care entry. Fertilizing and spraying list their inputs. A cost can be
 * recorded with the entry; it is saved as one expense linked to it, in the same mutation (FR-A09).
 */
export function AddCareLog() {
  const { t } = useTranslation();
  const f = useFormat();
  const params = useRoute<RouteProp<RootStackParamList, 'AddCareLog'>>().params;
  const { season } = useSelection();
  const logs = useRows('care_log');
  const expenses = useRows('expense');
  const cases = useRows('disease_case');
  const editing = logs.find((l) => l.id === params?.careLogId) ?? null;
  const linkedExpense = expenses.find((e) => e.care_log_id === editing?.id) ?? null;
  const ids = useRef({ log: newId(), expense: newId() }).current;
  const id = editing?.id ?? ids.log;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const close = useCloseAfterSave();

  const inputSchema = z.object({
    uid: z.string(),
    product: z.string(),
    amount: z.string().trim(),
    unit: z.string().trim(),
    ingredient: z.string().trim(),
  });
  const schema = z
    .object({
      kind: z.enum(CARE_KINDS),
      occurredOn: z.date(),
      note: z.string().trim(),
      inputs: z.array(inputSchema),
      caseId: z.string(),
      withExpense: z.boolean(),
      expenseCategory: z.enum(EXPENSE_CATEGORIES),
      expenseAmount: z.string().trim(),
    })
    .superRefine((v, ctx) => {
      if (CARE_KINDS_WITH_INPUTS.includes(v.kind)) {
        const used = v.inputs.filter(
          (i) => !(blank(i.product) && blank(i.amount) && blank(i.unit) && blank(i.ingredient)),
        );
        if (used.length === 0) {
          ctx.addIssue({ code: 'custom', path: ['inputs'], message: t('errors.input_required') });
        }
        v.inputs.forEach((i, n) => {
          if (used.includes(i) && blank(i.product)) {
            ctx.addIssue({
              code: 'custom',
              path: ['inputs', n, 'product'],
              message: t('form.required'),
            });
          }
          if (!blank(i.amount) && !money.isPositive(i.amount)) {
            ctx.addIssue({
              code: 'custom',
              path: ['inputs', n, 'amount'],
              message: t('errors.amount_positive'),
            });
          }
          if (blank(i.amount) !== blank(i.unit) && used.includes(i)) {
            ctx.addIssue({
              code: 'custom',
              path: ['inputs', n, 'unit'],
              message: t('errors.amount_unit_together'),
            });
          }
        });
      }
      if (v.withExpense && !money.isPositive(v.expenseAmount)) {
        ctx.addIssue({
          code: 'custom',
          path: ['expenseAmount'],
          message: t('errors.amount_positive'),
        });
      }
    });
  type Values = z.infer<typeof schema>;

  const emptyInput = () => ({ uid: newId(), product: '', amount: '', unit: '', ingredient: '' });
  const fromRows = (l: CareLog, e: Expense | null): Values => ({
    kind: l.kind,
    occurredOn: fromDateString(l.occurred_on),
    note: l.note ?? '',
    inputs: l.inputs.map((i) => ({
      uid: i.id,
      product: i.product_name,
      amount: i.amount ?? '',
      unit: i.unit ?? '',
      ingredient: i.active_ingredient ?? '',
    })),
    caseId: l.case_id ?? '',
    withExpense: e != null,
    expenseCategory: e?.category ?? 'fertilizer',
    expenseAmount: e?.amount_vnd ?? '',
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? fromRows(editing, linkedExpense)
      : {
          kind: 'fertilizing',
          occurredOn: new Date(),
          note: '',
          inputs: [emptyInput()],
          caseId: params?.caseId ?? '',
          withExpense: false,
          expenseCategory: 'fertilizer',
          expenseAmount: '',
        },
  });
  const inputs = useFieldArray({ control: form.control, name: 'inputs' });
  const draft = useFormDraft(draftKey('careLog', editing?.id), form);
  useUnsavedChangesGuard(form.formState.isDirty && !close.saved);

  const write = useWrite({
    onSuccess: () => {
      draft.clear();
      close.markSaved();
    },
    onConflict: (rows) => {
      const log = rows.find((r) => r.entity === 'care_log' && r.row.id === id)?.row as
        CareLog | undefined;
      const exp = rows.find((r) => r.entity === 'expense')?.row as Expense | undefined;
      if (log && !log.deleted_at)
        form.reset(fromRows(log, exp && !exp.deleted_at ? exp : linkedExpense));
      setConflicted(true);
    },
  });

  const [kind, withExpense, caseId] = form.watch(['kind', 'withExpense', 'caseId']);
  const hasInputs = CARE_KINDS_WITH_INPUTS.includes(kind);
  const inputsError =
    form.formState.errors.inputs?.root?.message ?? form.formState.errors.inputs?.message;

  const submit = form.handleSubmit((v) => {
    if (!season) return;
    const careInputs: CareInput[] = CARE_KINDS_WITH_INPUTS.includes(v.kind)
      ? v.inputs
          .filter(
            (i) => !(blank(i.product) && blank(i.amount) && blank(i.unit) && blank(i.ingredient)),
          )
          .map((i) => ({
            id: i.uid,
            product_name: i.product.trim(),
            amount: blank(i.amount) ? null : money.normalizeKg(i.amount),
            unit: orNull(i.unit),
            active_ingredient: orNull(i.ingredient),
          }))
      : [];
    const logData = {
      case_id: orNull(v.caseId),
      occurred_on: toDateString(v.occurredOn),
      kind: v.kind,
      note: orNull(v.note),
      inputs: careInputs,
    };
    const expenseData = {
      occurred_on: logData.occurred_on,
      category: v.expenseCategory,
      amount_vnd: money.normalizeVnd(v.expenseAmount) ?? v.expenseAmount,
    };

    write.mutate([
      editing
        ? upsert('care_log', id, logData, editing.revision)
        : upsert('care_log', id, { ...logData, season_id: season.id }, null),
      ...(v.withExpense
        ? [
            linkedExpense
              ? upsert('expense', linkedExpense.id, expenseData, linkedExpense.revision)
              : upsert(
                  'expense',
                  ids.expense,
                  { ...expenseData, season_id: season.id, care_log_id: id },
                  null,
                ),
          ]
        : linkedExpense
          ? [remove('expense', linkedExpense.id, linkedExpense.revision)]
          : []),
    ]);
  });

  const caseOptions = [
    { id: '', label: t('care.noCase') },
    ...cases
      .filter((c) => c.season_id === season?.id && (!c.closed_at || c.id === editing?.case_id))
      .map((c) => ({ id: c.id, label: `${t('care.case')} ${f.date(c.opened_at.slice(0, 10))}` })),
  ];

  return (
    <FormScreen
      name="AddCareLog"
      title={editing ? t('care.edit') : t('care.add')}
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
      <ControlledDatePicker
        control={form.control}
        name="occurredOn"
        label={t('form.date')}
        required
      />
      <ControlledChipSelect
        control={form.control}
        name="kind"
        label={t('care.kind')}
        required
        options={CARE_KINDS.map((id) => ({ id, label: t(`careKinds.${id}`) }))}
      />

      {hasInputs ? (
        <View style={{ marginBottom: spacing.lg, gap: spacing.md }}>
          <Text variant="cardTitle">{t('care.inputs')}</Text>
          {inputs.fields.map((field, n) => (
            <Card key={field.id}>
              <ControlledTextInput
                control={form.control}
                name={`inputs.${n}.product`}
                label={t('care.product')}
                required
              />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <ControlledTextInput
                    control={form.control}
                    name={`inputs.${n}.amount`}
                    label={t('care.amount')}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ControlledTextInput
                    control={form.control}
                    name={`inputs.${n}.unit`}
                    label={t('care.unit')}
                  />
                </View>
              </View>
              {kind === 'spraying' ? (
                <ControlledTextInput
                  control={form.control}
                  name={`inputs.${n}.ingredient`}
                  label={t('care.ingredient')}
                />
              ) : null}
              {inputs.fields.length > 1 ? (
                <Button
                  size="md"
                  variant="ghost"
                  label={t('care.removeInput')}
                  onPress={() => inputs.remove(n)}
                />
              ) : null}
            </Card>
          ))}
          {inputsError ? (
            <Text variant="secondary" color="danger">
              {inputsError}
            </Text>
          ) : null}
          <Button
            size="md"
            variant="outline"
            icon="plus"
            label={t('care.addInput')}
            onPress={() => inputs.append(emptyInput())}
          />
        </View>
      ) : null}

      <ControlledTextInput control={form.control} name="note" label={t('form.note')} multiline />

      <FormField label={t('care.caseLabel')}>
        <OptionSelect
          options={caseOptions}
          value={caseId}
          onChange={(v) => form.setValue('caseId', v, { shouldDirty: true })}
          title={t('care.caseLabel')}
          placeholder={t('care.noCase')}
          icon="bug"
        />
      </FormField>

      <ControlledToggleRow
        control={form.control}
        name="withExpense"
        label={t('care.withExpense')}
        hint={t('care.withExpenseHint')}
      />
      {withExpense ? (
        <View style={{ marginTop: spacing.md }}>
          <ControlledChipSelect
            control={form.control}
            name="expenseCategory"
            label={t('expense.category')}
            options={EXPENSE_CATEGORIES.map((id) => ({ id, label: t(`expenseCategories.${id}`) }))}
          />
          <ControlledMoneyInput
            control={form.control}
            name="expenseAmount"
            label={t('expense.amount')}
            required
          />
        </View>
      ) : null}

      <DeleteCareLogDialog
        visible={confirmDelete}
        expenseAmount={linkedExpense?.amount_vnd ?? null}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (!editing) return;
          write.mutate([
            ...(linkedExpense ? [remove('expense', linkedExpense.id, linkedExpense.revision)] : []),
            remove('care_log', editing.id, editing.revision),
          ]);
        }}
      />
    </FormScreen>
  );
}
