import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SeasonHeader } from '@/components/domain';
import {
  Badge,
  Button,
  ChipRow,
  Chip,
  EmptyState,
  ListGroup,
  ListRow,
  Screen,
  Text,
} from '@/components/ui';
import { useFormat, useSeasonData } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { spacing } from '@/theme';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/types';
import { money } from '@/utils';

/** SC-05: the season's expenses, newest first, filtered by category. The total follows the filter. */
export function Expenses() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const { expenses } = useSeasonData();
  const [category, setCategory] = useState<ExpenseCategory | null>(null);

  const shown = useMemo(
    () =>
      expenses
        .filter((e) => !category || e.category === category)
        .sort(
          (a, b) =>
            b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at),
        ),
    [expenses, category],
  );
  const total = money.sumVnd(shown.map((e) => e.amount_vnd));

  return (
    <Screen
      header={
        <SeasonHeader title={t('screens.Expenses')} variant="back" onBack={() => nav.goBack()} />
      }
      footer={
        <Button label={t('expense.add')} icon="plus" onPress={() => nav.navigate('AddExpense')} />
      }
    >
      <View testID="screen-Expenses" style={{ gap: spacing.md }}>
        <ChipRow>
          <Chip label={t('common.all')} selected={!category} onPress={() => setCategory(null)} />
          {EXPENSE_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t(`expenseCategories.${c}`)}
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </ChipRow>

        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          <Text variant="bodyStrong">
            {t('expense.total', { amount: f.vnd(total), count: shown.length })}
          </Text>
          {shown.length === 0 ? (
            <EmptyState
              icon="wallet"
              title={t('expense.emptyTitle')}
              body={t('expense.emptyBody')}
              actionLabel={t('expense.add')}
              onAction={() => nav.navigate('AddExpense')}
            />
          ) : (
            <ListGroup>
              {shown.map((e) => (
                <ListRow
                  key={e.id}
                  title={f.vnd(e.amount_vnd)}
                  subtitle={`${t(`expenseCategories.${e.category}`)} · ${f.date(e.occurred_on)}${
                    e.note ? ` · ${e.note}` : ''
                  }`}
                  trailing={
                    e.care_log_id ? <Badge label={t('expense.fromLog')} tone="info" /> : undefined
                  }
                  chevron
                  onPress={() => nav.navigate('AddExpense', { expenseId: e.id })}
                />
              ))}
            </ListGroup>
          )}
        </View>
      </View>
    </Screen>
  );
}
