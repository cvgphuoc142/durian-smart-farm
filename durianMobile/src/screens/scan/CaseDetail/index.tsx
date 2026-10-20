import { useRoute, type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { upsert } from '@/api';
import { CareLogRow, ScanRow } from '@/components/domain';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Header,
  InfoBanner,
  KeyValueGrid,
  ListGroup,
  Screen,
  Text,
} from '@/components/ui';
import { useFormat, useRows, useScanTimeline, useWrite } from '@/hooks';
import { useAppNavigation } from '@/navigation';
import type { RootStackParamList } from '@/navigation/types';
import { spacing } from '@/theme';
import { money } from '@/utils';

/**
 * SC-16: one case: its scans over time, the care logged against it, and what that cost (FR-B08).
 * Costs come from the season's expense book, each once. Only the farmer closes a case.
 */
export function CaseDetail() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const f = useFormat();
  const { caseId } = useRoute<RouteProp<RootStackParamList, 'CaseDetail'>>().params;
  const { cases } = useScanTimeline();
  const logs = useRows('care_log');
  const expenses = useRows('expense');
  const [confirmClose, setConfirmClose] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const write = useWrite({
    onSuccess: () => setConflicted(false),
    onConflict: () => setConflicted(true),
  });

  const item = cases.find((c) => c.id === caseId);
  const header = (
    <Header title={t('screens.CaseDetail')} variant="back" onBack={() => nav.goBack()} />
  );
  if (!item) {
    return (
      <Screen header={header}>
        <View testID="screen-CaseDetail">
          <EmptyState
            icon="bug"
            title={t('caseDetail.gone')}
            actionLabel={t('common.back')}
            onAction={() => nav.goBack()}
          />
        </View>
      </Screen>
    );
  }

  const caseLogs = logs
    .filter((l) => l.case_id === item.id)
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const logIds = new Set(caseLogs.map((l) => l.id));
  const costs = expenses.filter((e) => e.care_log_id && logIds.has(e.care_log_id));
  const total = costs.length > 0 ? money.sumVnd(costs.map((e) => e.amount_vnd)) : null;
  const closed = item.closed_at != null;

  const setClosed = (at: string | null) =>
    item.revision != null &&
    write.mutate([upsert('disease_case', item.id, { closed_at: at }, item.revision)]);

  return (
    <Screen
      header={header}
      footer={
        item.pending ? undefined : closed ? (
          <Button
            variant="outline"
            label={t('caseDetail.reopen')}
            loading={write.isPending}
            onPress={() => setClosed(null)}
          />
        ) : (
          <Button
            variant="outline"
            label={t('caseDetail.closeCase')}
            loading={write.isPending}
            onPress={() => setConfirmClose(true)}
          />
        )
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-CaseDetail" style={{ gap: spacing.lg }}>
        {conflicted ? <InfoBanner tone="warning" text={t('form.conflict')} /> : null}
        {item.pending ? <InfoBanner tone="info" text={t('caseDetail.pendingNote')} /> : null}

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title" style={{ flex: 1 }}>
              {t('cases.caseTitle', { date: f.date(item.opened_at) })}
            </Text>
            <Badge
              label={closed ? t('cases.closed') : t('cases.open')}
              tone={closed ? 'neutral' : 'warning'}
            />
          </View>
          <KeyValueGrid
            items={[
              ...(closed
                ? [
                    {
                      label: t('cases.closed'),
                      value: t('caseDetail.closedOn', { date: f.date(item.closed_at) }),
                    },
                  ]
                : []),
              ...(item.location_note
                ? [{ label: t('caseDetail.location'), value: item.location_note }]
                : []),
              ...(item.note ? [{ label: t('caseDetail.note'), value: item.note }] : []),
            ]}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">{t('caseDetail.timeline')}</Text>
          {item.scans.length === 0 ? (
            <Text variant="secondary" color="textMuted">
              {t('cases.emptyScansTitle')}
            </Text>
          ) : (
            <ListGroup>
              {item.scans.map((s) => (
                <ScanRow
                  key={s.id}
                  scan={s}
                  onPress={
                    s.photo_uri ? () => nav.navigate('ScanResult', { draftId: s.id }) : undefined
                  }
                />
              ))}
            </ListGroup>
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">{t('caseDetail.careLogs')}</Text>
          {caseLogs.length === 0 ? (
            <Text variant="secondary" color="textMuted">
              {t('caseDetail.noCareLogs')}
            </Text>
          ) : (
            <ListGroup>
              {caseLogs.map((l) => (
                <CareLogRow
                  key={l.id}
                  log={l}
                  expense={expenses.find((e) => e.care_log_id === l.id)}
                  onPress={() => nav.navigate('AddCareLog', { careLogId: l.id })}
                />
              ))}
            </ListGroup>
          )}
          {total != null ? (
            <View style={{ gap: 2 }}>
              <KeyValueGrid
                items={[{ label: t('caseDetail.cost'), value: f.vnd(total) }]}
                columns={1}
              />
              <Text variant="caption" color="textMuted">
                {t('caseDetail.costNote')}
              </Text>
            </View>
          ) : null}
          {item.pending ? null : (
            <Button
              variant="outline"
              size="md"
              icon="plus"
              label={t('caseDetail.addCareLog')}
              onPress={() => nav.navigate('AddCareLog', { caseId: item.id })}
            />
          )}
        </View>
      </View>

      <ConfirmDialog
        visible={confirmClose}
        title={t('caseDetail.closeTitle')}
        message={t('caseDetail.closeMessage')}
        confirmLabel={t('caseDetail.closeCase')}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          setClosed(new Date().toISOString());
        }}
      />
    </Screen>
  );
}
