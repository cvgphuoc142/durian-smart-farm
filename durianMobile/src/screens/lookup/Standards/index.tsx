import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { upsert } from '@/api';
import { newId } from '@/api/ids';
import { StandardItemRow } from '@/components/domain';
import {
  Badge,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Header,
  InfoBanner,
  ListGroup,
  ListRow,
  Screen,
  Text,
  useToast,
} from '@/components/ui';
import { contentRepo } from '@/db';
import {
  useFormat,
  useRequireOnline,
  useSeasonLite,
  useStandards,
  useStandardVersion,
  useWrite,
} from '@/hooks';
import type { RootStackParamList } from '@/navigation/types';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { openExternal } from '@/services';
import { spacing } from '@/theme';
import type { SelfCheckAnswer } from '@/types';

/**
 * SC-21: the approved checklist for fresh durian per export market, with the farmer's own ticks
 * for the selected season (FR-D01, D02). A tick belongs to one season and one checklist version:
 * a new version opens unticked, an old one stays readable, and changing the language never
 * touches a tick. The count says how many the farmer marked, never that the farm qualifies.
 */
export function Standards() {
  const { t } = useTranslation();
  const f = useFormat();
  const nav = useAppNavigation();
  const toast = useToast();
  const { guard, online } = useRequireOnline();
  const params = useRoute<RouteProp<RootStackParamList, 'Standards'>>().params;
  const standards = useStandards();
  const { season, selfChecks, fromCache } = useSeasonLite();

  const [marketPick, setMarketPick] = useState<string | null>(params?.market ?? null);
  const [viewing, setViewing] = useState<string | null>(null);

  const entries = standards.data;
  const entry = entries.find((e) => e.profile.market_code === marketPick) ?? entries.at(0) ?? null;
  const currentId = entry?.profile.published_version_id ?? null;
  // A profile with nothing published can still hold an old version the farmer ticked.
  const versionId = viewing ?? currentId ?? entry?.versions.at(0)?.id ?? null;
  const { data: version, ready } = useStandardVersion(versionId);
  const readOnly = versionId !== currentId;

  const check = selfChecks.find((c) => c.standard_version_id === versionId);
  const checked = new Map((check?.answers ?? []).map((a) => [a.standard_item_id, a.checked]));
  const total = version?.items.length ?? 0;
  const done = version?.items.filter((i) => checked.get(i.id)).length ?? 0;

  // Versions that were ticked stay on the phone when a later release drops them.
  const tickedVersions = selfChecks.map((c) => c.standard_version_id).join(',');
  useEffect(() => {
    for (const id of tickedVersions.split(',').filter(Boolean)) {
      void contentRepo.pinStandardVersion(id).catch(() => undefined);
    }
  }, [tickedVersions]);

  const write = useWrite({
    onSuccess: () => {
      if (versionId) void contentRepo.pinStandardVersion(versionId).catch(() => undefined);
    },
    onConflict: () => toast.show(t('errors.conflict'), 'error'),
  });

  const toggle = (itemId: string) => {
    if (!season || !versionId || readOnly || write.isPending) return;
    const now = checked.get(itemId) !== true;
    const answers: SelfCheckAnswer[] = [
      ...(check?.answers ?? []).filter((a) => a.standard_item_id !== itemId),
      {
        standard_item_id: itemId,
        checked: now,
        checked_at: now ? new Date().toISOString() : null,
      },
    ];
    write.mutate([
      check
        ? upsert('self_check', check.id, { answers }, check.revision)
        : upsert(
            'self_check',
            newId(),
            { season_id: season.id, standard_version_id: versionId, answers },
            null,
          ),
    ]);
  };

  const open = async (url: string) => {
    if (!(await openExternal(url))) toast.show(t('content.cannotOpen'), 'error');
  };
  const market = (code: string) => t(`standards.market.${code}`, { defaultValue: code });

  return (
    <Screen
      header={<Header title={t('screens.Standards')} variant="back" onBack={() => nav.goBack()} />}
      contentStyle={{ gap: spacing.md }}
    >
      <View testID="screen-Standards" style={{ gap: spacing.md }}>
        {standards.ready && entries.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.gutter }}>
            <EmptyState
              icon="shieldCheck"
              title={t('standards.noPackTitle')}
              body={t('standards.noPackBody')}
            />
          </View>
        ) : null}

        {entries.length > 0 ? (
          <ChipRow>
            {entries.map((e) => (
              <Chip
                key={e.profile.id}
                label={market(e.profile.market_code)}
                selected={e.profile.id === entry?.profile.id}
                onPress={() => {
                  setMarketPick(e.profile.market_code);
                  setViewing(null);
                }}
              />
            ))}
          </ChipRow>
        ) : null}

        <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
          {entry && ready && !version ? (
            <EmptyState
              icon="shieldCheck"
              title={t('standards.emptyTitle', { market: market(entry.profile.market_code) })}
              body={t('standards.emptyBody')}
            />
          ) : null}

          {entry && version ? (
            <>
              <Card>
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <Badge label={t('standards.version', { no: version.version_no })} tone="info" />
                    {version.effective_on ? (
                      <Badge
                        label={t('standards.effective', { date: f.date(version.effective_on) })}
                        tone="neutral"
                        icon="calendar"
                      />
                    ) : null}
                  </View>
                  <Text variant="bodyStrong">{version.title}</Text>
                  {version.description ? (
                    <Text variant="secondary" color="textMuted">
                      {version.description}
                    </Text>
                  ) : null}
                  <Text variant="heading" accessibilityLiveRegion="polite">
                    {t('standards.progress', { done, total })}
                  </Text>
                  {season ? (
                    <Text variant="secondary" color="textMuted">
                      {t('standards.forSeason', { season: season.name })}
                    </Text>
                  ) : null}
                </View>
              </Card>

              {entry.versions.length > 1 ? (
                <ChipRow>
                  {entry.versions.map((v) => (
                    <Chip
                      key={v.id}
                      label={`${t('standards.version', { no: v.version_no })}${
                        v.id === currentId ? ` · ${t('standards.current')}` : ''
                      }`}
                      selected={v.id === versionId}
                      onPress={() => setViewing(v.id === currentId ? null : v.id)}
                    />
                  ))}
                </ChipRow>
              ) : null}

              {readOnly ? (
                <InfoBanner tone="warning" icon="clock" text={t('standards.oldVersion')} />
              ) : null}
              {!season ? <InfoBanner tone="info" text={t('standards.noSeason')} /> : null}
              {season && fromCache ? (
                <InfoBanner tone="info" icon="wifiOff" text={t('standards.cached')} />
              ) : null}
              {season && !online ? (
                <InfoBanner tone="info" icon="wifiOff" text={t('standards.needsNetwork')} />
              ) : null}

              <ListGroup>
                {version.items.map((item) => (
                  <StandardItemRow
                    key={item.id}
                    item={item}
                    checked={checked.get(item.id) === true}
                    disabled={!season || readOnly}
                    onToggle={guard(() => toggle(item.id))}
                    onOpenSource={() => void open(item.source_link)}
                  />
                ))}
              </ListGroup>

              {version.source_links.length > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <Text variant="heading" accessibilityRole="header">
                    {t('article.sources')}
                  </Text>
                  <ListGroup>
                    {version.source_links.map((url) => (
                      <ListRow
                        key={url}
                        title={url}
                        leading={{ type: 'tile', icon: 'globe', tone: 'info' }}
                        chevron
                        onPress={() => void open(url)}
                      />
                    ))}
                  </ListGroup>
                </View>
              ) : null}
            </>
          ) : null}

          <InfoBanner tone="info" text={t('standards.disclaimer')} />
        </View>
      </View>
    </Screen>
  );
}
