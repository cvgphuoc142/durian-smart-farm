import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScanPhoto } from '@/components/domain';
import { SyncBadge } from '@/components/domain/SyncBadge';
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Header,
  InfoBanner,
  Screen,
  Text,
} from '@/components/ui';
import { scanRepo } from '@/db';
import { useFormat, useIsOnline, useLocalScans, usePartLabel } from '@/hooks';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { discardScan, requestSync } from '@/sync';
import { spacing } from '@/theme';
import type { LocalScan } from '@/types';

/**
 * SC-26: every scan on this phone and where it is: saved, sending, synced or stuck. Reads only the
 * local database, so it works offline. A stuck scan can be retried or, after confirmation, deleted.
 */
export function ScanSync() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const f = useFormat();
  const online = useIsOnline();
  const part = usePartLabel();
  const { scans, ready } = useLocalScans();
  const [viewing, setViewing] = useState<LocalScan | null>(null);
  const [dropping, setDropping] = useState<{ scan: LocalScan; draft: boolean } | null>(null);

  const drafts = scans.filter((s) => s.state === 'draft');
  const saved = scans.filter((s) => s.state !== 'draft');
  const waiting = saved.filter((s) => s.state !== 'synced').length;
  const synced = saved.length - waiting;

  const reason = (s: LocalScan): string | null => {
    if (s.state === 'error') {
      const key = `errors.${s.last_error}`;
      return s.last_error ? t(key, { defaultValue: t('errors.unknown') }) : t('errors.unknown');
    }
    if (s.state === 'synced') return null;
    if (s.meta_done && !s.media_done) return t('scanSync.sentPhotoOnly');
    return s.state === 'saved_on_device' ? t('scanSync.waiting') : null;
  };

  const title = (s: LocalScan) =>
    s.outcome === 'suspected' && s.label_snapshot
      ? t('result.suspectedTitle', { label: s.label_snapshot })
      : t(`scanResult.${s.outcome}`);
  const subtitle = (s: LocalScan) => `${part(s.plant_part)} · ${f.date(s.captured_at)}`;

  return (
    <Screen
      header={<Header title={t('screens.ScanSync')} variant="back" onBack={() => nav.goBack()} />}
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-ScanSync" style={{ gap: spacing.lg }}>
        {!online ? <InfoBanner tone="info" icon="wifiOff" text={t('scanSync.offline')} /> : null}

        {ready && scans.length === 0 ? (
          <EmptyState
            icon="cloud"
            title={t('scanSync.emptyTitle')}
            body={t('scanSync.emptyBody')}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text variant="secondary" color="textMuted">
              {t('scanSync.summary', { waiting, synced })}
            </Text>
            {waiting > 0 && online ? (
              <Button
                size="md"
                icon="refresh"
                label={t('scanSync.syncNow')}
                onPress={requestSync}
              />
            ) : null}
          </View>
        )}

        {drafts.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="heading">{t('scanSync.drafts')}</Text>
            {drafts.map((s) => (
              <Card key={s.id}>
                <View style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                    <ScanPhoto uri={s.photo_uri} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{title(s)}</Text>
                      <Text variant="caption" color="textMuted">
                        {`${subtitle(s)} · ${t('scanSync.needsSeason')}`}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button
                      grow
                      size="md"
                      label={t('scanSync.continue')}
                      onPress={() => nav.navigate('ScanResult', { draftId: s.id })}
                    />
                    <Button
                      grow
                      size="md"
                      variant="outline"
                      label={t('scanSync.discard')}
                      onPress={() => setDropping({ scan: s, draft: true })}
                    />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {saved.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="heading">{t('scanSync.saved')}</Text>
            {saved.map((s) => {
              const why = reason(s);
              return (
                <Card key={s.id}>
                  <View style={{ gap: spacing.md }}>
                    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                      <ScanPhoto uri={s.photo_uri} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="bodyStrong" numberOfLines={2}>
                          {title(s)}
                        </Text>
                        <Text variant="caption" color="textMuted">
                          {subtitle(s)}
                        </Text>
                        <View style={{ flexDirection: 'row' }}>
                          <SyncBadge state={s.state as Exclude<LocalScan['state'], 'draft'>} />
                        </View>
                      </View>
                    </View>
                    {why ? (
                      <Text variant="caption" color={s.state === 'error' ? 'danger' : 'textMuted'}>
                        {why}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {s.state === 'error' ? (
                        <Button
                          grow
                          size="md"
                          icon="refresh"
                          label={t('scanSync.retry')}
                          onPress={async () => {
                            await scanRepo.requeue(s.user_id, s.id);
                            requestSync();
                          }}
                        />
                      ) : null}
                      <Button
                        grow
                        size="md"
                        variant="outline"
                        label={t('scanSync.viewPhoto')}
                        onPress={() => setViewing(s)}
                      />
                      {s.state === 'error' ? (
                        <Button
                          grow
                          size="md"
                          variant="danger"
                          label={t('scanSync.delete')}
                          onPress={() => setDropping({ scan: s, draft: false })}
                        />
                      ) : null}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        ) : null}
      </View>

      <BottomSheet
        visible={viewing != null}
        onClose={() => setViewing(null)}
        title={t('scanSync.viewPhoto')}
      >
        {viewing ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingBottom: spacing.lg }}>
            <ScanPhoto uri={viewing.photo_uri} size={320} />
            <Text variant="caption" color="textMuted">
              {subtitle(viewing)}
            </Text>
          </View>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        visible={dropping != null}
        title={dropping?.draft ? t('scanSync.discardTitle') : t('scanSync.deleteTitle')}
        message={dropping?.draft ? t('scanSync.discardMessage') : t('scanSync.deleteMessage')}
        confirmLabel={dropping?.draft ? t('scanSync.discard') : t('scanSync.delete')}
        destructive
        onCancel={() => setDropping(null)}
        onConfirm={async () => {
          const target = dropping;
          setDropping(null);
          if (target) await discardScan(target.scan.user_id, target.scan.id);
        }}
      />
    </Screen>
  );
}
