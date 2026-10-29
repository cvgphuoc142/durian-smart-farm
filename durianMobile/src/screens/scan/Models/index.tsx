import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  bytesToFetch,
  cancelInstall,
  megabytes,
  recognizedLabels,
  rollbackModel,
  useModelStore,
  type InstalledPart,
} from '@/ai';
import { useModelInstaller } from '@/components/domain/ModelInstall';
import { ModelUpdateCard } from '@/components/domain/ModelUpdateBanner';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Header,
  Screen,
  Section,
  Text,
  useToast,
} from '@/components/ui';
import {
  useFormat,
  useModelCheck,
  useModelProgress,
  useModelUpdates,
  useRequireOnline,
} from '@/hooks';
import { useAppNavigation } from '@/navigation';
import { spacing } from '@/theme';

/**
 * SC-27: the scan models on this phone. Shows what can be downloaded (with size and progress), what
 * is installed (version, labels it recognises, beta flag) and lets the farmer go back to the
 * previous version of a body part. Models are fetched only when the farmer taps; installed ones run
 * offline.
 */
export function Models() {
  const { t } = useTranslation();
  const nav = useAppNavigation();
  const toast = useToast();
  const f = useFormat();
  const { guard } = useRequireOnline();
  const installed = useModelStore((s) => s.installed);
  const { updates, needsAppUpdate, checkedAt } = useModelUpdates();
  const { active, queue } = useModelProgress();
  const check = useModelCheck();
  const { start, dialog } = useModelInstaller();
  const [rollback, setRollback] = useState<string | null>(null);

  const parts = Object.keys(installed).sort();
  const fetchable = updates.filter((u) => !u.onPhone);
  const busy = active != null || queue.length > 0;

  const runCheck = guard(async () => {
    const result = await check.check();
    toast.show(
      t(
        result === 'update_available'
          ? 'models.checkFound'
          : result === 'up_to_date'
            ? 'models.checkUpToDate'
            : result === 'unsupported'
              ? 'models.checkUnsupported'
              : 'models.checkFailed',
      ),
      result === 'failed' || result === 'unsupported' ? 'error' : 'success',
    );
  });

  const confirmRollback = () => {
    const part = rollback;
    setRollback(null);
    if (part)
      toast.show(t(rollbackModel(part) ? 'models.rolledBack' : 'models.noPrevious'), 'info');
  };

  const empty = parts.length === 0 && updates.length === 0;

  return (
    <Screen
      header={<Header title={t('screens.Models')} variant="back" onBack={() => nav.goBack()} />}
      contentStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.lg }}
    >
      <View testID="screen-Models" style={{ gap: spacing.lg }}>
        <Card>
          <Text variant="secondary" color="textMuted">
            {checkedAt
              ? t('models.checked', { when: f.dateTime(checkedAt) })
              : t('models.neverChecked')}
          </Text>
          <Button
            label={check.state === 'checking' ? t('models.checking') : t('models.check')}
            variant="outline"
            icon="refresh"
            loading={check.state === 'checking'}
            onPress={runCheck}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {empty ? (
          <EmptyState
            icon="scan"
            title={t('models.noneTitle')}
            body={t(needsAppUpdate.length > 0 ? 'models.needsAppUpdate' : 'models.noneBody')}
          />
        ) : null}

        {updates.length > 0 ? (
          <Section title={t('models.available')} count={updates.length}>
            <View style={{ gap: spacing.sm }}>
              {updates.map((u) => (
                <ModelUpdateCard
                  key={u.entry.plant_part}
                  update={u}
                  onDownload={() => void start([u.entry])}
                />
              ))}
              {fetchable.length > 1 ? (
                <Button
                  label={t('models.downloadAll', { size: megabytes(bytesToFetch(updates)) })}
                  icon="download"
                  disabled={busy}
                  onPress={() => void start(updates.map((u) => u.entry))}
                />
              ) : null}
              {busy ? (
                <Button
                  variant="ghost"
                  size="md"
                  label={t('models.cancel')}
                  onPress={() => void cancelInstall()}
                />
              ) : null}
            </View>
          </Section>
        ) : null}
        {needsAppUpdate.length > 0 && !empty ? (
          <Text variant="secondary" color="textMuted">
            {t('models.needsAppUpdate')}
          </Text>
        ) : null}

        {parts.length > 0 ? (
          <Section title={t('models.installed')}>
            <View style={{ gap: spacing.sm }}>
              {parts.map((part) => (
                <InstalledCard
                  key={part}
                  part={installed[part]}
                  locale={f.locale}
                  onRollback={() => setRollback(part)}
                />
              ))}
            </View>
          </Section>
        ) : null}
      </View>
      {dialog}
      <ConfirmDialog
        visible={rollback != null}
        title={t('models.rollbackTitle')}
        message={t('models.rollbackBody')}
        confirmLabel={t('models.rollback')}
        onConfirm={confirmRollback}
        onCancel={() => setRollback(null)}
      />
    </Screen>
  );
}

function InstalledCard({
  part,
  locale,
  onRollback,
}: {
  part: InstalledPart;
  locale: 'vi' | 'en';
  onRollback: () => void;
}) {
  const { t } = useTranslation();
  const e = part.current.entry;
  return (
    <Card style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {e.part_labels[locale]}
        </Text>
        {e.maturity === 'beta' ? <Badge label={t('models.beta')} tone="warning" /> : null}
      </View>
      <Text variant="caption" color="textMuted">
        {t('models.versionLine', {
          version: e.version.slice(0, 8),
          size: megabytes(e.artifact.size_bytes),
        })}
      </Text>
      <Text variant="secondary">
        {t('scan.recognizes', { labels: recognizedLabels(e, locale).join(', ') })}
      </Text>
      {part.previous ? (
        <Button
          variant="ghost"
          size="md"
          label={t('models.rollbackTo', { version: part.previous.entry.version.slice(0, 8) })}
          onPress={onRollback}
        />
      ) : null}
    </Card>
  );
}
