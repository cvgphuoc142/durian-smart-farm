import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { CaseCard, ScanRow } from '@/components/domain';
import {
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Header,
  IconButton,
  ListGroup,
  Screen,
  Text,
} from '@/components/ui';
import { live, useScanTimeline, useSelection, useSnapshot } from '@/hooks';
import { useAppNavigation } from '@/navigation';
import { spacing } from '@/theme';

type Tab = 'cases' | 'scans';

/**
 * SC-15: the farmer's cases (open and closed) and every scan in time order, filtered by season
 * (FR-B09). Scans still on the phone show with their sync state (FR-X06).
 */
export function Cases() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const { data } = useSnapshot();
  const { season } = useSelection();
  const { scans, cases } = useScanTimeline();
  const [tab, setTab] = useState<Tab>('cases');
  const [filter, setFilter] = useState<string | 'all'>(season?.id ?? 'all');

  const plots = live(data.plots);
  const seasons = live(data.seasons).map((s) => ({
    id: s.id,
    label: [plots.find((p) => p.id === s.plot_id)?.name, s.name].filter(Boolean).join(' · '),
  }));
  const inSeason = <T extends { season_id: string }>(rows: T[]) =>
    filter === 'all' ? rows : rows.filter((r) => r.season_id === filter);

  const shownCases = inSeason(cases);
  const open = shownCases.filter((c) => c.closed_at == null);
  const closed = shownCases.filter((c) => c.closed_at != null);
  const shownScans = inSeason(scans);

  const openScan = (id: string, hasLocal: boolean, caseId: string | null) => {
    if (hasLocal) nav.navigate('ScanResult', { draftId: id });
    else if (caseId) nav.navigate('CaseDetail', { caseId });
  };

  return (
    <Screen
      header={
        <Header
          title={t('screens.Cases')}
          variant="back"
          onBack={() => nav.goBack()}
          right={
            <IconButton
              icon="cloud"
              variant="outline"
              accessibilityLabel={t('cases.syncStatus')}
              onPress={() => nav.navigate('ScanSync')}
            />
          }
        />
      }
      contentStyle={{ gap: spacing.md }}
    >
      <View testID="screen-Cases" style={{ gap: spacing.md }}>
        <ChipRow>
          <Chip
            label={t('cases.tabCases')}
            selected={tab === 'cases'}
            onPress={() => setTab('cases')}
          />
          <Chip
            label={t('cases.tabScans')}
            selected={tab === 'scans'}
            onPress={() => setTab('scans')}
          />
        </ChipRow>
        <ChipRow>
          <Chip
            label={t('cases.allSeasons')}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          {seasons.map((s) => (
            <Chip
              key={s.id}
              label={s.label}
              selected={filter === s.id}
              onPress={() => setFilter(s.id)}
            />
          ))}
        </ChipRow>

        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          <Button
            size="md"
            icon="scan"
            label={t('cases.newScan')}
            onPress={() => nav.navigate('Scan')}
          />

          {tab === 'cases' ? (
            shownCases.length === 0 ? (
              <EmptyState
                icon="bug"
                title={t('cases.emptyCasesTitle')}
                body={t('cases.emptyCasesBody')}
              />
            ) : (
              <>
                {open.length > 0 ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text variant="heading">{`${t('cases.open')} (${open.length})`}</Text>
                    <ListGroup>
                      {open.map((c) => (
                        <CaseCard
                          key={c.id}
                          item={c}
                          onPress={() => nav.navigate('CaseDetail', { caseId: c.id })}
                        />
                      ))}
                    </ListGroup>
                  </View>
                ) : null}
                {closed.length > 0 ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text variant="heading">{`${t('cases.closed')} (${closed.length})`}</Text>
                    <ListGroup>
                      {closed.map((c) => (
                        <CaseCard
                          key={c.id}
                          item={c}
                          onPress={() => nav.navigate('CaseDetail', { caseId: c.id })}
                        />
                      ))}
                    </ListGroup>
                  </View>
                ) : null}
              </>
            )
          ) : shownScans.length === 0 ? (
            <EmptyState
              icon="scan"
              title={t('cases.emptyScansTitle')}
              body={t('cases.emptyScansBody')}
            />
          ) : (
            <ListGroup>
              {shownScans.map((s) => (
                <ScanRow
                  key={s.id}
                  scan={s}
                  onPress={
                    s.photo_uri || s.case_id
                      ? () => openScan(s.id, s.photo_uri != null, s.case_id)
                      : undefined
                  }
                />
              ))}
            </ListGroup>
          )}
        </View>
      </View>
    </Screen>
  );
}
