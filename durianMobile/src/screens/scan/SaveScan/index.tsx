import { CommonActions, useRoute, type RouteProp } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScanPhoto, ScanResultCard } from '@/components/domain';
import {
  Button,
  ChipSelect,
  EmptyState,
  FormField,
  Header,
  InfoBanner,
  ListRow,
  OptionSelect,
  Screen,
  Skeleton,
  Text,
  TextInput,
  useToast,
} from '@/components/ui';
import { useFormat, useIsOnline, useLocalScan, useLocalScans, useScanTargets } from '@/hooks';
import type { RootStackParamList } from '@/navigation/types';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useAppContext } from '@/stores';
import { requestSync, saveScan, type CaseChoice } from '@/sync';
import { spacing } from '@/theme';
import { orNull } from '@/utils';

type Kind = CaseChoice['kind'];

/**
 * SC-14: pick the season, then save to history only, open a new case, or add to an open case
 * (FR-B06, FR-B07). Saving writes to the phone first and says so; sending comes after. Works
 * offline from the last list of seasons kept on the phone. A healthy result never forces a case.
 */
export function SaveScan() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const toast = useToast();
  const f = useFormat();
  const online = useIsOnline();
  const { draftId } = useRoute<RouteProp<RootStackParamList, 'SaveScan'>>().params;
  const scan = useLocalScan(draftId);
  const { scans: local } = useLocalScans();
  const { refs, fromCache, loading } = useScanTargets();
  const ctx = useAppContext();

  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const header = (
    <Header title={t('screens.SaveScan')} variant="back" onBack={() => nav.goBack()} />
  );

  // Open seasons only, named by farm and plot so two "Vụ 2026" are told apart.
  const seasons = useMemo(() => {
    if (!refs) return [];
    return refs.seasons
      .filter((s) => s.closed_on == null)
      .map((s) => {
        const plot = refs.plots.find((p) => p.id === s.plot_id);
        const farm = refs.farms.find((fm) => fm.id === plot?.farm_id);
        return { id: s.id, label: [farm?.name, plot?.name, s.name].filter(Boolean).join(' · ') };
      });
  }, [refs]);

  const chosenSeason =
    seasons.find((s) => s.id === seasonId)?.id ??
    seasons.find((s) => s.id === ctx.seasonId)?.id ??
    seasons[0]?.id ??
    null;

  // Open cases of the season: those the server sent, and new ones still waiting in the outbox.
  const cases = useMemo(() => {
    if (!chosenSeason) return [];
    const server = (refs?.cases ?? [])
      .filter((c) => c.season_id === chosenSeason)
      .map((c) => ({ id: c.id, opened_at: c.opened_at, pending: false }));
    const ids = new Set(server.map((c) => c.id));
    const waiting = local
      .filter(
        (l) => l.new_case && l.season_id === chosenSeason && l.state !== 'draft' && !l.meta_done,
      )
      .filter((l) => !ids.has(l.new_case!.id))
      .map((l) => ({ id: l.new_case!.id, opened_at: l.new_case!.opened_at, pending: true }));
    return [...server, ...waiting].sort((a, b) => b.opened_at.localeCompare(a.opened_at));
  }, [refs, local, chosenSeason]);

  if (scan === undefined || loading) {
    return (
      <Screen header={header} contentStyle={{ paddingHorizontal: spacing.gutter }}>
        <Skeleton height={120} radius={20} />
      </Screen>
    );
  }
  if (scan === null || (scan.state !== 'draft' && !saving) || scan.outcome === 'error') {
    return (
      <Screen header={header}>
        <View testID="screen-SaveScan">
          <EmptyState
            icon="scan"
            title={scan === null ? t('result.gone') : t('result.alreadySaved')}
            actionLabel={t('common.back')}
            onAction={() => nav.goBack()}
          />
        </View>
      </Screen>
    );
  }

  const defaultKind: Kind = scan.outcome === 'suspected' ? 'new' : 'none';
  const choice: Kind = kind ?? defaultKind;
  const attachTo = caseId ?? cases[0]?.id ?? null;

  const save = async () => {
    if (!chosenSeason || saving) return;
    const picked: CaseChoice =
      choice === 'new'
        ? { kind: 'new', locationNote: orNull(location), note: orNull(note) }
        : choice === 'existing' && attachTo
          ? { kind: 'existing', caseId: attachTo }
          : { kind: 'none' };
    setSaving(true);
    try {
      await saveScan(scan.user_id, scan.id, chosenSeason, picked);
      toast.show(t('saveScan.saved'), 'success');
      requestSync();
      // Offline, the case lists (read from the server) are not available; the sync screen is.
      nav.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{ name: 'Main' }, { name: online ? 'Cases' : 'ScanSync' }],
        }),
      );
    } catch {
      toast.show(t('errors.unknown'), 'error');
      setSaving(false);
    }
  };

  const summary = (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <ScanPhoto uri={scan.photo_uri} size={88} />
      <View style={{ flex: 1 }}>
        <ScanResultCard state={scan.outcome} label={scan.label_snapshot} predictions={scan.predictions} />
      </View>
    </View>
  );

  // No open season: the photo and result stay on the phone; the farmer opens one when online.
  if (seasons.length === 0) {
    return (
      <Screen
        header={header}
        footer={
          <Button variant="outline" label={t('saveScan.keepDraft')} onPress={() => nav.goBack()} />
        }
        contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
      >
        <View testID="screen-SaveScan" style={{ gap: spacing.lg }}>
          {summary}
          <EmptyState
            icon="sprout"
            title={t('saveScan.noSeasonTitle')}
            body={online ? t('saveScan.noSeasonOnline') : t('saveScan.noSeasonOffline')}
            actionLabel={online ? t('saveScan.openSeason') : undefined}
            onAction={online ? () => nav.navigate('FarmManage') : undefined}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      footer={
        <Button
          label={t('saveScan.saveButton')}
          icon="check"
          loading={saving}
          disabled={choice === 'existing' && !attachTo}
          onPress={save}
        />
      }
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-SaveScan" style={{ gap: spacing.lg }}>
        {summary}
        {fromCache ? <InfoBanner tone="info" text={t('saveScan.fromCache')} /> : null}

        <FormField label={t('saveScan.season')}>
          <OptionSelect
            title={t('saveScan.chooseSeason')}
            options={seasons}
            value={chosenSeason}
            onChange={(id) => {
              setSeasonId(id);
              setCaseId(null);
            }}
            icon="sprout"
          />
        </FormField>

        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">{t('saveScan.target')}</Text>
          <ChipSelect<Kind>
            options={[
              { id: 'none', label: t('saveScan.historyOnly') },
              { id: 'new', label: t('saveScan.newCase') },
              { id: 'existing', label: t('saveScan.attach') },
            ]}
            value={choice}
            onChange={setKind}
          />
          {choice === 'none' ? (
            <Text variant="caption" color="textMuted">
              {scan.outcome === 'healthy'
                ? t('saveScan.healthyHint')
                : t('saveScan.historyOnlyHint')}
            </Text>
          ) : null}
        </View>

        {choice === 'new' ? (
          <View style={{ gap: spacing.md }}>
            <FormField label={t('saveScan.caseLocation')}>
              <TextInput
                value={location}
                onChangeText={setLocation}
                accessibilityLabel={t('saveScan.caseLocation')}
              />
            </FormField>
            <FormField label={t('saveScan.caseNote')}>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                accessibilityLabel={t('saveScan.caseNote')}
              />
            </FormField>
          </View>
        ) : null}

        {choice === 'existing' ? (
          cases.length === 0 ? (
            <Text variant="secondary" color="textMuted">
              {t('saveScan.noOpenCases')}
            </Text>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {cases.map((c) => (
                <ListRow
                  key={c.id}
                  title={t('saveScan.caseLabel', { date: f.date(c.opened_at) })}
                  subtitle={c.pending ? t('saveScan.pendingCase') : undefined}
                  leading={{
                    type: 'tile',
                    icon: attachTo === c.id ? 'check' : 'bug',
                    tone: attachTo === c.id ? 'primary' : 'danger',
                  }}
                  onPress={() => setCaseId(c.id)}
                />
              ))}
            </View>
          )
        ) : null}
      </View>
    </Screen>
  );
}
