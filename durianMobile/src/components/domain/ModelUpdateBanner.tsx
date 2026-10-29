import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { megabytes, megabytesDone, type InstallErrorCode, type ModelUpdate } from '@/ai';
import { Button, Card, Icon, ProgressBar, Text } from '@/components/ui';
import { useFormat, useModelProgress, useModelUpdates } from '@/hooks';
import { spacing } from '@/theme';

import { useModelInstaller } from './ModelInstall';

/** What the farmer reads when a download fails. */
export const installErrorKey = (code: InstallErrorCode) => `models.errors.${code}`;

/** One "new model" card: the notes, the size, and the button that starts the download. */
export function ModelUpdateCard({
  update,
  onDownload,
}: {
  update: ModelUpdate;
  onDownload: () => void;
}) {
  const { t } = useTranslation();
  const { locale } = useFormat();
  const { active, queue, errors } = useModelProgress();
  const part = update.entry.plant_part;
  const mine = active?.part === part ? active : null;
  const waiting = queue.includes(part);
  const error = errors[part];
  const busy = mine != null || waiting;
  const size = update.onPhone ? null : megabytes(update.entry.artifact.size_bytes);
  const label = update.entry.part_labels[locale];

  return (
    <Card variant="info" padding={spacing.md} style={styles.card}>
      <View style={styles.row} testID={`model-update-${part}`}>
        <Icon name="download" size={22} color="info" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{t('models.newFor', { part: label })}</Text>
          <Text variant="secondary" color="textMuted">
            {update.entry.release_notes}
            {size ? ` (${size})` : ''}
          </Text>
        </View>
      </View>
      {mine ? (
        <View style={{ gap: spacing.xs }}>
          <ProgressBar ratio={mine.total > 0 ? mine.done / mine.total : 0} />
          <Text variant="caption" color="textMuted">
            {mine.phase === 'verifying'
              ? t('models.verifying')
              : t('models.progress', {
                  done: megabytesDone(mine.done),
                  total: megabytes(mine.total),
                })}
          </Text>
        </View>
      ) : waiting ? (
        <Text variant="caption" color="textMuted">
          {t('models.waiting')}
        </Text>
      ) : (
        <>
          {error ? (
            <Text variant="caption" color="danger">
              {t(installErrorKey(error))}
            </Text>
          ) : null}
          <Button
            size="md"
            icon="download"
            label={error ? t('models.retry') : t('models.download')}
            loading={busy}
            onPress={onDownload}
          />
        </>
      )}
    </Card>
  );
}

/** Every pending update as a card, plus the "update the app" note. Renders nothing when there is none. */
export function ModelUpdateBanners() {
  const { t } = useTranslation();
  const { updates, needsAppUpdate } = useModelUpdates();
  const { start, dialog } = useModelInstaller();
  if (updates.length === 0 && needsAppUpdate.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      {updates.map((u) => (
        <ModelUpdateCard
          key={u.entry.plant_part}
          update={u}
          onDownload={() => void start([u.entry])}
        />
      ))}
      {needsAppUpdate.length > 0 ? (
        <Text variant="secondary" color="textMuted">
          {t('models.needsAppUpdate')}
        </Text>
      ) : null}
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
