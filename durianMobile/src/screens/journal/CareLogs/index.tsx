import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { CareLogRow } from '@/components/domain';
import {
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Header,
  IconButton,
  ListGroup,
  Screen,
} from '@/components/ui';
import { useSeasonData } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { spacing } from '@/theme';
import { CARE_KINDS, type CareKind } from '@/types';

/** SC-10: the care journal of the selected season, newest first, filtered by kind. */
export function CareLogs() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const { season, careLogs, expenses } = useSeasonData();
  const [kind, setKind] = useState<CareKind | null>(null);

  const shown = careLogs
    .filter((c) => !kind || c.kind === kind)
    .sort(
      (a, b) =>
        b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at),
    );

  return (
    <Screen
      withTabBar
      header={
        <Header
          title={t('screens.CareLogs')}
          subtitle={season?.name}
          right={
            <IconButton
              icon="bug"
              variant="outline"
              accessibilityLabel={t('screens.Cases')}
              onPress={() => nav.navigate('Cases')}
            />
          }
        />
      }
    >
      <View testID="screen-CareLogs" style={{ gap: spacing.md }}>
        <ChipRow>
          <Chip label={t('common.all')} selected={!kind} onPress={() => setKind(null)} />
          {CARE_KINDS.map((k) => (
            <Chip
              key={k}
              label={t(`careKinds.${k}`)}
              selected={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </ChipRow>
        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          <Button
            size="md"
            icon="plus"
            label={t('care.add')}
            onPress={() => nav.navigate('AddCareLog')}
          />
          {shown.length === 0 ? (
            <EmptyState icon="leaf" title={t('care.emptyTitle')} body={t('care.emptyBody')} />
          ) : (
            <ListGroup>
              {shown.map((log) => (
                <CareLogRow
                  key={log.id}
                  log={log}
                  expense={expenses.find((e) => e.care_log_id === log.id)}
                  onPress={() => nav.navigate('AddCareLog', { careLogId: log.id })}
                />
              ))}
            </ListGroup>
          )}
        </View>
      </View>
    </Screen>
  );
}
